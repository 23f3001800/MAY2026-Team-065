// Side panel an officer works a single complaint in: review AI triage,
// recategorise, assign a field worker, and move its status.
//
// AI output here is ADVISORY. The backend stores it on the complaint but never
// applies it, so this panel shows the suggestion, flags when it disagrees with
// the record, and offers a one-click accept. The officer decides.
//
// Severity override is still absent: the backend exposes PATCH for category
// only, so severity can only change via a triage run.
import React, { useEffect, useState } from 'react';
import StatusBadge from '../dashboard/StatusBadge';
import SeverityBadge from '../dashboard/SeverityBadge';
import {
  IconX, IconMapPin, IconClock, IconCheckCircle, IconAlertTriangle, IconSparkles,
} from '../dashboard/icons';
import { CATEGORIES, ASSIGNABLE_STATUSES, aiDisagrees } from '../../api/mappers';

function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const AVAILABILITY_STYLES = {
  Available: 'bg-emerald-50 text-emerald-700',
  Busy: 'bg-amber-50 text-amber-700',
  'Off Duty': 'bg-slate-100 text-slate-500',
};

function Section({ title, badge, children }) {
  return (
    <section className="border-t border-slate-100 pt-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold text-slate-800 text-[14px]">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

export default function ComplaintDrawer({
  complaint, workers, workersError, busy, onDismiss, onRecategorise, onAssign, onStatusChange,
  onAnalyse, onOpenComplaint,
}) {
  const ai = complaint.ai;
  const disagrees = aiDisagrees(complaint);

  const [categoryId, setCategoryId] = useState(complaint.categoryId || '');
  const [status, setStatus] = useState(complaint.status);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    setCategoryId(complaint.categoryId || '');
    setStatus(complaint.status);
    setRemarks('');
  }, [complaint.id, complaint.categoryId, complaint.status]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const categoryChanged = categoryId && categoryId !== complaint.categoryId;
  const statusChanged = status !== complaint.status;

  // The backend rejects an assignment unless the complaint category's
  // department appears inside the worker's skillSet string. Checking here means
  // the officer sees why a worker is unavailable instead of getting a 400.
  const department = complaint.department || '';
  const canTake = (worker) =>
    Boolean(department) && String(worker.skill || '').toLowerCase().includes(department.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-overlay-in" onClick={onDismiss} aria-hidden="true" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Complaint ${complaint.id}`}
        className="relative w-full max-w-[480px] h-full bg-white shadow-xl overflow-y-auto animate-drawer-in"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-slate-900 text-[17px] leading-snug">{complaint.issue}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[12px] font-mono text-slate-400">{complaint.id}</span>
              <StatusBadge status={complaint.status} />
              <SeverityBadge severity={complaint.severity} />
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Close panel"
            className="shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <p className="text-[14px] text-slate-600 leading-relaxed whitespace-pre-line">{complaint.description}</p>

          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="flex items-start gap-2">
              <IconMapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
              <span className="text-slate-700">{complaint.location}</span>
            </div>
            <div className="flex items-start gap-2">
              <IconClock size={15} className="text-slate-400 mt-0.5 shrink-0" />
              <span className="text-slate-700">{formatStamp(complaint.reportedAt)}</span>
            </div>
          </div>

          {/* Category */}
          <Section title="Category">
            <p className="text-[12px] text-slate-500 mb-2">
              Currently <span className="font-semibold text-slate-700">{complaint.category}</span>
              {department && <> · routed to {department}</>}
            </p>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="Category"
              className="w-full bg-white rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 outline-none focus:border-primary cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>{c.label} — {c.department}</option>
              ))}
            </select>
            <button
              onClick={() => onRecategorise(complaint.id, categoryId)}
              disabled={!categoryChanged || busy}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-colors"
            >
              {categoryChanged ? 'Save category' : 'No changes to save'}
            </button>
          </Section>

          {/* Assignment */}
          <Section title="Assign Field Worker">
            {workersError ? (
              <p className="flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                Could not load field workers: {workersError}
              </p>
            ) : workers.length === 0 ? (
              <p className="text-[13px] text-slate-500">No field workers are registered yet.</p>
            ) : (
              <ul className="space-y-2">
                {workers.map((w) => {
                  const eligible = canTake(w);
                  const offDuty = w.availability === 'Off Duty';
                  return (
                    <li key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-slate-800 flex items-center gap-2">
                          {w.name}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${AVAILABILITY_STYLES[w.availability] || 'bg-slate-100 text-slate-500'}`}>
                            {w.availability}
                          </span>
                        </div>
                        <div className="text-[12px] text-slate-400 mt-0.5">{w.skill}</div>
                        {!eligible && (
                          <div className="text-[11px] text-amber-700 mt-0.5">
                            Skills do not cover {department || 'this department'}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onAssign(complaint.id, w)}
                        disabled={offDuty || !eligible || busy}
                        className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-primary hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white transition-colors"
                      >
                        Assign
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Status */}
          <Section title="Update Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Status"
              className="w-full bg-white rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 outline-none focus:border-primary cursor-pointer"
            >
              {ASSIGNABLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Remarks (recorded in the status history)…"
              className="mt-2 w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-800 outline-none resize-y focus:border-primary transition"
            />
            <button
              onClick={() => onStatusChange(complaint.id, status, remarks)}
              disabled={!statusChanged || busy}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
            >
              <IconCheckCircle size={16} /> {statusChanged ? `Mark as ${status}` : 'No change to apply'}
            </button>
            <p className="text-[11px] text-slate-400 mt-2">
              Changing status notifies the citizen automatically.
            </p>
          </Section>

          {/* AI triage — advisory only. Nothing here has been applied to the
              record; the officer decides. */}
          <Section
            title="AI Triage"
            badge={
              ai ? (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    ai.source === 'gemini'
                      ? 'bg-violet-50 text-violet-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                  title={
                    ai.source === 'gemini'
                      ? 'Produced by a language model'
                      : 'Produced by the deterministic rules engine'
                  }
                >
                  <IconSparkles size={12} /> {ai.source === 'gemini' ? 'Model' : 'Rules engine'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  <IconSparkles size={12} /> Not analysed
                </span>
              )
            }
          >
            {!ai ? (
              <div className="space-y-3">
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  This complaint has not been triaged. It may predate AI triage, or triage may have
                  been switched off when it was filed.
                </p>
                <button
                  onClick={() => onAnalyse?.(complaint.id)}
                  disabled={busy || !onAnalyse}
                  className="focus-ring w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-colors"
                >
                  <IconSparkles size={14} /> Run triage now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {ai.summary && (
                  <p className="text-[13px] text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                    {ai.summary}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Suggested category</div>
                    <div className="text-[13px] font-semibold text-slate-800 mt-0.5">
                      {ai.suggestedCategory || '—'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">Suggested severity</div>
                    <div className="text-[13px] font-semibold text-slate-800 mt-0.5">
                      {ai.severity || '—'}
                    </div>
                  </div>
                </div>

                {typeof ai.confidence === 'number' && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>Confidence</span>
                      <span className="font-semibold tnum">{Math.round(ai.confidence * 100)}%</span>
                    </div>
                    {/* A bar, not just a number — relative certainty is easier
                        to judge by length than by reading two decimals. */}
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full origin-left animate-grow-x ${
                          ai.confidence < 0.6 ? 'bg-amber-400' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.round(ai.confidence * 100)}%` }}
                      />
                    </div>
                    {ai.confidence < 0.6 && (
                      <p className="text-[11px] text-amber-700 mt-1.5">
                        Low confidence — confirm before assigning.
                      </p>
                    )}
                  </div>
                )}

                {disagrees && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[12px] text-amber-900 leading-snug">
                      The AI suggestion differs from what this complaint is set to.
                    </p>
                    {ai.suggestedCategoryId && ai.suggestedCategoryId !== complaint.categoryId && (
                      <button
                        onClick={() => onRecategorise(complaint.id, ai.suggestedCategoryId)}
                        disabled={busy}
                        className="focus-ring mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:opacity-40 py-2 rounded-lg transition-colors"
                      >
                        Accept “{ai.suggestedCategory}”
                      </button>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Advisory only — nothing above has been applied to the record.
                </p>
              </div>
            )}
          </Section>

          {/* Duplicate flag, set by the backend's similarity check. */}
          {complaint.duplicateOfComplaintId && (
            <Section
              title="Possible Duplicate"
              badge={
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  <IconAlertTriangle size={12} /> Flagged
                </span>
              }
            >
              <p className="text-[13px] text-slate-600 leading-snug">
                This looks like the same issue as{' '}
                <span className="font-mono text-slate-800">{complaint.duplicateOfComplaintId}</span>.
              </p>
              <button
                onClick={() => onOpenComplaint?.(complaint.duplicateOfComplaintId)}
                className="focus-ring mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2 rounded-lg transition-colors"
              >
                Open {complaint.duplicateOfComplaintId}
              </button>
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}
