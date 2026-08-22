// Verification — sign off on work a field worker says is finished.
//
// This is the one step in the complaint lifecycle that only an officer can
// clear, and until now it had no home. A worker submits evidence and the
// complaint lands in Under Review; the officer's queue showed it as one more
// row in a table of eighty, alongside complaints that need triage, assignment
// or nothing at all. Deciding "is this actually fixed?" needs the before and
// after photographs side by side at a size you can judge, not a status chip.
//
// So this is deliberately NOT another filtered table. It is one complaint at a
// time, evidence first, with the two decisions an officer can make on it —
// accept the work, or send it back — as the only buttons on screen.
//
// The queue is complaints in RESOLVED — a field worker has marked the job
// finished and it is waiting on verification. VERIFIED ones are listed too,
// because an officer often wants to re-read what they signed off, but they
// carry no actions: the ticket is closed.
//
// UNDER_REVIEW deliberately does NOT appear here. That state belongs to the
// intake phase — an officer checking a new complaint is valid, is not a
// duplicate, and choosing a department — and has no completion evidence to
// judge. The lifecycle this follows is:
//
//   PENDING -> UNDER_REVIEW -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> VERIFIED
//                  intake                     work        worker     officer
//                                                                    or citizen
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import AiVerificationPanel from '../../components/officer/AiVerificationPanel';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import {
  IconCheckCircle, IconRefresh, IconArrowRight, IconArrowLeft, IconImage,
  IconClock, IconMapPin, IconAlertTriangle,
} from '../../components/dashboard/icons';
import { listComplaints, getComplaintMedia, updateComplaintStatus } from '../../api/complaints';
import { complaintPath } from '../../api/session';
import { splitEvidence } from '../../lib/evidence';
import useAsync from '../../hooks/useAsync';
import useActionError from '../../hooks/useActionError';

// Waiting on verification, versus already verified and closed.
const AWAITING = 'Resolved';
const SIGNED_OFF = 'Verified';

// Where the work goes back to when an officer does not accept it. The worker is
// still assigned, so it resumes rather than being reopened — REOPENED is the
// citizen's move after poor feedback on a closed ticket, not the officer's.
const SENT_BACK = 'In Progress';

function ageDays(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
}

/**
 * A photo column. Deliberately large — the whole reason this screen exists is
 * that thumbnails in a drawer were too small to judge a repair from.
 */
