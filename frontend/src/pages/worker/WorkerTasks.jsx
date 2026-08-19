// My Tasks — the field worker's working screen.
//
// Designed for the actual context: a phone, outdoors, often one-handed, often
// in sunlight, sometimes wearing gloves. That drives most of what follows.
//
// The old version had two defects beyond looks:
//
//   1. It filtered to ['New', 'Assigned'], so the moment a worker started a job
//      it VANISHED from their list. The task they were standing in front of was
//      the one they could no longer see.
//   2. Every action cost two taps and a modal — open the drawer, find a
//      dropdown, pick a status, submit. On a phone at a roadside that is the
//      difference between updating status and not bothering.
//
// So: each card carries ONE primary action derived from its status, and the
// grouping answers "what am I doing right now / what's next / what's done".
// Resolution still opens the drawer because it needs photo evidence, but
// starting, resuming and navigating are one tap.
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import Toast from '../../components/dashboard/Toast';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import {
  IconMapPin, IconClipboard, IconCheckCircle, IconClock, IconRefresh, IconArrowRight,
  IconCrosshair,
} from '../../components/dashboard/icons';
import SlaBadge from '../../components/dashboard/SlaBadge';
import { listMyTasks, updateComplaintStatus } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';
import { TERMINAL_STATUSES } from '../../api/mappers';
import ComplaintMap from '../../components/map/ComplaintMap';

const SEVERITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const DAY_MS = 86400000;

function ageInDays(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / DAY_MS);
}

