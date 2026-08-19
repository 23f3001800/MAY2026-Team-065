// Evidence uploads that survive a bad signal.
//
// A field worker photographs completed work in a basement, a stairwell, or the
// far end of a ward, and the upload fails. Before this, the typed remarks went
// with it — the worker retyped everything, or gave up and submitted nothing,
// which is the failure that actually loses a record of the work.
//
// So a failed upload is queued instead of discarded, and retried when the
// connection comes back. Three things make that safe rather than merely
// convenient:
//
//   1. IndexedDB, not localStorage. Photos are Blobs; localStorage holds
//      strings, and base64-encoding a few megapixels to fit would inflate them
//      by a third and blow the 5MB quota on the second photo.
//
//   2. An idempotency key per queued upload, generated once at enqueue time and
//      REUSED on every retry. The backend replays the original response for a
//      repeated key, so a retry after a partial success cannot put a second
//      copy of the same photo on the complaint. A key generated per attempt
//      would defeat the entire mechanism, which is why it is stored with the
//      record rather than made at send time.
//
//   3. Retries only fire on network-level failure. A 4xx means the server
//      understood and refused; retrying that forever is a spin loop, so those
//      are surfaced to the worker instead.
import { uploadComplaintImages } from '../api/complaints';

const DB_NAME = 'civic-uploads';
const STORE = 'pending';
const DB_VERSION = 1;

// Give up after this many attempts. A queued upload that has failed this often
// is not going to succeed by being tried again, and silently retrying forever
// hides a real problem from the worker.
const MAX_ATTEMPTS = 8;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser cannot store uploads offline.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open the upload store.'));
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = fn(store);
    transaction.oncomplete = () => resolve(result?.result ?? result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function newKey() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `up-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ── Subscribers ───────────────────────────────────────────────────
// The UI needs to know how many uploads are waiting without polling.
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function notify() {
  const pending = await listPending();
  for (const fn of listeners) fn(pending);
}

export async function listPending() {
  try {
    const items = await tx('readonly', (store) => store.getAll());
    return (items || []).sort((a, b) => a.queuedAt - b.queuedAt);
  } catch {
    return [];
  }
}

/**
 * Queue an upload for later.
 *
 * The idempotency key is minted HERE, once, and travels with the record — so
 * every retry of this upload carries the same key and the backend can recognise
 * it as a repeat.
 */
export async function enqueue({ complaintId, files, remarks }) {
  const record = {
    id: newKey(),
    idempotencyKey: newKey(),
    complaintId,
    // Blobs survive IndexedDB; File does too in every browser we target, but
    // the name is kept separately so a restored upload is still recognisable.
    files: Array.from(files).map((f) => ({ blob: f, name: f.name, type: f.type })),
    remarks: remarks || '',
    queuedAt: Date.now(),
    attempts: 0,
    lastError: '',
  };
  await tx('readwrite', (store) => store.put(record));
  await notify();
  return record;
}

export async function remove(id) {
  await tx('readwrite', (store) => store.delete(id));
  await notify();
}

async function update(record) {
  await tx('readwrite', (store) => store.put(record));
  await notify();
}

/**
 * Was this a network failure, or did the server refuse?
 *
 * Only the first is worth retrying. api/client turns a fetch-level rejection
 * into this exact message; anything else came back with a status code and
 * retrying it would spin.
 */
function isRetryable(err) {
  return /cannot reach the server/i.test(err?.message || '');
}

let flushing = false;

/**
 * Try to send everything queued.
 *
 * Serial rather than parallel: a worker on a weak connection uploading six
 * photos at once is how the upload failed in the first place.
 *
 * @returns {{sent: number, failed: number, remaining: number}}
 */
export async function flush() {
  if (flushing) return { sent: 0, failed: 0, remaining: (await listPending()).length };
  flushing = true;
  let sent = 0;
  let failed = 0;

  try {
    const pending = await listPending();
    for (const record of pending) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
      try {
        const files = record.files.map(
          (f) => new File([f.blob], f.name || 'evidence.jpg', { type: f.type || 'image/jpeg' }),
        );
        await uploadComplaintImages(record.complaintId, files, {
          remarks: record.remarks,
          idempotencyKey: record.idempotencyKey,
        });
        await remove(record.id);
        sent += 1;
      } catch (err) {
        failed += 1;
        const attempts = record.attempts + 1;
        if (!isRetryable(err) || attempts >= MAX_ATTEMPTS) {
          // Keep it, but stop retrying: the worker has to see why. Dropping it
          // silently would lose the evidence, which is the whole thing this
          // module exists to prevent.
          await update({ ...record, attempts, lastError: err.message, stalled: true });
        } else {
          await update({ ...record, attempts, lastError: err.message });
        }
      }
    }
  } finally {
    flushing = false;
  }

  const remaining = (await listPending()).length;
  return { sent, failed, remaining };
}

/**
 * Upload now, or queue it if the network is the problem.
 *
 * This is what callers should use. A server-side refusal (bad complaint, wrong
 * role) is thrown so the worker sees it immediately; only an unreachable server
 * turns into a queued upload.
 *
 * @returns {{queued: boolean}}
 */
export async function uploadOrQueue({ complaintId, files, remarks }) {
  const list = Array.from(files || []);
  if (!list.length) return { queued: false };

  const idempotencyKey = newKey();
  try {
    await uploadComplaintImages(complaintId, list, { remarks, idempotencyKey });
    return { queued: false };
  } catch (err) {
    if (!isRetryable(err)) throw err;
    // Queue with the SAME key this attempt used, so if the request actually
    // landed and only the response was lost, the retry is recognised as a
    // repeat instead of duplicating the evidence.
    const record = {
      id: newKey(),
      idempotencyKey,
      complaintId,
      files: list.map((f) => ({ blob: f, name: f.name, type: f.type })),
      remarks: remarks || '',
      queuedAt: Date.now(),
      attempts: 1,
      lastError: err.message,
    };
    await tx('readwrite', (store) => store.put(record));
    await notify();
    return { queued: true };
  }
}

// Retry as soon as the connection returns. Registered once at module load; the
// listener is cheap and there is no sensible place to unregister it, since a
// queued upload outlives any single screen.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flush(); });
}
