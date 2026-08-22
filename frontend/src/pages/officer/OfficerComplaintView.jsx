// One complaint, in full, for an officer.
//
// The drawer in the queue stays: it is the right tool for a triage pass, where
// you are moving through thirty rows and want the next one without losing your
// place. It is the wrong tool for the other half of the job -- reading the
// history, comparing before and after evidence at a size you can judge, and
// deciding. A 420px slide-over makes you scroll for all of that.
//
// So this is the same record given room, with the decisions in a rail that
// stays put while the evidence scrolls.
//
// Nothing here duplicates the drawer's logic: both call the same API functions,
// so an action taken in either behaves identically.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import SlaBadge from '../../components/dashboard/SlaBadge';
import ConfidenceBadge from '../../components/dashboard/ConfidenceBadge';
import FeedbackPanel from '../../components/dashboard/FeedbackPanel';
import EvidencePanel from '../../components/dashboard/EvidencePanel';
import AiVerificationPanel from '../../components/officer/AiVerificationPanel';
import ComplaintMap from '../../components/map/ComplaintMap';
import Toast from '../../components/dashboard/Toast';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import {
  IconArrowLeft, IconMapPin, IconUsers, IconClock, IconSparkles, IconExternal,
  IconAlertTriangle,
} from '../../components/dashboard/icons';
import {
  getComplaint, getComplaintHistory, getComplaintMedia, getComplaintFeedback,
  assignFieldWorker, updateComplaintStatus, overrideSeverity,
} from '../../api/complaints';
import { listFieldWorkers } from '../../api/workers';
import { splitEvidence } from '../../lib/evidence';
import useAsync from '../../hooks/useAsync';
import useAllowedStatuses from '../../hooks/useAllowedStatuses';
import useActionError from '../../hooks/useActionError';
import OwningOfficer from '../../components/dashboard/OwningOfficer';

// Mirrors the queue's ordering, lowest first.
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

function stamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function Card({ title, action, children, className = '' }) {
  return (
    <section className={`bg-surface rounded-2xl border border-line shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          {title && <h2 className="font-display text-[15px] font-bold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function OfficerComplaintView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: complaint, error, loading, refetch } = useAsync(() => getComplaint(id), [id]);

  const [history, setHistory] = useState([]);
  const [media, setMedia] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [nonce, setNonce] = useState(0);

  const [workers, setWorkers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const { failure, report: reportFailure, clear: clearFailure } = useActionError();

  // Which moves are legal on this complaint for this officer, right now. Asked
  // of the server because half the rule -- what the lifecycle permits from the
  // current status -- is not something the client can know.
  const {
    allowed: settableNow, transitions, loading: statusesLoading,
    stale: statusesStale, reasonFor, refetch: refetchAllowed,
  } = useAllowedStatuses(complaint?.id, {
    role: 'municipal_officer', status: complaint?.status,
  });

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      getComplaintHistory(id), getComplaintMedia(id), getComplaintFeedback(id),
    ]).then(([h, m, f]) => {
      if (!alive) return;
      if (h.status === 'fulfilled') setHistory(h.value);
      if (m.status === 'fulfilled') setMedia(m.value);
      if (f.status === 'fulfilled') setFeedback(f.value || []);
    });
    return () => { alive = false; };
  }, [id, nonce]);

  useEffect(() => {
    let alive = true;
    // Workers load separately: a failure here disables assignment rather than
    // blanking the record.
    listFieldWorkers().then((w) => alive && setWorkers(w)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const timeline = useMemo(
    () => [...history].sort((a, b) => new Date(b.at) - new Date(a.at)),
    [history],
  );

  const { before, after } = useMemo(
    () => splitEvidence(media, complaint?.reportedAt, complaint?.citizenId),
    [media, complaint],
  );

  const run = useCallback(async (fn, message) => {
    setBusy(true);
    clearFailure();
    try {
      await fn();
      setToast(message);
      await refetch();
      refetchAllowed();
      setNonce((n) => n + 1);
    } catch (err) {
      const described = reportFailure(err);
      // 409 means the complaint is not where this screen thinks it is. Pull the
      // record and the legal moves again so the buttons match reality before
      // the officer presses another one.
      if (described?.recoverable) {
        await refetch();
        refetchAllowed();
        setNonce((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  }, [refetch, refetchAllowed, clearFailure, reportFailure]);

  if (loading) {
    return <div className="max-w-[1240px] mx-auto"><LoadingPanel label="Loading the complaint…" variant="detail" /></div>;
  }
  if (error) {
    return (
      <div className="max-w-[1240px] mx-auto space-y-4">
        <Link to="/officer/complaints" className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink">
          <IconArrowLeft size={16} /> Back to the queue
        </Link>
        <ErrorPanel error={error} onRetry={refetch} />
      </div>
    );
  }
  if (!complaint) return null;

  // Every move legal from here, and the subset this officer may make. The
  // difference is the interesting part: it is why a button is greyed out.
  const nextSteps = transitions.filter((s) => s !== complaint.status);
  const blocked = nextSteps.filter((s) => !settableNow.includes(s));

  const assigned = workers.find((w) => w.id === complaint.fieldWorkerId);

  return (
    <div className="max-w-[1240px] mx-auto space-y-5 animate-rise-in">
      <Toast message={toast} tone="success" onDismiss={() => setToast('')} />
      <Toast
        message={failure?.message}
        heading={failure?.heading}
        tone={failure?.tone || 'error'}
        onDismiss={clearFailure}
        autoHideMs={0}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => navigate('/officer/complaints')}
          className="focus-ring inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink rounded transition-colors"
        >
          <IconArrowLeft size={16} /> Back to the queue
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap mt-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-bold text-ink leading-tight">
              {complaint.issue}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="font-mono text-[12px] text-ink-faint">{complaint.id}</span>
              <span className="text-line" aria-hidden="true">·</span>
              <StatusBadge status={complaint.status} />
              <SeverityBadge severity={complaint.severity} />
              <SlaBadge complaint={complaint} showDate />
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        {/* ── The record ───────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">
          <Card title="Reported">
            <p className="text-[14.5px] text-ink-body leading-relaxed">{complaint.description}</p>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-5 pt-4 border-t border-line">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Category</dt>
                <dd className="text-[13.5px] text-ink font-medium mt-0.5">{complaint.category}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Department</dt>
                <dd className="text-[13.5px] text-ink font-medium mt-0.5">{complaint.department || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Reported</dt>
                <dd className="text-[13.5px] text-ink font-medium mt-0.5">{stamp(complaint.reportedAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Location</dt>
                <dd className="text-[13.5px] text-ink font-medium mt-0.5 flex items-center gap-1.5">
                  <IconMapPin size={13} className="text-ink-faint shrink-0" />
                  {complaint.location}
                </dd>
              </div>
            </dl>
          </Card>

          {complaint.coords && (
            <Card
              title="Where"
              action={(
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${complaint.coords.latitude},${complaint.coords.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex items-center gap-1.5 text-[13px] font-semibold text-leaf-700 hover:underline rounded"
                >
                  Directions <IconExternal size={13} />
                </a>
              )}
              className="overflow-hidden"
            >
              <ComplaintMap complaints={[complaint]} height="280px" />
            </Card>
          )}

          <Card title="Evidence">
            <EvidencePanel
              complaintId={complaint.id}
              reportPhotos={before}
              resolutionPhotos={after}
              canUpload={false}
              onUploaded={() => setNonce((n) => n + 1)}
            />
            {/* The machine's read on the completion photo, below the photos
                themselves, because the officer's own eyes are the evidence. */}
            {after.length > 0 && (
              <AiVerificationPanel
                complaint={complaint}
                beforePhotos={before}
                afterPhotos={after}
                busy={busy}
              />
            )}
          </Card>

          <FeedbackPanel items={feedback} audience="officer" />

          <Card title="History">
            {timeline.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Nothing recorded yet.</p>
            ) : (
              <ol className="space-y-3">
                {timeline.map((h, i) => (
                  <li key={h.id || i} className="flex gap-3">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-leaf-500 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <StatusBadge status={h.status} />
                        <span className="text-[11.5px] text-ink-faint">{stamp(h.at)}</span>
                      </div>
                      {h.remarks && (
                        <p className="text-[13px] text-ink-body leading-snug mt-1">{h.remarks}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* ── Decisions ────────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <Card title="Assignment">
            {/* Two different people, and the difference matters. The officer
                owns the complaint -- escalation, resolution and breach notices
                are addressed to them -- while the field worker is who actually
                goes out. Until officerId was set at filing this was almost
                always empty, which is why it was not shown at all. */}
            <div className="mb-3 pb-3 border-b border-line">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                Owning officer
              </span>
              <OwningOfficer officerId={complaint.officerId} department={complaint.department} />
            </div>

            {assigned ? (
              <p className="flex items-center gap-2 text-[13.5px] text-ink mb-3">
                <IconUsers size={14} className="text-teal-600 shrink-0" />
                <span className="font-medium">{assigned.name}</span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-[12.5px] text-caution-800 bg-caution-50 border border-caution-100 rounded-lg px-3 py-2 mb-3">
                <IconAlertTriangle size={13} className="shrink-0 mt-0.5" />
                Nobody is assigned — the delay is dispatch, not the work.
              </p>
            )}

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1.5" htmlFor="assign-to">
              {assigned ? 'Reassign to' : 'Assign to'}
            </label>
            <select
              id="assign-to"
              disabled={busy || workers.length === 0}
              defaultValue=""
              onChange={(e) => {
                const w = workers.find((x) => x.id === e.target.value);
                if (w) run(() => assignFieldWorker(complaint.id, w.id), `Assigned to ${w.name}.`);
              }}
              className="w-full bg-surface rounded-lg border border-line px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/15 disabled:opacity-50"
            >
              <option value="">Choose a field worker…</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}{w.skillSet ? ` — ${w.skillSet}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11.5px] text-ink-faint mt-2 leading-snug">
              A worker whose skills do not cover {complaint.department || 'this department'} will
              be refused.
            </p>
          </Card>

          <Card title="Status">
            {/* An empty set means two different things: still asking, or
                genuinely nowhere left to go. Saying the second while the first
                is true tells an officer the complaint is closed when it is not. */}
            {statusesLoading ? (
              <p className="text-[12.5px] text-ink-faint leading-snug">
                Checking which moves are valid…
              </p>
            ) : nextSteps.length === 0 ? (
              <p className="text-[12.5px] text-ink-muted leading-snug">
                Nothing moves from {complaint.status.toLowerCase()} — this complaint has
                reached the end of its lifecycle.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {nextSteps.map((s) => {
                  const mine = settableNow.includes(s);
                  return (
                    <button
                      key={s}
                      disabled={busy || !mine}
                      title={mine ? undefined : reasonFor(s) || undefined}
                      onClick={() => run(
                        () => updateComplaintStatus(complaint.id, s, null),
                        `Marked ${s}.`,
                      )}
                      className="focus-ring text-[12.5px] font-semibold px-3 py-2 rounded-lg border border-line bg-surface hover:border-leaf-400 hover:bg-surface-inset disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Shown rather than hidden: a greyed-out "Verified" says the work
                is done and the citizen has not signed off yet, which is a
                different thing from the button not existing. */}
            {blocked.length > 0 && (
              <ul className="mt-3 space-y-1">
                {blocked.map((s) => (
                  <li key={s} className="text-[11.5px] text-ink-faint leading-snug">
                    <span className="font-semibold text-ink-muted">{s}</span>
                    {' — '}{reasonFor(s) || 'not available to you'}.
                  </li>
                ))}
              </ul>
            )}

            {statusesStale && (
              <p className="text-[11.5px] text-caution-700 mt-3 leading-snug">
                Could not check which moves are valid, so these are the ones your role
                can ever make. Some may be refused as out of order.
              </p>
            )}
          </Card>

          <Card title="Severity">
            <div className="flex gap-2 flex-wrap">
              {SEVERITIES.filter((s) => s !== complaint.severity).map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => run(
                    () => overrideSeverity(complaint.id, s, 'Reviewed by an officer.'),
                    `Severity set to ${s}.`,
                  )}
                  className="focus-ring text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border border-line bg-surface hover:border-leaf-400 disabled:opacity-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-ink-faint mt-2.5 leading-snug">
              Severity sets the deadline, so changing it moves the date this is due by.
            </p>
          </Card>

          {complaint.ai && (
            <Card title="AI triage">
              <div className="flex items-center gap-2 mb-3">
                <IconSparkles size={14} className="text-leaf-600" />
                <ConfidenceBadge value={complaint.ai.confidence} />
              </div>
              <dl className="space-y-2 text-[12.5px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Suggested</dt>
                  <dd className="text-ink font-medium text-right">
                    {complaint.ai.suggestedCategory || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Severity</dt>
                  <dd className="text-ink font-medium">{complaint.ai.severity || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Engine</dt>
                  <dd className="text-ink font-medium">{complaint.ai.source || '—'}</dd>
                </div>
                {complaint.ai.analyzedAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Analysed</dt>
                    <dd className="text-ink-body">{stamp(complaint.ai.analyzedAt)}</dd>
                  </div>
                )}
              </dl>
              <p className="text-[11.5px] text-ink-faint mt-3 leading-snug">
                A recommendation. The category on the record is whatever a person last set.
              </p>
            </Card>
          )}

          {complaint.hoursRemaining !== null && (
            <Card title="Deadline">
              <p className="flex items-center gap-2 text-[13px] text-ink-body">
                <IconClock size={14} className="text-ink-faint shrink-0" />
                <SlaBadge complaint={complaint} showDate />
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
