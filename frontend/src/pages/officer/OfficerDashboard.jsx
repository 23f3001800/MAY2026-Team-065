// Municipal officer overview — the operations command view.
//
// Data source is GET /complaints/ (officers receive every complaint) plus
// GET /workers/. Note that /admin/analytics is NOT usable here: main.py:311
// rejects any role other than administrator, so an officer has no server-side
// analytics endpoint at all. Every figure on this page is therefore aggregated
// from the full record set by lib/complaintMetrics and labelled "Derived"
// rather than "Verified" — see docs/BACKEND_ANALYTICS_REQUESTS.md.
//
// Two things this deliberately does NOT show, because the data cannot support
// them honestly: average resolution time (no resolution timestamp exists;
// updatedAt moves on any edit) and period-over-period comparison (no historical
// snapshot). Both render as "insufficient verified data".
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import MetricCard from '../../components/metrics/MetricCard';
import OperationsBrief from '../../components/metrics/OperationsBrief';
import Provenance from '../../components/metrics/Provenance';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconRefresh, IconArrowRight, IconUsers, IconClock } from '../../components/dashboard/icons';
import { getCurrentUser } from '../../api/auth';
import { listComplaints } from '../../api/complaints';
import { listFieldWorkers } from '../../api/workers';
import useAsync from '../../hooks/useAsync';
import { computeMetrics, ranked } from '../../lib/complaintMetrics';

const AVAILABILITY = {
  Available: { text: 'text-teal-700', dot: 'bg-teal-500' },
  'Off Duty': { text: 'text-ink-faint', dot: 'bg-ink-faint' },
  Busy: { text: 'text-caution-700', dot: 'bg-caution-500' },
};

function Availability({ status }) {
  const s = AVAILABILITY[status] || AVAILABILITY['Off Duty'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {status}
    </span>
  );
}

