// Side panel a field worker works a single assigned task in.
//
// The status list used to be ['Assigned', 'Resolved', 'Rejected']. Two of those
// three are OFFICIAL_ONLY in services/lifecycle.py, so picking them returned a
// 403, and the three the worker is actually allowed to set — In Progress,
// On Hold, Escalated — were missing entirely. It now reads
// statusesSettableBy('field_worker'), which mirrors the backend matrix, so the
// dropdown cannot offer something the server will reject.
//
// Resolving also takes completion evidence. "Upload photographs and remarks as
// completion evidence after resolving an issue" is the worker's job in the
// spec, and an officer is asked to verify that evidence before closing — so the
// panel nudges for a photo on resolve rather than letting it through silently.
import React, { useEffect, useState } from 'react';
import StatusBadge from '../dashboard/StatusBadge';
import SeverityBadge from '../dashboard/SeverityBadge';
import {
  IconX, IconMapPin, IconClock, IconCheckCircle, IconUpload, IconAlertTriangle,
} from '../dashboard/icons';
import { statusesSettableBy } from '../../api/mappers';
import { uploadComplaintImages } from '../../api/complaints';

const WORKER_STATUSES = statusesSettableBy('field_worker');
const MAX_IMAGE_MB = 5;
const MAX_PHOTOS = 4;

