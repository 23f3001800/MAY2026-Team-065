// The panel an officer, admin or field worker works a single complaint in.
//
// Split into two tabs rather than one long scroll. It had grown to six stacked
// forms — category, assign, status, severity, merge, AI — which buried the
// complaint itself under a wall of controls. Now "Overview" answers *what am I
// looking at* (description, photos, map, history, AI) and "Actions" answers
// *what do I do about it*.
//
// Evidence is the important addition: officers are asked to verify resolution
// photos, and until now this panel showed none.
//
// AI output is ADVISORY. The backend stores it but never applies it, so this
// shows the suggestion, flags disagreement, and offers a one-click accept.
import React, { useEffect, useState } from 'react';
import StatusBadge from '../dashboard/StatusBadge';
import SeverityBadge from '../dashboard/SeverityBadge';
import PhotoGrid from '../dashboard/PhotoGrid';
import ComplaintMap from '../map/ComplaintMap';
import {
  IconX, IconMapPin, IconClock, IconCheckCircle, IconAlertTriangle, IconSparkles,
  IconRefresh, IconArrowRight, IconImage,
} from '../dashboard/icons';
import { CATEGORIES, ALL_STATUSES, statusesSettableBy, aiDisagrees } from '../../api/mappers';
import { getComplaintHistory, getComplaintMedia } from '../../api/complaints';
import { splitEvidence } from '../../lib/evidence';
import AiVerificationPanel from './AiVerificationPanel';

// Where a field worker's completed work sits waiting for sign-off.
//
// RESOLVED, and only RESOLVED. UNDER_REVIEW belongs to the *intake* phase — an
// officer checking a new complaint is valid, is not a duplicate, and picking a
// department — so there is no completion evidence to verify in that state.
// The lifecycle is: ASSIGNED -> IN_PROGRESS -> RESOLVED (worker) -> VERIFIED
// (officer or citizen).
const AWAITING_SIGN_OFF = ['Resolved'];

const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const DOT = {
  'New': 'bg-emerald-500', 'Under Review': 'bg-sky-500', 'Assigned': 'bg-amber-500',
  'In Progress': 'bg-blue-500', 'On Hold': 'bg-slate-400', 'Escalated': 'bg-orange-500',
  'Resolved': 'bg-violet-500', 'Verified': 'bg-teal-600', 'Reopened': 'bg-rose-500',
  'Rejected': 'bg-red-500',
};

const AVAILABILITY_STYLES = {
  Available: 'bg-emerald-50 text-emerald-700',
  Busy: 'bg-amber-50 text-amber-700',
  'Off Duty': 'bg-slate-100 text-slate-500',
};

function formatStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function Card({ title, badge, children, tone = '' }) {
  return (
    <section className={`rounded-xl border p-4 ${tone || 'border-line bg-white'}`}>
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-ink text-[13px]">{title}</h3>
          {badge}
        </div>
      )}
      {children}
    </section>
  );
}

function Label({ children }) {
  return <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-faint mb-1">{children}</span>;
}

const selectCls =
  'focus-ring w-full bg-white rounded-lg border border-line px-2.5 py-2 text-[13px] text-ink-body outline-none cursor-pointer transition';