function EvidenceColumn({ label, tone, photos, emptyMessage }) {
  const [open, setOpen] = useState(null);
  const ring = tone === 'after' ? 'ring-teal-600/20 bg-teal-50' : 'ring-leaf-600/20 bg-leaf-50';
  const text = tone === 'after' ? 'text-teal-700' : 'text-leaf-700';

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${ring} ${text}`}>
          {label}
        </span>
        <span className="text-[11px] text-ink-faint tnum">
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface-inset h-48 flex items-center justify-center px-4">
          <p className="text-[12px] text-ink-muted text-center leading-snug">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((m, i) => (
            <button
              key={m.url || i}
              onClick={() => setOpen(m.url)}
              className="focus-ring group relative rounded-xl overflow-hidden border border-line bg-surface-inset aspect-[4/3]"
            >
              <img
                src={m.url}
                alt={`${label} evidence ${i + 1}`}
                loading="lazy"
                className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      )}

      {/* Full-size view. An officer rejecting someone's work should be able to
          look at it properly first. */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-[900] bg-ink/80 animate-overlay-in flex items-center justify-center p-6"
        >
          <img src={open} alt="Evidence, full size" className="max-w-full max-h-full rounded-xl shadow-xl" />
        </div>
      )}
    </div>
  );
}

export default function OfficerVerification() {
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const all = useMemo(() => data || [], [data]);

  const queue = useMemo(
    () => all
      .filter((c) => c.status === AWAITING)
      .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)),
    [all],
  );
  const signedOff = useMemo(
    () => all
      .filter((c) => c.status === SIGNED_OFF)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [all],
  );

  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(
    () => all.find((c) => c.id === selectedId) || null,
    [all, selectedId],
  );

  // Default to the longest-waiting submission, and follow the queue as it
  // drains rather than leaving the officer on a complaint they just cleared.
  useEffect(() => {
    if (selected) return;
    setSelectedId(queue[0]?.id || signedOff[0]?.id || null);
  }, [queue, signedOff, selected]);

  const [media, setMedia] = useState([]);
  const [mediaError, setMediaError] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) { setMedia([]); return undefined; }
    let alive = true;
    setMediaLoading(true);
    setMediaError('');
    getComplaintMedia(selectedId)
      .then((m) => { if (alive) setMedia(m || []); })
      .catch((e) => { if (alive) { setMedia([]); setMediaError(e.message); } })
      .finally(() => { if (alive) setMediaLoading(false); });
    return () => { alive = false; };
  }, [selectedId]);

  const { before, after } = useMemo(
    () => splitEvidence(media, selected?.reportedAt, selected?.citizenId),
    [media, selected],
  );

  const [busy, setBusy] = useState(false);
  const { failure, report: reportFailure, clear: clearFailure } = useActionError();
  const [toast, setToast] = useState('');

  const decide = useCallback(async (status, remarks) => {
    if (!selected) return;
    setBusy(true);
    clearFailure();
    try {
      await updateComplaintStatus(selected.id, status, remarks);
      setToast(status === SIGNED_OFF ? 'Verified and closed.' : 'Sent back to the field worker.');
      setSelectedId(null);
      await refetch();
    } catch (e) {
      const described = reportFailure(e);
      // 409: the worker or another officer has already moved this. The queue on
      // screen is stale, so reload it -- the item has probably left the list.
      if (described?.recoverable) await refetch();
    } finally {
      setBusy(false);
    }
  }, [selected, refetch, clearFailure, reportFailure]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return <div className="max-w-[1180px] mx-auto"><LoadingPanel label="Loading submitted work…" variant="cards" /></div>;
  }
  if (error) {
    return <div className="max-w-[1180px] mx-auto"><ErrorPanel error={error} onRetry={refetch} /></div>;
  }

  const awaitingSelected = selected?.status === AWAITING;

  return (
    <div className="max-w-[1180px] mx-auto space-y-5 animate-rise-in">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] font-bold text-ink leading-tight">Verification</h1>
          <p className="text-[14px] text-ink-muted mt-1">
            {queue.length === 0
              ? 'No completed work is waiting on verification.'
              : `${queue.length} completed job${queue.length === 1 ? '' : 's'} waiting on verification.`}
          </p>
        </div>
        <button
          onClick={refetch}
          className="focus-ring lift inline-flex items-center gap-2 bg-surface border border-line hover:border-leaf-400 text-ink-body font-semibold text-[13px] px-3.5 py-2 rounded-lg shadow-sm transition-all"
        >
          <IconRefresh size={15} /> Refresh
        </button>
      </header>

      {toast && (
        <div className="animate-toast-in bg-teal-50 border border-teal-100 text-teal-800 text-[13px] font-medium rounded-lg px-4 py-2.5">
          {toast}
        </div>
      )}

      {queue.length === 0 && signedOff.length === 0 ? (
        <EmptyPanel
          icon={IconCheckCircle}
          title="Nothing to verify"
          message="When a field worker marks a job finished, it lands here for verification."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
          {/* The queue rail. Oldest submission first — the one that has kept a
              citizen waiting longest is the one to clear next. */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-line bg-surface-inset">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Waiting on you · {queue.length}
                </h2>
              </div>
              {queue.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted px-3.5 py-4">All caught up.</p>
              ) : (
                <ul className="divide-y divide-line max-h-[340px] overflow-y-auto">
                  {queue.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        aria-current={c.id === selectedId}
                        className={`focus-ring w-full text-left px-3.5 py-3 transition-colors ${
                          c.id === selectedId
                            ? 'bg-leaf-50 border-l-2 border-leaf-600'
                            : 'hover:bg-surface-inset border-l-2 border-transparent'
                        }`}
                      >
                        <div className="text-[13px] font-medium text-ink leading-snug line-clamp-2">{c.issue}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-ink-faint mt-1">
                          <IconClock size={11} />
                          <span className="tnum">{ageDays(c.updatedAt)}d since submission</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {signedOff.length > 0 && (
              <section className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-line bg-surface-inset">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Verified · closed
                  </h2>
                </div>
                <ul className="divide-y divide-line max-h-[220px] overflow-y-auto">
                  {signedOff.slice(0, 12).map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        aria-current={c.id === selectedId}
                        className={`focus-ring w-full text-left px-3.5 py-2.5 transition-colors ${
                          c.id === selectedId ? 'bg-teal-50' : 'hover:bg-surface-inset'
                        }`}
                      >
                        <div className="text-[12.5px] text-ink-body leading-snug line-clamp-1">{c.issue}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>

          {/* The workspace. */}
          {!selected ? (
            <EmptyPanel
              icon={IconImage}
              title="Pick a submission"
              message="Choose one from the queue to see its before and after evidence."
            />
          ) : (
            <div className="space-y-4 min-w-0">
              <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-display text-[18px] font-bold text-ink leading-snug">{selected.issue}</h2>
                    <div className="flex items-center gap-2 text-[12px] text-ink-muted mt-1.5 flex-wrap">
                      <span className="font-mono text-ink-faint">{selected.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <IconMapPin size={12} /> {selected.location}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>reported {ageDays(selected.reportedAt)}d ago</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SeverityBadge severity={selected.severity} />
                    <StatusBadge status={selected.status} />
                  </div>
                </div>
                <p className="text-[13.5px] text-ink-body leading-relaxed mt-3 border-t border-line pt-3">
                  {selected.description}
                </p>
                <Link
                  to={complaintPath('municipal_officer', selected.id)}
                  className="focus-ring inline-flex items-center gap-1.5 text-[13px] font-semibold text-leaf-700 hover:underline mt-3"
                >
                  Full record and history <IconArrowRight size={14} />
                </Link>
              </section>

              <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
                <h3 className="font-display text-[15px] font-bold text-ink mb-1">Evidence</h3>
                <p className="text-[12px] text-ink-muted mb-4">
                  Photos are attributed by uploader, so “before” is what the reporter filed and
                  “after” is what the field worker submitted.
                </p>

                {mediaLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="skeleton h-48 rounded-xl" />
                    <div className="skeleton h-48 rounded-xl" />
                  </div>
                ) : mediaError ? (
                  <p className="text-[13px] text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
                    Could not load photos: {mediaError}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EvidenceColumn
                      label="Before"
                      tone="before"
                      photos={before}
                      emptyMessage="The reporter filed no photograph with this complaint."
                    />
                    <EvidenceColumn
                      label="After"
                      tone="after"
                      photos={after}
                      emptyMessage="No completion photograph was submitted. There is nothing here to verify against."
                    />
                  </div>
                )}
              </section>

              {/* The machine's read on the after-photo. Advisory only — it sits
                  below the photographs, because the officer's own eyes are the
                  evidence and this is a second opinion on them. */}
              {!mediaLoading && after.length > 0 && (
                <AiVerificationPanel
                  complaint={selected}
                  beforePhotos={before}
                  afterPhotos={after}
                  busy={busy}
                />
              )}

              {/* A conflict is amber, not red: the officer did nothing wrong,
                  the complaint moved. The server's detail names the valid next
                  steps, so it is shown as sent. */}
              {failure && (
                <div
                  role="alert"
                  className={`text-[13px] rounded-lg px-3 py-2 border ${
                    failure.tone === 'warning'
                      ? 'text-caution-700 bg-caution-50 border-caution-100'
                      : 'text-danger-700 bg-danger-50 border-danger-100'
                  }`}
                >
                  {failure.heading && <strong className="block font-semibold mb-0.5">{failure.heading}</strong>}
                  {failure.message}
                </div>
              )}

              {awaitingSelected ? (
                <section className="bg-surface rounded-xl border border-line shadow-sm p-4 sticky bottom-4">
                  {after.length === 0 && (
                    <div className="flex items-start gap-2 text-[12.5px] text-caution-700 bg-caution-50 border border-caution-100 rounded-lg px-3 py-2 mb-3">
                      <IconAlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        No completion photo was submitted, so there is no evidence to check this
                        against. Sending it back is usually the right call.
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      disabled={busy}
                      onClick={() => decide(SIGNED_OFF, 'Work verified by officer from submitted evidence.')}
                      className="focus-ring lift inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl transition-colors"
                    >
                      <IconCheckCircle size={16} /> Verify &amp; close
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => decide(SENT_BACK, 'Sent back by officer: evidence did not show the issue resolved.')}
                      className="focus-ring inline-flex items-center gap-2 bg-surface border border-line hover:border-caution-500/50 text-ink-body font-semibold text-[14px] px-4 py-2.5 rounded-xl transition-colors"
                    >
                      <IconArrowLeft size={16} /> Send back
                    </button>
                    <span className="text-[12px] text-ink-faint">
                      Verifying closes the ticket. Sending it back returns the worker to In Progress.
                    </span>
                  </div>
                </section>
              ) : (
                <p className="text-[13px] text-ink-muted bg-surface-inset rounded-lg px-3.5 py-3">
                  This one has been verified and closed. If the reporter says the problem is still
                  there, they can reopen it from their own complaint page.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
