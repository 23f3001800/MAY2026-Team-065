// Performance — the worker's own record.
//
// This is the missing half of "view personal task history and resolution
// performance statistics". History moved into Tasks as a scope, but the stats
// had nowhere to live, and a worker's completion record was only visible as a
// count on a dashboard tile.
//
// Everything here is counted from GET /complaints/worker/tasks, which the
// backend scopes to the signed-in worker — so it is their record, not the
// team's, and no other worker's numbers are reachable from here.
//
// Average resolution time is computed the expensive-but-correct way, from each
// task's status history, because this page is small enough to afford it: a
// worker has tens of tasks, not the thousands a city-wide view would.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import { BarList, Donut } from '../../components/charts';
import Provenance from '../../components/metrics/Provenance';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import {
  IconCheckCircle, IconClock, IconStar, IconArrowRight, IconClipboard,
} from '../../components/dashboard/icons';
import { listMyTasks } from '../../api/complaints';
import { computeResolutionTimes } from '../../lib/resolutionReport';
import { TERMINAL_STATUSES } from '../../api/mappers';
import useAsync from '../../hooks/useAsync';

const DAY_MS = 86400000;

function Stat({ label, value, sub, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'bg-leaf-50 text-leaf-700',
    positive: 'bg-teal-50 text-teal-700',
    caution: 'bg-caution-50 text-caution-700',
  };
  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-4">
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[22px] font-bold text-ink leading-none tnum">{value}</div>
          <div className="text-[12px] text-ink-muted mt-0.5">{label}</div>
        </div>
      </div>
      {sub && <div className="text-[11px] text-ink-faint mt-2">{sub}</div>}
    </div>
  );
}

export default function WorkerPerformance() {
  const { data, error, loading, refetch } = useAsync(() => listMyTasks(), []);
  const tasks = useMemo(() => data || [], [data]);

  const [timing, setTiming] = useState(null);
  const [timingProgress, setTimingProgress] = useState(null);

  // Resolution timing runs after the list lands. It is per-task requests, so it
  // is deliberately a second pass rather than blocking the whole page.
  useEffect(() => {
    if (!tasks.length) return undefined;
    let alive = true;
    computeResolutionTimes(tasks, {
      cap: 40,
      onProgress: (done, total) => alive && setTimingProgress({ done, total }),
    })
      .then((r) => { if (alive) { setTiming(r); setTimingProgress(null); } })
      .catch(() => { if (alive) setTimingProgress(null); });
    return () => { alive = false; };
  }, [tasks]);

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'Resolved' || TERMINAL_STATUSES.includes(t.status));
    const open = tasks.filter((t) => !TERMINAL_STATUSES.includes(t.status) && t.status !== 'Resolved');
    const verified = tasks.filter((t) => t.status === 'Verified');
    const reopened = tasks.filter((t) => t.status === 'Reopened');

    const byCategory = {};
    const bySeverity = {};
    for (const t of tasks) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
    }

    // Work closed in the last 30 days, as a rough recent-throughput signal.
    const cutoff = Date.now() - 30 * DAY_MS;
    const recent = done.filter((t) => new Date(t.updatedAt).getTime() >= cutoff).length;

    return { done, open, verified, reopened, byCategory, bySeverity, recent };
  }, [tasks]);

  if (loading) return <div className="max-w-[900px] mx-auto"><LoadingPanel label="Loading your record…" variant="stats" /></div>;
  if (error) return <div className="max-w-[900px] mx-auto"><ErrorPanel error={error} onRetry={refetch} /></div>;

  if (!tasks.length) {
    return (
      <div className="max-w-[900px] mx-auto">
        <EmptyPanel
          icon={IconClipboard}
          title="No record yet"
          message="Once tasks are assigned and completed, your performance shows up here."
        />
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto space-y-5 animate-rise-in">
      <header>
        <h1 className="font-display text-[26px] font-bold text-ink leading-tight">Performance</h1>
        <p className="text-[14px] text-ink-muted mt-1">
          Your own record — {tasks.length} task{tasks.length === 1 ? '' : 's'} assigned to you in total.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Completed" value={stats.done.length} tone="positive" icon={IconCheckCircle}
          sub={`${stats.recent} in the last 30 days`} />
        <Stat label="Still open" value={stats.open.length} tone="caution" icon={IconClock} />
        <Stat label="Confirmed by citizens" value={stats.verified.length} tone="positive" icon={IconStar}
          sub={stats.done.length ? `${Math.round((stats.verified.length / stats.done.length) * 100)}% of completed` : undefined} />
        <Stat label="Came back to you" value={stats.reopened.length}
          tone={stats.reopened.length ? 'caution' : 'neutral'} icon={IconArrowRight}
          sub={stats.reopened.length === 0 ? 'nothing reopened' : 'reopened after submission'} />
      </div>

      {/* Turnaround, from real history timestamps. */}
      <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-display text-[15px] font-bold text-ink">Turnaround</h2>
          <Provenance level={timing?.avgDays == null ? 'insufficient' : 'verified'}>
            {timing?.avgDays == null ? undefined : 'From status history'}
          </Provenance>
        </div>

        {timingProgress ? (
          <div className="mt-3">
            <p className="text-[12px] text-ink-muted mb-1.5">
              Reading task histories… {timingProgress.done}/{timingProgress.total}
            </p>
            <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
              <div className="h-full rounded-full bg-leaf-600 transition-[width] duration-200"
                style={{ width: `${(timingProgress.done / Math.max(timingProgress.total, 1)) * 100}%` }} />
            </div>
          </div>
        ) : timing?.avgDays == null ? (
          <p className="text-[13px] text-ink-muted mt-1">
            Not enough completed work with a readable history to measure turnaround yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {[
                ['Average', timing.avgDays],
                ['Median', timing.medianDays],
                ['Fastest', timing.fastest],
                ['Slowest', timing.slowest],
              ].map(([label, v]) => (
                <div key={label} className="bg-surface-inset rounded-lg px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
                  <div className="font-display text-[18px] font-bold text-ink mt-0.5 tnum">
                    {v < 1 ? `${Math.round(v * 24)}h` : `${v.toFixed(1)}d`}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-faint mt-2.5">
              Measured from report to your first "Resolved", across {timing.sampled} of {timing.eligible} completed tasks.
            </p>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
          <h2 className="font-display text-[15px] font-bold text-ink mb-3">Work by category</h2>
          <BarList
            data={Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])}
            total={tasks.length}
          />
        </section>
        <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
          <h2 className="font-display text-[15px] font-bold text-ink mb-3">By severity</h2>
          <Donut
            data={['Critical', 'High', 'Medium', 'Low']
              .map((s) => [s, stats.bySeverity[s] || 0])
              .filter(([, v]) => v > 0)}
            size={150}
            thickness={24}
            centerLabel="tasks"
          />
        </section>
      </div>

      <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="font-display text-[15px] font-bold text-ink">Recently completed</h2>
          <Link to="/worker/tasks" className="text-[13px] font-semibold text-leaf-700 hover:underline">
            All tasks
          </Link>
        </div>
        {stats.done.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Nothing completed yet.</p>
        ) : (
          <ul className="divide-y divide-line -my-2">
            {[...stats.done]
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
              .slice(0, 6)
              .map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/worker/tasks/${t.id}`}
                    className="focus-ring flex items-center gap-3 py-2.5 hover:bg-surface-inset -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-ink truncate">{t.issue}</div>
                      <div className="text-[11px] text-ink-faint font-mono mt-0.5">{t.id}</div>
                    </div>
                    <StatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
