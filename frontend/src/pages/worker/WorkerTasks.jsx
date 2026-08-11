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
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import TaskDrawer from '../../components/worker/TaskDrawer';
import Toast from '../../components/dashboard/Toast';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import {
  IconMapPin, IconClipboard, IconCheckCircle, IconClock, IconRefresh, IconArrowRight,
} from '../../components/dashboard/icons';
import { listMyTasks, updateComplaintStatus } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';
import { TERMINAL_STATUSES } from '../../api/mappers';

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

function TaskCard({ task, busy, onQuick, onOpen }) {
  const action = primaryAction(task.status);
  const days = ageInDays(task.reportedAt);
  const urgent = task.severity === 'Critical' || task.severity === 'High';
  const mapsUrl = task.coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${task.coords.latitude},${task.coords.longitude}`
    : null;

  return (
    <li
      className={`bg-surface rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${
        urgent ? 'border-l-[3px] border-l-danger-600 border-line' : 'border-line'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-ink leading-snug">{task.issue}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <SeverityBadge severity={task.severity} />
              <StatusBadge status={task.status} />
              {days !== null && days >= 7 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-caution-700">
                  <IconClock size={11} /> open {days} days
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-[13px] text-ink-body leading-relaxed mt-2.5 line-clamp-2">
          {task.description}
        </p>

        <div className="flex items-start gap-1.5 text-[13px] text-ink-muted mt-2.5">
          <IconMapPin size={14} className="text-ink-faint mt-0.5 shrink-0" />
          <span className="min-w-0">{task.location}</span>
        </div>
        <div className="text-[11px] text-ink-faint mt-1 ml-[22px]">
          {task.category} · reported {ageLabel(days)}
        </div>
      </div>

      {/* Action bar. Targets are ≥44px tall — this is tapped with a thumb,
          sometimes through a glove. */}
      <div className="flex items-stretch border-t border-line divide-x divide-line">
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-ink-body hover:bg-surface-inset transition-colors"
          >
            <IconMapPin size={15} /> Navigate
          </a>
        )}
        <button
          onClick={() => onOpen(task.id)}
          className="focus-ring flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-ink-body hover:bg-surface-inset transition-colors"
        >
          Details
        </button>
        {canHold(task.status) && (
          <button
            onClick={() => onQuick(task, { next: 'On Hold' })}
            disabled={busy}
            className="focus-ring flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold text-caution-700 hover:bg-caution-50 transition-colors disabled:opacity-50"
          >
            Hold
          </button>
        )}
        {action && (
          <button
            onClick={() => (action.direct ? onQuick(task, action) : onOpen(task.id))}
            disabled={busy}
            className={`focus-ring flex-[1.4] flex items-center justify-center gap-2 py-3 text-[13px] font-bold transition-colors disabled:opacity-50 ${TONE_BTN[action.tone]}`}
          >
            {action.label} <IconArrowRight size={14} />
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
        {tasks.map((t) => <TaskCard key={t.id} task={t} {...cardProps} />)}
      </ul>
    </section>
  );
}

export default function WorkerTasks() {
  const { data, error, loading, refetch, setData } = useAsync(() => listMyTasks(), []);
  const items = useMemo(() => data || [], [data]);

  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState('success');
  const [busy, setBusy] = useState(false);
  const selected = items.find((t) => t.id === selectedId) || null;

  // Severity first, then oldest — the two things that decide what a worker
  // should do next.
  const order = useCallback((a, b) => {
    const rank = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    return rank !== 0 ? rank : new Date(a.reportedAt) - new Date(b.reportedAt);
  }, []);

  const groups = useMemo(() => {
    const active = items.filter((t) => t.status === 'In Progress').sort(order);
    const next = items
      .filter((t) => ['Assigned', 'Reopened', 'On Hold', 'Escalated'].includes(t.status))
      .sort(order);
    // Submitted work is not "done" from the worker's point of view — it can
    // come back if the citizen reopens it, so it gets its own group rather than
    // being filed away with verified work.
    const awaiting = items.filter((t) => t.status === 'Resolved')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const done = items
      .filter((t) => TERMINAL_STATUSES.includes(t.status))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return { active, next, awaiting, done };
  }, [items, order]);

  const applyUpdate = useCallback((updated) => {
    setData((list) => (list || []).map((t) => (t.id === updated.id ? updated : t)));
  }, [setData]);

  const say = (msg, tone = 'success') => { setToast(msg); setToastTone(tone); };

  const handleStatusChange = async (id, status, remarks) => {
    setBusy(true);
    try {
      applyUpdate(await updateComplaintStatus(id, status, remarks));
      say(status === 'Resolved'
        ? `${id} submitted for review.`
        : `${id} marked as ${status}.`);
      setSelectedId(null);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') say(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

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
        <button
          onClick={refetch}
          className="focus-ring lift inline-flex items-center gap-2 bg-surface border border-line hover:border-civic-400 text-ink-body font-semibold text-[13px] px-3.5 py-2.5 rounded-lg shadow-sm transition-all"
        >
          <IconRefresh size={15} /> Refresh
        </button>
      </header>

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
      ) : (
        <div className="space-y-6">
          {/* What you are standing in front of, first. */}
          <Group
            title="In progress"
            hint="Started, not finished"
            tasks={groups.active}
            busy={busy}
            onQuick={handleQuick}
            onOpen={setSelectedId}
          />
          <Group
            title="Up next"
            hint="Most urgent first"
            tasks={groups.next}
            busy={busy}
            onQuick={handleQuick}
            onOpen={setSelectedId}
          />
          <Group
            title="Awaiting review"
            hint="Submitted — an officer or the citizen confirms it"
            tasks={groups.awaiting}
            busy={busy}
            onQuick={handleQuick}
            onOpen={setSelectedId}
          />
        </div>
      )}

      {/* Completed work stays reachable but out of the way — it is reference,
          not a to-do. */}
      {groups.done.length > 0 && (
        <details className="bg-surface rounded-xl border border-line shadow-sm">
          <summary className="focus-ring cursor-pointer px-4 py-3 text-[13px] font-semibold text-ink-body hover:bg-surface-inset transition-colors rounded-xl">
            Completed ({groups.done.length})
          </summary>
          <ul className="border-t border-line divide-y divide-line">
            {groups.done.slice(0, 10).map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className="focus-ring w-full text-left px-4 py-3 hover:bg-surface-inset transition-colors flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink truncate">{t.issue}</div>
                    <div className="text-[11px] text-ink-faint font-mono mt-0.5">{t.id}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {selected && (
        <TaskDrawer
          task={selected}
          busy={busy}
          readOnly={TERMINAL_STATUSES.includes(selected.status)}
          onDismiss={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