export default function ComplaintDrawer({
  complaint, workers, workersError, busy, role = 'municipal_officer',
  onDismiss, onRecategorise, onAssign, onStatusChange,
  onAnalyse, onOpenComplaint, onOverrideSeverity, onMerge,
}) {
  const ai = complaint.ai;
  const disagrees = aiDisagrees(complaint);

  const [tab, setTab] = useState('overview');
  const [categoryId, setCategoryId] = useState(complaint.categoryId || '');
  const [status, setStatus] = useState(complaint.status);
  const [remarks, setRemarks] = useState('');
  const [severity, setSeverity] = useState(complaint.severity);
  const [mergeInto, setMergeInto] = useState('');

  const [history, setHistory] = useState([]);
  const [media, setMedia] = useState([]);

  useEffect(() => {
    setCategoryId(complaint.categoryId || '');
    setStatus(complaint.status);
    setSeverity(complaint.severity);
    setRemarks('');
    setMergeInto('');
    setTab('overview');
  }, [complaint.id, complaint.categoryId, complaint.status, complaint.severity]);

  // Evidence and audit trail, fetched per complaint. allSettled so one failing
  // does not cost us the other.
  useEffect(() => {
    let alive = true;
    setHistory([]);
    setMedia([]);
    Promise.allSettled([getComplaintHistory(complaint.id), getComplaintMedia(complaint.id)])
      .then(([h, m]) => {
        if (!alive) return;
        if (h.status === 'fulfilled') setHistory(h.value);
        if (m.status === 'fulfilled') setMedia(m.value);
      });
    return () => { alive = false; };
  }, [complaint.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  // Split by uploader, not by the RESOLVED timestamp — the worker screen
  // uploads before moving status, so a timestamp split files every completion
  // photo under "before". See lib/evidence.js.
  const { before: beforePhotos, after: afterPhotos } = splitEvidence(media, complaint.reportedAt, complaint.citizenId);

  const categoryChanged = categoryId && categoryId !== complaint.categoryId;
  const statusChanged = status !== complaint.status;
  const severityChanged = severity !== complaint.severity;

  // The backend rejects an assignment unless the category's department appears
  // in the worker's skillSet. Checking here shows the officer why a worker is
  // unavailable instead of handing them a 400.
  const department = complaint.department || '';
  const canTake = (w) =>
    Boolean(department) && String(w.skill || '').toLowerCase().includes(department.toLowerCase());

  const settable = statusesSettableBy(role);
  const timeline = [...history].sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-overlay-in" onClick={onDismiss} aria-hidden="true" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Complaint ${complaint.id}`}
        className="relative w-full max-w-[560px] h-full bg-surface-sunken shadow-xl flex flex-col animate-drawer-in"
      >
        {/* Hero */}
        <div className="bg-white border-b border-line shrink-0">
          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-mono text-ink-faint">{complaint.id}</span>
                {complaint.duplicateOfComplaintId && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    duplicate
                  </span>
                )}
              </div>
              <h2 className="font-display font-bold text-ink text-[18px] leading-snug">{complaint.issue}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={complaint.status} />
                <SeverityBadge severity={complaint.severity} />
                <span className="text-[12px] text-ink-faint">{complaint.category}</span>
              </div>
            </div>
            <button
              onClick={onDismiss}
              aria-label="Close panel"
              className="focus-ring shrink-0 w-8 h-8 rounded-lg text-ink-faint hover:bg-slate-100 hover:text-ink-body flex items-center justify-center transition-colors"
            >
              <IconX size={18} />
            </button>
          </div>

          <div className="px-5 flex gap-1" role="tablist">
            {[['overview', 'Overview'], ['actions', 'Actions']].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`focus-ring relative px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                  tab === key ? 'text-primary' : 'text-ink-muted hover:text-ink-body'
                }`}
              >
                {label}
                <span
                  className={`absolute left-0 right-0 -bottom-px h-0.5 rounded-full transition-all ${
                    tab === key ? 'bg-primary' : 'bg-transparent'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {tab === 'overview' ? (
            <>
              <Card>
                <p className="text-[14px] text-ink-body leading-relaxed whitespace-pre-line">
                  {complaint.description}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-slate-100 text-[13px]">
                  <div className="flex items-start gap-2">
                    <IconMapPin size={15} className="text-ink-faint mt-0.5 shrink-0" />
                    <span className="text-ink-body">{complaint.location}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <IconClock size={15} className="text-ink-faint mt-0.5 shrink-0" />
                    <span className="text-ink-body">{formatStamp(complaint.reportedAt)}</span>
                  </div>
                </div>
              </Card>

              {/* Evidence — the thing an officer is asked to verify. */}
              <Card
                title="Evidence"
                badge={
                  <span className="text-[11px] text-ink-faint ml-auto">
                    {media.length} photo{media.length === 1 ? '' : 's'}
                  </span>
                }
              >
                {/* Before and after, side by side. An officer is asked to
                    verify completion — one undifferentiated grid makes that
                    impossible, because you cannot tell which photo is the
                    problem and which is the fix. */}
                {media.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-line bg-surface-inset/60 p-2.5">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Before</span>
                        <span className="text-[10px] text-ink-faint tnum">{beforePhotos.length}</span>
                      </div>
                      {beforePhotos.length
                        ? <PhotoGrid photos={beforePhotos} columns="grid-cols-2" />
                        : <p className="text-[11px] text-ink-faint py-3 text-center">Nothing from the reporter.</p>}
                    </div>
                    <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-2.5">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-teal-700">After</span>
                        <span className="text-[10px] text-ink-faint tnum">{afterPhotos.length}</span>
                      </div>
                      {afterPhotos.length
                        ? <PhotoGrid photos={afterPhotos} columns="grid-cols-2" />
                        : <p className="text-[11px] text-ink-faint py-3 text-center">No completion evidence yet.</p>}
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-[13px] text-ink-muted">
                    <IconImage size={15} className="text-ink-faint" /> No photos attached.
                  </p>
                )}

                {/* AI assistance sits with the evidence and above the decision,
                    so it informs the choice rather than second-guessing it. */}
                {AWAITING_SIGN_OFF.includes(complaint.status) && (
                  <AiVerificationPanel
                    complaint={complaint}
                    beforePhotos={beforePhotos}
                    afterPhotos={afterPhotos}
                    busy={busy}
                  />
                )}

                {/* The verification decision, where the evidence is — not
                    buried in the status dropdown further down. */}
                {AWAITING_SIGN_OFF.includes(complaint.status) && (
                  <div className="mt-3 rounded-lg border border-civic-100 bg-civic-50/60 p-3">
                    <p className="text-[12px] text-ink-body leading-snug mb-2.5">
                      A field worker has submitted this as complete. Verify the work matches the
                      report, or send it back.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onStatusChange(complaint.id, 'Verified', 'Evidence verified by officer.')}
                        disabled={busy || afterPhotos.length === 0}
                        title={afterPhotos.length === 0 ? 'No completion evidence to verify' : undefined}
                        className="focus-ring flex-1 inline-flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[12px] py-2 rounded-lg transition-colors"
                      >
                        <IconCheckCircle size={14} /> Verify &amp; close
                      </button>
                      <button
                        onClick={() => onStatusChange(complaint.id, 'In Progress', 'Sent back by officer — work not accepted.')}
                        disabled={busy}
                        className="focus-ring flex-1 bg-surface border border-line hover:border-caution-500 text-caution-700 font-semibold text-[12px] py-2 rounded-lg transition-colors disabled:opacity-40"
                      >
                        Send back
                      </button>
                    </div>
                    {afterPhotos.length === 0 && (
                      <p className="text-[11px] text-caution-700 mt-2">
                        Nothing to verify — no completion photo was attached.
                      </p>
                    )}
                  </div>
                )}
              </Card>

              {complaint.coords && (
                <Card title="Location">
                  <ComplaintMap complaints={[complaint]} height="200px" />
                </Card>
              )}

              {/* AI triage */}
              {ai ? (
                <Card
                  title="AI triage"
                  tone={disagrees ? 'border-amber-200 bg-amber-50/60' : 'border-line bg-white'}
                  badge={
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      ai.source === 'gemini' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <IconSparkles size={11} /> {ai.source === 'gemini' ? 'Model' : 'Rules engine'}
                    </span>
                  }
                >

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white rounded-lg border border-line p-2.5">
                      <Label>Suggested category</Label>
                      <div className="text-[13px] font-semibold text-ink">{ai.suggestedCategory || '—'}</div>
                    </div>
                    <div className="bg-white rounded-lg border border-line p-2.5">
                      <Label>Suggested severity</Label>
                      <div className="text-[13px] font-semibold text-ink">{ai.severity || '—'}</div>
                    </div>
                  </div>

                  {typeof ai.confidence === 'number' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1">
                        <span>Confidence</span>
                        <span className="font-semibold tnum">{Math.round(ai.confidence * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${ai.confidence < 0.6 ? 'bg-amber-400' : 'bg-primary'}`}
                          style={{ width: `${Math.round(ai.confidence * 100)}%` }}
                        />
                      </div>
                      {ai.confidence < 0.6 && (
                        <p className="text-[11px] text-amber-800 mt-1.5">
                          Low confidence — confirm the category before assigning.
                        </p>
                      )}
                    </div>
                  )}

                  {disagrees && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <p className="text-[12px] text-amber-900 mb-2">
                        This differs from the record. Nothing has been applied.
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {ai.suggestedCategoryId && ai.suggestedCategoryId !== complaint.categoryId && (
                          <button
                            onClick={() => onRecategorise(complaint.id, ai.suggestedCategoryId)}
                            disabled={busy}
                            className="focus-ring text-[12px] font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition"
                          >
                            Accept category
                          </button>
                        )}
                        {ai.severity && ai.severity !== complaint.severity && onOverrideSeverity && (
                          <button
                            onClick={() => onOverrideSeverity(complaint.id, ai.severity, 'Accepted AI severity')}
                            disabled={busy}
                            className="focus-ring text-[12px] font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition"
                          >
                            Accept severity
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-ink-faint mt-3">Analysed {formatStamp(ai.analyzedAt)}</p>
                </Card>
              ) : (
                <Card title="AI triage">
                  <p className="text-[13px] text-ink-muted mb-3">
                    This complaint has not been analysed — it was filed before triage existed, or
                    while it was switched off.
                  </p>
                  <button
                    onClick={() => onAnalyse?.(complaint.id)}
                    disabled={busy || !onAnalyse}
                    className="focus-ring inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition"
                  >
                    <IconRefresh size={13} /> Run triage now
                  </button>
                </Card>
              )}

              {complaint.duplicateOfComplaintId && (
                <Card title="Duplicate" tone="border-slate-200 bg-slate-100">
                  <p className="text-[13px] text-ink-body">
                    Merged into <span className="font-mono font-semibold">{complaint.duplicateOfComplaintId}</span>.
                  </p>
                  <button
                    onClick={() => onOpenComplaint?.(complaint.duplicateOfComplaintId)}
                    className="focus-ring mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                  >
                    Open {complaint.duplicateOfComplaintId} <IconArrowRight size={12} />
                  </button>
                </Card>
              )}

              <Card title="History">
                {timeline.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">No transitions recorded yet.</p>
                ) : (
                  <ol className="relative">
                    {timeline.map((h, i) => (
                      <li key={h.id} className="relative pl-6 pb-4 last:pb-0">
                        {i < timeline.length - 1 && (
                          <span className="absolute left-[6px] top-4 bottom-0 w-px bg-slate-200" aria-hidden="true" />
                        )}
                        <span className={`absolute left-0 top-1 w-[13px] h-[13px] rounded-full border-2 border-white ring-2 ring-slate-100 ${DOT[h.status] || 'bg-slate-400'}`} />
                        <div className="text-[12px] font-semibold text-ink">{h.status}</div>
                        <div className="text-[11px] text-ink-faint">{formatStamp(h.at)}</div>
                        {h.remarks && <p className="text-[12px] text-ink-body mt-0.5 leading-snug">{h.remarks}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            </>
          ) : (
            <>
              {/* Status */}
              <Card title="Update status">
                <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={selectCls}>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s} disabled={!settable.includes(s) && s !== complaint.status}>
                      {s}{!settable.includes(s) && s !== complaint.status ? ' — not yours to set' : ''}
                    </option>
                  ))}
                </select>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Remarks (recorded in the history)…"
                  className="focus-ring mt-2 w-full rounded-lg border border-line p-2.5 text-[13px] text-ink outline-none resize-y transition"
                />
                <button
                  onClick={() => onStatusChange(complaint.id, status, remarks)}
                  disabled={!statusChanged || busy}
                  className="focus-ring mt-2 w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg shadow-btn transition-colors"
                >
                  <IconCheckCircle size={16} /> {statusChanged ? `Mark as ${status}` : 'No change to apply'}
                </button>
                <p className="text-[11px] text-ink-faint mt-2">The citizen is notified automatically.</p>
              </Card>

              {/* Category + severity */}
              <Card title="Classification">
                <Label>Category</Label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category" className={selectCls}>
                  {CATEGORIES.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>{c.label} — {c.department}</option>
                  ))}
                </select>
                <button
                  onClick={() => onRecategorise(complaint.id, categoryId)}
                  disabled={!categoryChanged || busy}
                  className="focus-ring mt-2 w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2 rounded-lg transition-colors"
                >
                  {categoryChanged ? 'Save category' : 'No change to save'}
                </button>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <Label>Severity</Label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity" className={selectCls}>
                    {SEVERITY_LEVELS.map((sv) => <option key={sv} value={sv}>{sv}</option>)}
                  </select>
                  <button
                    onClick={() => onOverrideSeverity?.(complaint.id, severity, remarks)}
                    disabled={!severityChanged || busy || !onOverrideSeverity}
                    className="focus-ring mt-2 w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2 rounded-lg transition-colors"
                  >
                    {severityChanged ? `Set severity to ${severity}` : 'No change to apply'}
                  </button>
                  <p className="text-[11px] text-ink-faint mt-1.5">Raising this moves the complaint up the queue for everyone.</p>
                </div>
              </Card>

              {/* Assignment */}
              <Card title="Assign field worker">
                {workersError ? (
                  <p className="flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                    Could not load field workers: {workersError}
                  </p>
                ) : workers.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">No field workers are registered yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {workers.map((w) => {
                      const eligible = canTake(w);
                      const offDuty = w.availability === 'Off Duty';
                      return (
                        <li key={w.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 bg-white">
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-ink flex items-center gap-2">
                              {w.name}
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${AVAILABILITY_STYLES[w.availability] || 'bg-slate-100 text-slate-500'}`}>
                                {w.availability}
                              </span>
                            </div>
                            <div className="text-[12px] text-ink-faint mt-0.5">{w.skill}</div>
                            {!eligible && (
                              <div className="text-[11px] text-amber-700 mt-0.5">
                                Skills do not cover {department || 'this department'}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => onAssign(complaint.id, w)}
                            disabled={offDuty || !eligible || busy}
                            className="focus-ring shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-primary hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white transition-colors"
                          >
                            Assign
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              {/* Merge */}
              <Card title="Merge duplicate" tone="border-amber-200 bg-amber-50/50">
                <p className="text-[12px] text-ink-body mb-2">
                  Folds this into another complaint reporting the same issue.
                  {' '}<span className="font-mono font-semibold">{complaint.id}</span> is closed as a duplicate.
                </p>
                <input
                  value={mergeInto}
                  onChange={(e) => setMergeInto(e.target.value.trim().toUpperCase())}
                  placeholder="Target ID, e.g. CMP-A1B2C3"
                  aria-label="Merge into complaint ID"
                  className="focus-ring w-full rounded-lg border border-line px-2.5 py-2 text-[13px] font-mono text-ink outline-none bg-white transition"
                />
                <button
                  onClick={() => onMerge?.(complaint.id, mergeInto, remarks)}
                  disabled={!mergeInto || mergeInto === complaint.id || busy || !onMerge}
                  className="focus-ring mt-2 w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2 rounded-lg transition-colors"
                >
                  {mergeInto === complaint.id ? 'Cannot merge into itself' : `Merge into ${mergeInto || '…'}`}
                </button>
              </Card>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
