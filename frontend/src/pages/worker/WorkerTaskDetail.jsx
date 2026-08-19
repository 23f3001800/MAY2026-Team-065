// One job, full screen.
//
// This replaces the side drawer. A drawer was the wrong container: on a phone
// it is a cramped column with its own scroll inside the page's scroll, and this
// screen has to carry a map, photos, an upload, a status control and a history.
// A courier app gives a drop its own screen for exactly this reason.
//
// Layout is ordered by what a worker does, not by what the record contains:
// where is it → what am I looking at → do the thing → what happened before.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import ComplaintMap from '../../components/map/ComplaintMap';
import PhotoGrid from '../../components/dashboard/PhotoGrid';
import Toast from '../../components/dashboard/Toast';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import {
  IconArrowLeft, IconMapPin, IconClock, IconCheckCircle, IconX,
  IconAlertTriangle, IconArrowRight, IconCamera,
} from '../../components/dashboard/icons';
import {
  getComplaint, getComplaintHistory, getComplaintMedia,
  updateComplaintStatus,
} from '../../api/complaints';
import { TERMINAL_STATUSES } from '../../api/mappers';
import useAsync from '../../hooks/useAsync';
import { uploadOrQueue } from '../../lib/uploadQueue';

const MAX_IMAGE_MB = 5;
const MAX_PHOTOS = 6;
const DAY_MS = 86400000;

function stamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

const DOT = {
  New: 'bg-teal-500', 'Under Review': 'bg-civic-400', Assigned: 'bg-caution-500',
  'In Progress': 'bg-civic-600', 'On Hold': 'bg-ink-faint', Escalated: 'bg-caution-600',
  Resolved: 'bg-teal-600', Verified: 'bg-teal-700', Reopened: 'bg-danger-600',
  Rejected: 'bg-danger-600',
};

// The one obvious next step, same rules as the list.
function primaryAction(status) {
  switch (status) {
    case 'Assigned':
    case 'Reopened':
      return { label: 'Accept task', next: 'In Progress', needsEvidence: false };
    case 'In Progress':
      return { label: 'Submit for review', next: 'Resolved', needsEvidence: true };
    case 'On Hold':
      return { label: 'Resume work', next: 'In Progress', needsEvidence: false };
    default:
      return null;
  }
}