async function loadDashboard() {
  // Workers are secondary: if that call fails the dashboard is still useful,
  // so it is caught rather than allowed to reject the whole load.
  const complaints = await listComplaints();
  const workers = await listFieldWorkers().catch(() => null);
  return { complaints, workers, loadedAt: new Date() };
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
      <div>
        <h2 className="font-display text-[15px] font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-[12px] text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default function OfficerDashboard() {
  const user = getCurrentUser();
  const { data, error, loading, refetch } = useAsync(loadDashboard, []);

  const metrics = useMemo(() => computeMetrics(data?.complaints), [data]);

  const recent = useMemo(() => {
    if (!data?.complaints) return [];
    return [...data.complaints]
      .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
      .slice(0, 6);
  }, [data]);

  const topCategories = useMemo(() => ranked(metrics.byCategory, 5), [metrics]);

  const firstName = (user?.name || 'there').split(' ')[0];
  const asOf = data?.loadedAt
    ? data.loadedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-5">
        <LoadingPanel label="Loading operations data…" variant="stats" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <ErrorPanel error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-6 animate-rise-in">
      {/* Page header */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[26px] font-bold text-ink leading-tight">
            Good day, {firstName}
          </h1>
          <p className="text-[14px] text-ink-muted mt-1">
            Every complaint across the city, and what needs you first.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {asOf && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint">
              <IconClock size={13} /> Loaded {asOf}
            </span>
          )}
          <button
            onClick={refetch}
            className="focus-ring lift inline-flex items-center gap-2 bg-surface border border-line hover:border-civic-400 text-ink-body font-semibold text-[13px] px-3.5 py-2 rounded-lg shadow-sm transition-all"
          >
            <IconRefresh size={15} /> Refresh
          </button>
        </div>
      </header>

      {/* Metrics. Resolution rate carries its own arithmetic; the two the data
          cannot support pass null and render the insufficient state. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Total Complaints"
          value={metrics.total}
          provenance="derived"
          tone="neutral"
          footnote="Counted from the full record set"
          formula={`${metrics.total} complaints returned by GET /complaints/`}
        />
        <MetricCard
          label="Open"
          value={metrics.open}
          context={`${metrics.untriaged} awaiting triage`}
          provenance="derived"
          tone={metrics.open > metrics.closed ? 'caution' : 'neutral'}
          formula={`${metrics.total} total − ${metrics.closed} closed (Verified or Rejected) = ${metrics.open} open`}
        />
        <MetricCard
          label="Resolved"
          value={metrics.resolved}
          provenance="derived"
          tone="positive"
          formula={`Complaints with status Resolved or Verified = ${metrics.resolved}`}
        />
        <MetricCard
          label="Resolution Rate"
          value={metrics.resolutionRate === null ? null : Number(metrics.resolutionRate.toFixed(1))}
          unit="%"
          context={metrics.resolutionRate === null ? null : `${metrics.resolved} / ${metrics.total}`}
          provenance="derived"
          tone="positive"
          formula={
            metrics.resolutionRate === null
              ? undefined
              : `${metrics.resolved} resolved ÷ ${metrics.total} total × 100 = ${metrics.resolutionRate.toFixed(1)}%`
          }
        />
      </div>

      <OperationsBrief metrics={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Recent intake */}
        <section className="lg:col-span-2">
          <SectionHeader
            title="Latest complaints"
            subtitle="Newest first, across every department"
            action={
              <Link
                to="/officer/complaints"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-civic-700 hover:underline"
              >
                Open the queue <IconArrowRight size={14} />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyPanel title="No complaints yet" message="Nothing has been reported to the city." />
          ) : (
            <ul className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden divide-y divide-line">
              {recent.map((c, i) => (
                <li key={c.id} style={{ '--i': i }} className="animate-rise-in stagger">
                  <Link
                    to={`/complaints/${c.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface-inset transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-ink truncate">{c.issue}</div>
                      <div className="flex items-center gap-2 mt-1 text-[12px] text-ink-muted">
                        <span className="font-mono text-ink-faint">{c.id}</span>
                        <span>·</span>
                        <span className="truncate">{c.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SeverityBadge severity={c.severity} />
                      <StatusBadge status={c.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          {/* Category mix — counts, not percentages of a guessed whole. */}
          <section>
            <SectionHeader title="Category mix" subtitle={`${metrics.total} complaints`} />
            <div className="bg-surface rounded-xl border border-line shadow-sm p-4">
              {topCategories.top.length === 0 ? (
                <p className="text-[13px] text-ink-muted text-center py-4">
                  Insufficient verified data for this breakdown.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topCategories.top.map(([name, count]) => {
                    const pct = metrics.total ? (count / metrics.total) * 100 : 0;
                    return (
                      <li key={name}>
                        <div className="flex items-baseline justify-between gap-2 text-[13px]">
                          <span className="text-ink-body truncate">{name}</span>
                          <span className="text-ink font-semibold tnum shrink-0">
                            {count}
                            <span className="text-ink-faint font-normal ml-1">
                              ({pct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-surface-inset overflow-hidden">
                          <div
                            className="h-full rounded-full bg-civic-600 origin-left animate-grow-x"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                  {topCategories.restCount > 0 && (
                    <li className="text-[12px] text-ink-faint pt-1">
                      + {topCategories.restCount} in other categories
                    </li>
                  )}
                </ul>
              )}
            </div>
          </section>

          {/* Field workers */}
          <section>
            <SectionHeader
              title="Field workers"
              action={
                <Link to="/officer/workers" className="text-[13px] font-semibold text-civic-700 hover:underline">
                  All
                </Link>
              }
            />
            <div className="bg-surface rounded-xl border border-line shadow-sm p-4">
              {!data?.workers ? (
                <div className="flex items-start gap-2 text-[12px] text-caution-700">
                  <IconUsers size={14} className="mt-0.5 shrink-0" />
                  Worker roster could not be loaded.
                </div>
              ) : data.workers.length === 0 ? (
                <p className="text-[13px] text-ink-muted">No field workers registered yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.workers.slice(0, 5).map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink truncate">{w.name}</div>
                        <div className="text-[11px] text-ink-faint truncate">{w.skill}</div>
                      </div>
                      <Availability status={w.availability} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Named absence, rather than a tile that quietly never appears. */}
          <section className="bg-surface rounded-xl border border-line shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="font-display text-[14px] font-bold text-ink">Resolution time</h2>
              <Provenance level="insufficient" />
            </div>
            <p className="text-[12px] text-ink-muted leading-relaxed">
              No resolution timestamp exists on a complaint — <code className="font-mono text-[11px]">updatedAt</code> changes
              on any edit, so deriving an average from it would be wrong rather than approximate.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