function ageLabel(days) {
  if (days === null) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/**
 * The one thing this task needs from the worker right now.
 *
 * The worker's path is: accept -> In Progress (or park it On Hold) -> submit
 * evidence -> Resolved.
 *
 * "Resolved" is the awaiting-review state, not the end of the story. The
 * obvious-sounding UNDER_REVIEW is OFFICIAL_ONLY in services/lifecycle.py and
 * would 403 from a worker, and VERIFIED is deliberately the citizen's call —
 * they are the only party who can confirm the problem is actually gone. So the
 * worker reports Resolved and the UI says "submitted for review", which is what
 * it means to everyone downstream.
 *
 * `direct` transitions apply on a single tap. Submitting is NOT direct: it
 * needs photo evidence, so it routes through the drawer.
 */
function primaryAction(status) {
  switch (status) {
    case 'Assigned':
    case 'Reopened':
      return { label: 'Accept task', next: 'In Progress', direct: true, tone: 'civic' };
    case 'In Progress':
      return { label: 'Submit for review', next: 'Resolved', direct: false, tone: 'teal' };
    case 'On Hold':
      return { label: 'Resume', next: 'In Progress', direct: true, tone: 'civic' };
    case 'Escalated':
      return { label: 'Add update', next: null, direct: false, tone: 'caution' };
    default:
      return null;
  }
}

// Parking a job is a real field outcome — blocked access, missing part, weather.
// It sits beside the primary action rather than inside a menu.
function canHold(status) {
  return status === 'In Progress';
}

const TONE_BTN = {
  civic: 'bg-civic-700 hover:bg-civic-800 text-white',
  teal: 'bg-teal-600 hover:bg-teal-700 text-white',
  caution: 'bg-caution-600 hover:bg-caution-700 text-white',
};

function TaskCard({ task, busy, onQuick, onOpen, index = 0 }) {
  const action = primaryAction(task.status);
  const days = ageInDays(task.reportedAt);
  const active = task.status === 'In Progress';
  const mapsUrl = task.coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${task.coords.latitude},${task.coords.longitude}`
    : null;

  return (
    <li
      style={{ '--i': index }}
      className={`group relative bg-surface rounded-2xl border shadow-sm overflow-hidden
        animate-rise-in stagger transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
        ${active ? 'border-civic-300 ring-1 ring-civic-100' : 'border-line'}`}
    >
      {/* Severity rail. A delivery app tells you at a glance which drop is the
          urgent one without reading anything — this is that. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-1 ${
          task.severity === 'Critical' ? 'bg-danger-600'
          : task.severity === 'High' ? 'bg-caution-500'
          : task.severity === 'Medium' ? 'bg-civic-400'
          : 'bg-teal-500'}`}
      />

      <div className="pl-5 pr-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <StatusBadge status={task.status} />
              {active && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-civic-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-600 animate-pulse-dot" />
                  on this now
                </span>
              )}
              {days !== null && days >= 7 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-caution-700">
                  <IconClock size={10} /> {days}d waiting
                </span>
              )}
            </div>
            <h3 className="text-[17px] font-semibold text-ink leading-snug tracking-[-0.01em]">{task.issue}</h3>
          </div>
          <SeverityBadge severity={task.severity} className="shrink-0 mt-0.5" />
        </div>

        <p className="text-[13px] text-ink-body leading-relaxed mt-2 line-clamp-2">
          {task.description}
        </p>

        {/* Address block, styled like a delivery drop: the destination is the
            thing you scan for, so it gets its own surface rather than being a
            grey line of metadata. */}
        <div className="flex items-start gap-2.5 mt-3 rounded-xl bg-surface-inset px-3 py-2.5">
          <span className="w-7 h-7 rounded-lg bg-surface border border-line flex items-center justify-center shrink-0 mt-0.5">
            <IconMapPin size={14} className="text-civic-600" />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink leading-snug">{task.location}</div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted bg-surface border border-line rounded px-1.5 py-0.5">
                {task.category}
              </span>
              {/* Only present when the list was ordered by distance -- a figure
                  with no point of origin would be meaningless. */}
              {task.distanceKm !== null && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-civic-700">
                  <IconCrosshair size={11} />
                  {task.distanceKm < 1
                    ? `${Math.round(task.distanceKm * 1000)} m away`
                    : `${task.distanceKm.toFixed(1)} km away`}
                </span>
              )}
              <span className="text-[11px] text-ink-faint">reported {ageLabel(days)}</span>
            </div>
            <SlaBadge complaint={task} showDate className="mt-1.5" />
          </div>
        </div>
      </div>

      {/* Action bar. Full-bleed, ≥48px, thumb-reachable — tapped outdoors,
          often through a glove. */}
      <div className="flex items-stretch border-t border-line divide-x divide-line">
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-semibold text-ink-body hover:bg-surface-inset active:bg-line transition-colors"
          >
            <IconMapPin size={15} /> Navigate
          </a>
        )}
        <button
          onClick={() => onOpen(task.id)}
          className="focus-ring flex-1 flex items-center justify-center py-3.5 text-[13px] font-semibold text-ink-body hover:bg-surface-inset active:bg-line transition-colors"
        >
          Details
        </button>
        {canHold(task.status) && (
          <button
            onClick={() => onQuick(task, { next: 'On Hold' })}
            disabled={busy}
            className="focus-ring flex-1 flex items-center justify-center py-3.5 text-[13px] font-semibold text-caution-700 hover:bg-caution-50 active:bg-caution-100 transition-colors disabled:opacity-50"
          >
            Hold
          </button>
        )}
        {action && (
          <button
            onClick={() => (action.direct ? onQuick(task, action) : onOpen(task.id))}
            disabled={busy}
            className={`focus-ring flex-[1.5] flex items-center justify-center gap-2 py-3.5 text-[13px] font-bold
              transition-all disabled:opacity-50 ${TONE_BTN[action.tone]}`}
          >
            {action.label}
            <IconArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </li>
  );
}

function Group({ title, hint, tasks, ...cardProps }) {
  if (!tasks.length) return null;
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2.5">
        <h2 className="font-display text-[15px] font-bold text-ink">{title}</h2>
        <span className="text-[12px] text-ink-faint tnum">{tasks.length}</span>
        {hint && <span className="text-[12px] text-ink-faint ml-auto">{hint}</span>}
      </div>
      <ul className="space-y-3">
        {tasks.map((t, i) => <TaskCard key={t.id} task={t} index={i} {...cardProps} />)}
      </ul>
    </section>
  );
}

