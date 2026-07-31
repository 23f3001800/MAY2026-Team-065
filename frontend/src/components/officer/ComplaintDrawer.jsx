// Side panel an officer works a single complaint in: review the AI's
// classification (and override it), merge duplicates, assign a field worker,
// and verify resolution evidence before closing.
import React, { useEffect, useState } from 'react';
import StatusBadge from '../dashboard/StatusBadge';
import SeverityBadge from '../dashboard/SeverityBadge';
import PhotoTile from '../dashboard/PhotoTile';
import {
  IconX, IconSparkles, IconMapPin, IconClock, IconCheckCircle,
  IconAlertTriangle, IconUsers, IconArrowRight,
} from '../dashboard/icons';
import { CATEGORIES, SEVERITIES } from '../../data/mockOfficerQueue';

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
  complaint, workers, onDismiss, onOverride, onAssign, onMerge, onCloseComplaint,
}) {
  const [category, setCategory] = useState(complaint.category);
  const [severity, setSeverity] = useState(complaint.severity);

  // Reset the override controls whenever a different complaint is opened.
  useEffect(() => {
    setCategory(complaint.category);
    setSeverity(complaint.severity);
  }, [complaint.id, complaint.category, complaint.severity]);

  // Close on Escape, the expected behaviour for a modal panel.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const dirty = category !== complaint.category || severity !== complaint.severity;
  const aiWasOverridden =
    complaint.category !== complaint.aiCategory || complaint.severity !== complaint.aiSeverity;
  const lowConfidence = complaint.aiConfidence < 0.6;
  const assignable = complaint.status === 'New' || complaint.status === 'Assigned';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onDismiss}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Complaint ${complaint.id}`}
        className="relative w-full max-w-[480px] h-full bg-white shadow-xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-slate-900 text-[17px] leading-snug">{complaint.issue}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[12px] font-mono text-slate-400">{complaint.id}</span>
              <StatusBadge status={complaint.status} />
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
          <p className="text-[14px] text-slate-600 leading-relaxed">{complaint.description}</p>

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

          {/* AI classification review + override */}
          <Section
            title="AI Classification"
            badge={
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  lowConfidence ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-primary'
                }`}
              >
                <IconSparkles size={12} /> {Math.round(complaint.aiConfidence * 100)}% confident
              </span>
            }
          >
            {lowConfidence && (
              <p className="flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                Low confidence — please confirm the category before assigning.
              </p>
            )}

            <div className="text-[12px] text-slate-500 mb-3">
              Proposed <span className="font-semibold text-slate-700">{complaint.aiCategory}</span> ·{' '}
              <span className="font-semibold text-slate-700">{complaint.aiSeverity}</span>
              {aiWasOverridden && <span className="text-slate-400"> (overridden by an officer)</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full bg-white rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 outline-none focus:border-primary cursor-pointer"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Severity</span>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="mt-1 w-full bg-white rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-700 outline-none focus:border-primary cursor-pointer"
                >
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>

            <button
              onClick={() => onOverride(complaint.id, { category, severity })}
              disabled={!dirty}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-colors"
            >
              {dirty ? 'Save override' : 'No changes to save'}
            </button>
          </Section>

          {/* Probable duplicates */}
          {complaint.duplicateCandidates?.length > 0 && (
            <Section
              title="Possible Duplicates"
              badge={
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {complaint.duplicateCandidates.length}
                </span>
              }
            >
              <ul className="space-y-2">
                {complaint.duplicateCandidates.map((d) => (
                  <li key={d.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-slate-800">{d.issue}</div>
                        <div className="text-[12px] font-mono text-slate-400 mt-0.5">{d.id}</div>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {Math.round(d.similarity * 100)}% match
                      </span>
                    </div>
                    <button
                      onClick={() => onMerge(complaint.id, d.id)}
                      className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2 rounded-lg transition-colors"
                    >
                      Merge this into {d.id} <IconArrowRight size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Assignment */}
          {assignable && (
            <Section title={complaint.worker ? 'Reassign Field Worker' : 'Assign Field Worker'}>
              {complaint.worker && (
                <p className="text-[13px] text-slate-500 mb-3">
                  Currently with <span className="font-semibold text-slate-700">{complaint.worker}</span>.
                </p>
              )}
              <ul className="space-y-2">
                {workers.map((w) => {
                  const offDuty = w.availability === 'Off Duty';
                  const current = w.name === complaint.worker;
                  return (
                    <li
                      key={w.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-slate-800 flex items-center gap-2">
                          {w.name}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${AVAILABILITY_STYLES[w.availability]}`}>
                            {w.availability}
                          </span>
                        </div>
                        <div className="text-[12px] text-slate-400 mt-0.5">
                          {w.skill} · {w.openTasks} open task{w.openTasks === 1 ? '' : 's'}
                        </div>
                      </div>
                      <button
                        onClick={() => onAssign(complaint.id, w)}
                        disabled={offDuty || current}
                        className="shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-primary hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white transition-colors"
                      >
                        {current ? 'Assigned' : 'Assign'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Resolution evidence — verify before closing */}
          {complaint.resolution && (
            <Section
              title="Resolution Evidence"
              badge={
                complaint.status === 'Closed' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                    <IconCheckCircle size={12} /> Verified
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    Awaiting verification
                  </span>
                )
              }
            >
              <p className="text-[13px] text-slate-600 leading-relaxed">{complaint.resolution.remarks}</p>
              <p className="text-[12px] text-slate-400 mt-2">
                {complaint.resolution.resolvedBy} · {formatStamp(complaint.resolution.resolvedAt)}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {complaint.resolution.photoCaptions.map((c) => (
                  <PhotoTile key={c} caption={c} tone="resolution" />
                ))}
              </div>
              {complaint.status === 'Resolved' && (
                <button
                  onClick={() => onCloseComplaint(complaint.id)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
                >
                  <IconCheckCircle size={16} /> Verify &amp; Close
                </button>
              )}
            </Section>
          )}

          {/* Nothing to act on */}
          {!assignable && !complaint.resolution && (
            <Section title="Status">
              <p className="flex items-center gap-2 text-[13px] text-slate-500">
                <IconUsers size={15} className="text-slate-400" />
                With {complaint.worker || 'the field team'} — no action needed right now.
              </p>
            </Section>
          )}

          <div className="pt-1">
            <SeverityBadge severity={complaint.severity} />
          </div>
        </div>
      </aside>
    </div>
  );
}