export default function WorkerTaskDetail() {
  const { id } = useParams();

  const { data: task, error, loading, refetch } = useAsync(() => getComplaint(id), [id]);

  const [history, setHistory] = useState([]);
  const [media, setMedia] = useState([]);
  const [nonce, setNonce] = useState(0);

  const [photos, setPhotos] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(null);
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState('success');

  useEffect(() => {
    let alive = true;
    Promise.allSettled([getComplaintHistory(id), getComplaintMedia(id)]).then(([h, m]) => {
      if (!alive) return;
      if (h.status === 'fulfilled') setHistory(h.value);
      if (m.status === 'fulfilled') setMedia(m.value);
    });
    return () => { alive = false; };
  }, [id, nonce]);

  useEffect(() => () => {
    setPhotos((cur) => { cur.forEach((p) => URL.revokeObjectURL(p.url)); return []; });
  }, []);

  const timeline = useMemo(
    () => [...history].sort((a, b) => new Date(b.at) - new Date(a.at)),
    [history],
  );

  const say = useCallback((msg, tone = 'success') => { setToast(msg); setToastTone(tone); }, []);

  const addPhotos = (list) => {
    const ok = Array.from(list || []).filter((f) => {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        say(`${f.name} is over ${MAX_IMAGE_MB}MB.`, 'error');
        return false;
      }
      return true;
    });
    setPhotos((cur) => [
      ...cur,
      ...ok.slice(0, MAX_PHOTOS - cur.length).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`, file, url: URL.createObjectURL(file),
      })),
    ]);
  };

  const removePhoto = (pid) => setPhotos((cur) => {
    const gone = cur.find((p) => p.id === pid);
    if (gone) URL.revokeObjectURL(gone.url);
    return cur.filter((p) => p.id !== pid);
  });

  const run = async (next) => {
    setBusy(true);
    try {
      // Evidence first: a failed upload must be recoverable, not discovered
      // after the status has already moved.
      //
      // uploadOrQueue keeps the photos AND the typed remarks when the network
      // is the problem, and retries when the signal comes back. Losing a
      // worker's typed note to a dead spot is what made them stop writing them.
      let queued = false;
      if (photos.length) {
        setUploadPct(10);
        const result = await uploadOrQueue({
          complaintId: id,
          files: photos.map((p) => p.file),
          remarks: remarks || '',
        });
        queued = result.queued;
        setUploadPct(100);
        setPhotos((cur) => { cur.forEach((p) => URL.revokeObjectURL(p.url)); return []; });
        setNonce((n) => n + 1);
      }

      if (queued) {
        // The status is deliberately NOT moved. Marking work resolved while its
        // evidence sits in a queue would show an officer a completed job with
        // nothing to verify.
        say('No signal — photos and notes saved on this device and will upload automatically.', 'warning');
        return;
      }

      await updateComplaintStatus(id, next, remarks || null);
      setRemarks('');
      say(next === 'Resolved' ? 'Submitted for review.' : `Marked ${next}.`);
      refetch();
    } catch (err) {
      if (err.name !== 'SessionExpiredError') say(err.message, 'error');
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  };

  if (loading) return <div className="max-w-[900px] mx-auto"><LoadingPanel label="Loading task…" variant="detail" /></div>;
  if (error) return <div className="max-w-[900px] mx-auto"><ErrorPanel error={error} onRetry={refetch} /></div>;
  if (!task) return null;

  const action = primaryAction(task.status);
  const done = TERMINAL_STATUSES.includes(task.status);
  const age = Math.floor((Date.now() - new Date(task.reportedAt).getTime()) / DAY_MS);
  const mapsUrl = task.coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${task.coords.latitude},${task.coords.longitude}`
    : null;

  return (
    <div className="max-w-[900px] mx-auto pb-28 animate-rise-in">
      <Link
        to="/worker/tasks"
        className="focus-ring inline-flex items-center gap-2 text-[13px] font-semibold text-ink-muted hover:text-civic-700 transition-colors mb-4"
      >
        <IconArrowLeft size={16} /> All tasks
      </Link>

      <Toast message={toast} tone={toastTone} onDismiss={() => setToast('')} autoHideMs={toastTone === 'error' ? 0 : 4000} />

      {/* Header */}
      <header className="mt-2">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <StatusBadge status={task.status} />
          <SeverityBadge severity={task.severity} />
          <span className="text-[12px] font-mono text-ink-faint">{task.id}</span>
          {age >= 7 && !done && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-caution-700">
              <IconClock size={11} /> {age}d waiting
            </span>
          )}
        </div>
        <h1 className="font-display text-[26px] sm:text-[30px] font-bold text-ink leading-tight">
          {task.issue}
        </h1>
      </header>

      {/* Where — first, because that is the first decision. */}
      <section className="mt-5">
        <div className="rounded-2xl overflow-hidden border border-line shadow-sm">
          {task.coords
            ? <ComplaintMap complaints={[task]} height="260px" showMe />
            : <div className="h-[120px] bg-surface-inset flex items-center justify-center">
                <p className="text-[13px] text-ink-muted">No coordinates recorded for this task.</p>
              </div>}
          <div className="bg-surface p-4 flex items-center gap-3 flex-wrap">
            <span className="w-9 h-9 rounded-xl bg-civic-50 flex items-center justify-center shrink-0">
              <IconMapPin size={17} className="text-civic-700" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink leading-snug">{task.location}</div>
              <div className="text-[12px] text-ink-faint mt-0.5">
                {task.category} · reported {stamp(task.reportedAt)}
              </div>
            </div>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring lift shrink-0 inline-flex items-center gap-2 bg-civic-700 hover:bg-civic-800 text-white font-semibold text-[13px] px-4 py-2.5 rounded-xl transition-all"
              >
                <IconArrowRight size={15} /> Directions
              </a>
            )}
          </div>
        </div>
      </section>

      {/* What */}
      <section className="mt-5 bg-surface rounded-2xl border border-line shadow-sm p-5">
        <h2 className="font-display text-[15px] font-bold text-ink mb-2">What was reported</h2>
        <p className="text-[15px] text-ink-body leading-relaxed whitespace-pre-line">{task.description}</p>
        {media.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
              Photos on file
            </h3>
            <PhotoGrid photos={media} columns="sm:grid-cols-4" />
          </div>
        )}
      </section>

      {/* Do */}
      {!done && (
        <section className="mt-5 bg-surface rounded-2xl border border-line shadow-sm p-5">
          <h2 className="font-display text-[15px] font-bold text-ink mb-1">Completion evidence</h2>
          <p className="text-[13px] text-ink-muted mb-3">
            Photos of the finished work. The citizen sees these when confirming the fix.
          </p>

          <label className="focus-ring flex flex-col items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-line hover:border-civic-400 hover:bg-surface-inset py-7 transition-colors">
            <input type="file" accept="image/png,image/jpeg" multiple className="hidden"
              disabled={busy} onChange={(e) => addPhotos(e.target.files)} />
            <span className="w-11 h-11 rounded-full bg-civic-50 flex items-center justify-center">
              <IconCamera size={20} className="text-civic-700" />
            </span>
            <span className="text-[14px] font-semibold text-ink-body">Take or choose photos</span>
            <span className="text-[11px] text-ink-faint">{photos.length}/{MAX_PHOTOS} · up to {MAX_IMAGE_MB}MB each</span>
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
              {photos.map((p) => (
                <div key={p.id} className="relative animate-scale-in">
                  <img src={p.url} alt="" className="w-full aspect-square object-cover rounded-lg border border-line" />
                  <button type="button" onClick={() => removePhoto(p.id)} aria-label="Remove"
                    className="focus-ring absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-danger-600 text-white flex items-center justify-center shadow">
                    <IconX size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadPct !== null && (
            <div className="mt-3" role="status" aria-live="polite">
              <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
                <div className="h-full rounded-full bg-teal-600 transition-[width] duration-300" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}

          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="What did you do? Recorded in the history…"
            className="focus-ring mt-3 w-full rounded-xl border border-line p-3 text-[14px] text-ink outline-none resize-y transition"
          />

          {action?.needsEvidence && photos.length === 0 && media.length === 0 && (
            <p className="flex items-start gap-1.5 text-[12px] text-caution-700 mt-2">
              <IconAlertTriangle size={13} className="mt-0.5 shrink-0" />
              Without a photo this will likely come straight back to you.
            </p>
          )}
        </section>
      )}

      {/* History */}
      <section className="mt-5 bg-surface rounded-2xl border border-line shadow-sm p-5">
        <h2 className="font-display text-[15px] font-bold text-ink mb-3">History</h2>
        {timeline.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Nothing recorded since it was reported.</p>
        ) : (
          <ol className="relative">
            {timeline.map((h, i) => (
              <li key={h.id} className="relative pl-6 pb-4 last:pb-0">
                {i < timeline.length - 1 && (
                  <span className="absolute left-[5px] top-4 bottom-0 w-px bg-line" aria-hidden="true" />
                )}
                <span className={`absolute left-0 top-1 w-[11px] h-[11px] rounded-full ring-2 ring-surface ${DOT[h.status] || 'bg-ink-faint'}`} />
                <div className="text-[13px] font-semibold text-ink">{h.status}</div>
                <div className="text-[11px] text-ink-faint">{stamp(h.at)}</div>
                {h.remarks && <p className="text-[13px] text-ink-body mt-1 leading-snug">{h.remarks}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Sticky action bar. On a phone the primary action should never be
          somewhere you have to scroll to find. */}
      {!done && action && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-[260px] z-30 bg-surface/95 backdrop-blur border-t border-line px-4 py-3">
          <div className="max-w-[900px] mx-auto flex items-center gap-2">
            {task.status === 'In Progress' && (
              <button
                onClick={() => run('On Hold')}
                disabled={busy}
                className="focus-ring flex-1 py-3.5 rounded-xl border border-line text-[14px] font-semibold text-caution-700 hover:bg-caution-50 disabled:opacity-50 transition-colors"
              >
                Put on hold
              </button>
            )}
            <button
              onClick={() => run(action.next)}
              disabled={busy}
              className="focus-ring flex-[2] inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-civic-700 hover:bg-civic-800 disabled:opacity-50 text-white text-[15px] font-bold shadow-lg transition-all"
            >
              {busy ? 'Working…' : action.label}
              {!busy && <IconCheckCircle size={17} />}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="mt-5 flex items-center gap-2 text-[13px] text-teal-700 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
          <IconCheckCircle size={16} /> This task is closed. Nothing further is needed from you.
        </div>
      )}
    </div>
  );
}