export default function WorkerTasks() {
  const navigate = useNavigate();

  // Where the worker is, if the device will say. Held in state rather than
  // requested inside the fetch so a refresh does not re-prompt for permission,
  // and so "nearest first" can be offered only once a real position exists --
  // the backend refuses to sort by distance without one, which is the honest
  // behaviour but makes for a broken button if offered too early.
  const [origin, setOrigin] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  // 'urgency' = severity then age, the judgement call about what matters most.
  // 'distance' = server-ordered by how far away each job is, which is what
  // saves a shift's worth of travel.
  const [sortBy, setSortBy] = useState('urgency');

  const { data, error, loading, refetch, setData } = useAsync(
    () => listMyTasks(sortBy === 'distance' && origin ? { origin } : {}),
    [sortBy, origin],
  );
  const items = useMemo(() => data || [], [data]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError('This device cannot report a location.');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setSortBy('distance');
        setLocating(false);
      },
      (err) => {
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission is off, so tasks cannot be ordered by distance.'
            : 'Could not get a location fix.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState('success');
  const [busy, setBusy] = useState(false);
  // List or map over the SAME open tasks. This was a separate page, which meant
  // leaving your task list to find out where the tasks were.
  const [view, setView] = useState('list');
  // History was its own page. It is the same query and the same cards — only
  // the filter differs — so it is a scope here instead of a route.
  const [scope, setScope] = useState('active');

  // Severity first, then oldest — the two things that decide what a worker
  // should do next.
  const order = useCallback((a, b) => {
    const rank = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    return rank !== 0 ? rank : new Date(a.reportedAt) - new Date(b.reportedAt);
  }, []);

  const groups = useMemo(() => {
    // When the server ordered by distance, keep its order. Re-sorting by
    // severity here would silently throw away the thing the worker asked for.
    const byDistance = sortBy === 'distance' && origin;
    const arrange = (list) => (byDistance ? list : list.sort(order));

    const active = arrange(items.filter((t) => t.status === 'In Progress'));
    const next = arrange(items
      .filter((t) => ['Assigned', 'Reopened', 'On Hold', 'Escalated'].includes(t.status)));
    // Submitted work is not "done" from the worker's point of view — it can
    // come back if the citizen reopens it, so it gets its own group rather than
    // being filed away with verified work.
    const awaiting = items.filter((t) => t.status === 'Resolved')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const done = items
      .filter((t) => TERMINAL_STATUSES.includes(t.status))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return { active, next, awaiting, done };
  }, [items, order, sortBy, origin]);

  const applyUpdate = useCallback((updated) => {
    setData((list) => (list || []).map((t) => (t.id === updated.id ? updated : t)));
  }, [setData]);

  const say = (msg, tone = 'success') => { setToast(msg); setToastTone(tone); };


  // One-tap transition straight from the card.
  const handleQuick = async (task, action) => {
    setBusy(true);
    try {
      applyUpdate(await updateComplaintStatus(task.id, action.next, null));
      say(`${task.id} — ${action.next}.`);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') say(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openCount = groups.active.length + groups.next.length;

  return (
    <div className="max-w-[860px] mx-auto space-y-5 animate-rise-in">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] font-bold text-ink leading-tight">My Tasks</h1>
          <p className="text-[14px] text-ink-muted mt-1">
            {loading ? 'Loading…'
              : openCount === 0 ? 'Nothing open right now.'
              : `${openCount} job${openCount === 1 ? '' : 's'} to work through.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line overflow-hidden bg-surface" role="group" aria-label="Scope">
            {[['active', 'Active'], ['history', 'History']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setScope(k)}
                aria-pressed={scope === k}
                className={`focus-ring px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                  scope === k ? 'bg-civic-700 text-white' : 'text-ink-body hover:bg-surface-inset'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-line overflow-hidden bg-surface" role="group" aria-label="View">
            {['list', 'map'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`focus-ring px-3.5 py-2.5 text-[13px] font-semibold capitalize transition-colors ${
                  view === v ? 'bg-civic-700 text-white' : 'text-ink-body hover:bg-surface-inset'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {/* Nearest-first needs a real position: the backend refuses to sort
              by distance without one rather than quietly falling back to date
              order, so the control asks for a fix instead of pretending. */}
          <div className="inline-flex rounded-lg border border-line overflow-hidden bg-surface" role="group" aria-label="Order tasks">
            <button
              onClick={() => setSortBy('urgency')}
              aria-pressed={sortBy === 'urgency'}
              className={`focus-ring px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                sortBy === 'urgency' ? 'bg-civic-700 text-white' : 'text-ink-body hover:bg-surface-inset'
              }`}
            >
              Urgency
            </button>
            <button
              onClick={() => (origin ? setSortBy('distance') : locate())}
              aria-pressed={sortBy === 'distance'}
              disabled={locating}
              className={`focus-ring inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                sortBy === 'distance' ? 'bg-civic-700 text-white' : 'text-ink-body hover:bg-surface-inset'
              }`}
            >
              <IconCrosshair size={14} />
              {locating ? 'Locating…' : 'Nearest'}
            </button>
          </div>
          <button
            onClick={refetch}
            className="focus-ring lift inline-flex items-center gap-2 bg-surface border border-line hover:border-civic-400 text-ink-body font-semibold text-[13px] px-3.5 py-2.5 rounded-lg shadow-sm transition-all"
          >
            <IconRefresh size={15} /> Refresh
          </button>
        </div>
      </header>

      {locateError && (
        <p className="text-[13px] text-caution-800 bg-caution-50 border border-caution-100 rounded-lg px-3.5 py-2.5">
          {locateError}
        </p>
      )}

      <Toast message={toast} tone={toastTone} onDismiss={() => setToast('')} autoHideMs={toastTone === 'error' ? 0 : 4000} />

      {loading ? (
        <LoadingPanel label="Loading your tasks…" variant="cards" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyPanel
          icon={IconClipboard}
          title="No tasks assigned yet"
          message="When an officer assigns you a complaint it will appear here."
        />
      ) : openCount === 0 ? (
        <EmptyPanel
          icon={IconCheckCircle}
          title="All caught up"
          message={`Nothing open. ${groups.awaiting.length} awaiting review, ${groups.done.length} closed.`}
        />
      ) : scope === 'history' ? (
        // Everything ever assigned to this worker, newest first — a record you
        // can search, not just an archive of finished jobs.
        <div className="space-y-6">
          <Group
            title="Awaiting review"
            hint="Submitted — an officer or the citizen confirms it"
            tasks={groups.awaiting}
            busy={busy}
            onQuick={handleQuick}
            onOpen={(tid) => navigate(`/worker/tasks/${tid}`)}
          />
          <Group
            title="Closed"
            hint="Verified or rejected"
            tasks={groups.done}
            busy={busy}
            onQuick={handleQuick}
            onOpen={(tid) => navigate(`/worker/tasks/${tid}`)}
          />
          <Group
            title="Still open"
            hint="Also shown under Active"
            tasks={[...groups.active, ...groups.next]}
            busy={busy}
            onQuick={handleQuick}
            onOpen={(tid) => navigate(`/worker/tasks/${tid}`)}
          />
        </div>
      ) : view === 'map' ? (
        <ComplaintMap
          complaints={[...groups.active, ...groups.next]}
          height="560px"
          showMe
          onSelect={(c) => navigate(`/worker/tasks/${c.id}`)}
        />
      ) : (
        <div className="space-y-6">
          {/* What you are standing in front of, first. */}
          <Group
            title="In progress"
            hint="Started, not finished"
            tasks={groups.active}
            busy={busy}
            onQuick={handleQuick}
            onOpen={(tid) => navigate(`/worker/tasks/${tid}`)}
          />
          <Group
            title="Up next"
            hint="Most urgent first"
            tasks={groups.next}
            busy={busy}
            onQuick={handleQuick}
            onOpen={(tid) => navigate(`/worker/tasks/${tid}`)}
          />
        </div>
      )}


    </div>
  );
}
