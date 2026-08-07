// Side panel a field worker opens a single assigned task in.
//
// Deliberately smaller than the officer's ComplaintDrawer: a worker can only
// move status (PATCH /complaints/{id}/status, which the backend allows for
// the assigned worker), not recategorise or reassign. `readOnly` is used from
// the History page, where the task is already in a terminal state and there
// is nothing left to change.
import React, { useEffect, useState } from 'react';
import StatusBadge from '../dashboard/StatusBadge';
import SeverityBadge from '../dashboard/SeverityBadge';
import { IconX, IconMapPin, IconClock, IconCheckCircle } from '../dashboard/icons';

const WORKER_STATUSES = ['Assigned', 'Resolved', 'Rejected'];

function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function TaskDrawer({ task, busy, readOnly, onDismiss, onStatusChange }) {
  const [status, setStatus] = useState(task.status);
  const [remarks, setRemarks] = useState('');

  useEffect(() => { setStatus(task.status); setRemarks(''); }, [task.id, task.status]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const changed = status !== task.status;
  const mapsUrl = task.coords
    ? `https://www.google.com/maps?q=${task.coords.latitude},${task.coords.longitude}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-overlay-in" onClick={onDismiss} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Task ${task.id}`}
        className="relative w-full max-w-[440px] h-full bg-white shadow-xl overflow-y-auto animate-drawer-in"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-slate-900 text-[17px] leading-snug">{task.issue}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[12px] font-mono text-slate-400">{task.id}</span>
              <StatusBadge status={task.status} />
              <SeverityBadge severity={task.severity} />
            </div>
          </div>
          <button onClick={onDismiss} aria-label="Close panel" className="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors">
            <IconX size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <p className="text-[14px] text-slate-600 leading-relaxed whitespace-pre-line">{task.description}</p>

          <div className="space-y-2.5 text-[13px]">
            <div className="flex items-start gap-2">
              <IconMapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
              <span className="text-slate-700">{task.location}</span>
            </div>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-primary hover:underline ml-[23px]">
                Open in Google Maps
              </a>
            )}
            <div className="flex items-start gap-2">
              <IconClock size={15} className="text-slate-400 mt-0.5 shrink-0" />
              <span className="text-slate-700">Reported {formatStamp(task.reportedAt)}</span>
            </div>
          </div>

          {!readOnly && (
            <section className="border-t border-slate-100 pt-5">
              <h3 className="font-semibold text-slate-800 text-[14px] mb-3">Update Status</h3>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Status"
                className="w-full bg-white rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 outline-none focus:border-primary cursor-pointer"
              >
                {WORKER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Remarks (recorded in the status history)…"
                className="mt-2 w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-800 outline-none resize-y focus:border-primary transition"
              />
              <button
                onClick={() => onStatusChange(task.id, status, remarks)}
                disabled={!changed || busy}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
              >
                <IconCheckCircle size={16} /> {changed ? `Mark as ${status}` : 'No change to apply'}
              </button>
              <p className="text-[11px] text-slate-400 mt-2">Changing status notifies the citizen automatically.</p>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