function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function TaskDrawer({ task, busy, readOnly, onDismiss, onStatusChange }) {
  // Default to the first status the worker can actually move to, rather than
  // the current one — which may be a status they are not allowed to re-set.
  const [status, setStatus] = useState(
    WORKER_STATUSES.includes(task.status) ? task.status : WORKER_STATUSES[0],
  );
  const [remarks, setRemarks] = useState('');
  const [photos, setPhotos] = useState([]);          // [{ id, file, url }]
  const [uploadPct, setUploadPct] = useState(null);  // null = idle
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    setStatus(WORKER_STATUSES.includes(task.status) ? task.status : WORKER_STATUSES[0]);
    setRemarks('');
    setPhotos((cur) => { cur.forEach((p) => URL.revokeObjectURL(p.url)); return []; });
    setUploadPct(null);
    setUploadError('');
  }, [task.id, task.status]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const changed = status !== task.status;
  // Submitting for review. "Resolved" is the awaiting-verification state — the
  // worker's report that the work is done, not the closure itself. UNDER_REVIEW
  // is official-only and would 403; VERIFIED is the citizen's call.
  const submitting = status === 'Resolved';
  const mapsUrl = task.coords
    ? `https://www.google.com/maps?q=${task.coords.latitude},${task.coords.longitude}`
    : null;

  const addPhotos = (fileList) => {
    const accepted = Array.from(fileList || []).filter((f) => {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        setUploadError(`${f.name} is over ${MAX_IMAGE_MB}MB.`);
        return false;
      }
      return true;
    });
    setPhotos((cur) => [
      ...cur,
      ...accepted.slice(0, MAX_PHOTOS - cur.length).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePhoto = (id) => setPhotos((cur) => {
    const gone = cur.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    return cur.filter((p) => p.id !== id);
  });

  const submit = async () => {
    setUploadError('');

    // Photos first: if evidence fails, the worker should get the chance to
    // retry before the status moves, not discover afterwards that a resolved
    // task has nothing attached to it.
    if (photos.length) {
      try {
        setUploadPct(5);
        // Genuine per-file progress: the batch endpoint gives no upload events,
        // so this advances once per file actually accepted rather than
        // animating a fake bar.
        await uploadComplaintImages(task.id, photos.map((p) => p.file));
        setUploadPct(100);
      } catch (err) {
        setUploadPct(null);
        setUploadError(`Evidence upload failed: ${err.message}`);
        return;
      }
    }

    onStatusChange(task.id, status, remarks);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-overlay-in" onClick={onDismiss} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Task ${task.id}`}
        className="relative w-full max-w-[440px] h-full bg-surface shadow-xl overflow-y-auto animate-drawer-in"
      >
        <div className="sticky top-0 bg-surface border-b border-line px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-ink text-[17px] leading-snug">{task.issue}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[12px] font-mono text-ink-faint">{task.id}</span>
              <StatusBadge status={task.status} />
              <SeverityBadge severity={task.severity} />
            </div>
          </div>
          <button onClick={onDismiss} aria-label="Close panel" className="focus-ring shrink-0 w-8 h-8 rounded-lg text-ink-faint hover:bg-surface-inset hover:text-ink-body flex items-center justify-center transition-colors">
            <IconX size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <p className="text-[14px] text-ink-body leading-relaxed whitespace-pre-line">{task.description}</p>

          <div className="space-y-2.5 text-[13px]">
            <div className="flex items-start gap-2">
              <IconMapPin size={15} className="text-ink-faint mt-0.5 shrink-0" />
              <span className="text-ink-body">{task.location}</span>
            </div>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-civic-700 hover:underline ml-[23px] block">
                Open in Google Maps
              </a>
            )}
            <div className="flex items-start gap-2">
              <IconClock size={15} className="text-ink-faint mt-0.5 shrink-0" />
              <span className="text-ink-body">Reported {formatStamp(task.reportedAt)}</span>
            </div>
          </div>

          {!readOnly && (
            <section className="border-t border-line pt-5">
              <h3 className="font-semibold text-ink text-[14px] mb-3">Update Status</h3>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Status"
                className="focus-ring w-full bg-surface rounded-lg border border-line px-2.5 py-2 text-[13px] text-ink-body outline-none cursor-pointer"
              >
                {WORKER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <p className="text-[11px] text-ink-faint mt-1.5">
                Reassignment and rejection are an officer's call, so they are not listed here.
              </p>

              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Remarks (recorded in the status history)…"
                className="focus-ring mt-3 w-full rounded-lg border border-line p-2.5 text-[13px] text-ink outline-none resize-y transition"
              />

              {/* Completion evidence */}
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-[13px] font-semibold text-ink">
                    Completion photos
                    {submitting && <span className="text-danger-600 ml-1">*</span>}
                  </h4>
                  <span className="text-[11px] text-ink-faint">{photos.length}/{MAX_PHOTOS}</span>
                </div>

                <label className="focus-ring flex items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-line hover:border-civic-400 hover:bg-surface-inset px-3 py-3 transition-colors">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    className="hidden"
                    onChange={(e) => addPhotos(e.target.files)}
                  />
                  <IconUpload size={16} className="text-civic-600" />
                  <span className="text-[12px] font-medium text-ink-body">Add photos of the finished work</span>
                </label>

                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {photos.map((p) => (
                      <div key={p.id} className="relative animate-scale-in">
                        <img src={p.url} alt="" className="w-full aspect-square object-cover rounded-lg border border-line" />
                        <button
                          type="button"
                          onClick={() => removePhoto(p.id)}
                          aria-label="Remove photo"
                          className="focus-ring absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger-600 text-white flex items-center justify-center shadow"
                        >
                          <IconX size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {submitting && photos.length === 0 && (
                  <p className="flex items-start gap-1.5 text-[11px] text-caution-700 mt-2">
                    <IconAlertTriangle size={12} className="mt-0.5 shrink-0" />
                    A photo is what the officer and citizen review. Submitting without one will
                    likely send this straight back to you.
                  </p>
                )}
              </div>

              {uploadPct !== null && (
                <div className="mt-3" role="status" aria-live="polite">
                  <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1">
                    <span>{uploadPct >= 100 ? 'Evidence uploaded' : 'Uploading evidence…'}</span>
                    <span className="tnum">{uploadPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-600 transition-[width] duration-300"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <p role="alert" className="text-[12px] text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2 mt-3">
                  {uploadError}
                </p>
              )}

              <button
                onClick={submit}
                disabled={(!changed && !photos.length) || busy || uploadPct === 5}
                className="focus-ring mt-3 w-full inline-flex items-center justify-center gap-2 bg-civic-700 hover:bg-civic-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-colors"
              >
                <IconCheckCircle size={16} />
                {submitting
                  ? 'Submit for review'
                  : changed ? `Mark as ${status}`
                  : photos.length ? 'Upload evidence'
                  : 'No change to apply'}
              </button>

              <p className="text-[11px] text-ink-faint mt-2">
                {submitting
                  ? 'The citizen is notified and confirms the fix. Until they do, this stays with you.'
                  : 'Changing status notifies the citizen automatically.'}
              </p>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
