// Municipal officer overview — the operations command view.
//
// Headline figures come from GET /analytics/overview — a real server-side
// aggregate, so they are labelled "Verified". Average resolution time is among
// them now that complaints carry `resolvedAt`; the old note here said no
// resolution timestamp existed, which was true until the backend added one.
//
// The charts below still aggregate the full record set in the browser via
// lib/complaintMetrics, and stay labelled "Derived". That is not an oversight:
// they need per-complaint detail (age buckets, category mix, the triage queue)
// that the overview endpoint does not carry, and mislabelling a browser
// aggregate as Verified would break the one promise this dashboard makes.
//
// If the analytics call fails the page still renders — tiles fall back to the
// derived figures and relabel themselves accordingly, rather than going blank.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import MetricCard from '../../components/metrics/MetricCard';
import OperationsBrief from '../../components/metrics/OperationsBrief';
import Provenance from '../../components/metrics/Provenance';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconRefresh, IconArrowRight, IconUsers, IconClock } from '../../components/dashboard/icons';
import { complaintPath } from '../../api/session';
import { listComplaints } from '../../api/complaints';
import { getOverview, getResolutionPerformance, getAging } from '../../api/analytics';
import { listFieldWorkers } from '../../api/workers';
import { formatHours, hoursAsMetric } from '../../lib/duration';
import useAsync from '../../hooks/useAsync';
import { computeMetrics, ranked, volumeSeries } from '../../lib/complaintMetrics';
import { BarList, TrendLine, Donut } from '../../components/charts';

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
  // Workers and analytics are secondary: if either call fails the dashboard is
  // still useful, so they are caught rather than allowed to reject the load.
  const complaints = await listComplaints();
  const [workers, overview, resolution, aging] = await Promise.all([
    listFieldWorkers().catch(() => null),
    getOverview().catch(() => null),
    getResolutionPerformance().catch(() => null),
    getAging().catch(() => null),
  ]);
  return { complaints, workers, overview, resolution, aging, loadedAt: new Date() };
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
  const { data, error, loading, refetch } = useAsync(loadDashboard, []);

  const metrics = useMemo(() => computeMetrics(data?.complaints), [data]);

  // Server figures when they arrived, browser figures when they did not. Kept
  // as an explicit pair rather than merged so each tile can label itself
  // honestly instead of the page claiming one provenance for everything.
  const server = data?.overview || null;
  const level = server ? 'verified' : 'derived';
  const avg = hoursAsMetric(server?.avgResolutionHours);

  // Turnaround and backlog age, straight from the server. Absorbed from what
  // was briefly a separate Performance page — it read as a second dashboard
  // over the same data, and an officer comparing turnaround against the queue
  // should not have to navigate between two screens to do it.
  const aging = data?.aging || null;
  const departments = useMemo(() => data?.resolution?.departments || [], [data]);
  const worstDept = useMemo(
    () => departments.reduce((m, d) => Math.max(m, d.avgHours), 0),
    [departments],
  );

  const recent = useMemo(() => {
    if (!data?.complaints) return [];
    return [...data.complaints]
      .sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt))
      .slice(0, 6);
  }, [data]);

  const topCategories = useMemo(() => ranked(metrics.byCategory, 5), [metrics]);
  const trend = useMemo(() => volumeSeries(data?.complaints, 30), [data]);

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
            Operations overview
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

      {/* Metrics. Each carries a visual, not just a figure: a bare number tells
          you the value but not whether it is large, moving, or most of a whole. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard
          label="Total Complaints"
          value={server?.total ?? metrics.total}
          provenance={level}
          tone="neutral"
          series={trend.points}
          footnote="Last 30 days"
        />
        <MetricCard
          label="Open"
          value={server?.open ?? metrics.open}
          context={`${metrics.untriaged} awaiting triage`}
          provenance={level}
          tone={(server?.open ?? metrics.open) > metrics.closed ? 'caution' : 'neutral'}
          split={[
            { label: '0-2d', value: metrics.ageBuckets['0-2 days'], color: '#0e7c66' },
            { label: '3-7d', value: metrics.ageBuckets['3-7 days'], color: '#12a184' },
            { label: '8-30d', value: metrics.ageBuckets['8-30 days'], color: '#b45309' },
            { label: '30d+', value: metrics.ageBuckets['30+ days'], color: '#b42318' },
          ]}
        />
        <MetricCard
          label="Resolved"
          value={server?.resolved ?? metrics.resolved}
          provenance={level}
          tone="positive"
          share={metrics.total ? (server?.resolved ?? metrics.resolved) / (server?.total ?? metrics.total) : 0}
          context={`of ${server?.total ?? metrics.total} total`}
        />
        <MetricCard
          label="Resolution Rate"
          value={server?.resolutionRatePct
            ?? (metrics.resolutionRate === null ? null : Number(metrics.resolutionRate.toFixed(1)))}
          unit="%"
          context={server
            ? (server.resolutionRatePct === null ? null : `${server.resolved} / ${server.total}`)
            : (metrics.resolutionRate === null ? null : `${metrics.resolved} / ${metrics.total}`)}
          provenance={level}
          tone="positive"
          share={(server?.resolutionRatePct ?? metrics.resolutionRate) == null
            ? undefined
            : (server?.resolutionRatePct ?? metrics.resolutionRate) / 100}
        />
        {/* Answerable at last: measured from report to first Resolved, using
            the resolvedAt stamp. Null — not zero — while nothing has resolved. */}
        <MetricCard
          label="Avg. Resolution"
          value={avg.value}
          unit={avg.unit}
          provenance={avg.value === null ? 'insufficient' : 'verified'}
          tone="neutral"
          context={avg.value === null ? null : `across ${server.resolutionSampleSize} resolved`}
          footnote={avg.value === null ? 'Nothing resolved yet to measure.' : 'Report to first “Resolved”'}
        />
      </div>

      <OperationsBrief metrics={metrics} />

      {/* Absorbed from the old Analytics page — the same dataset, so splitting
          it across two screens only made an officer navigate to compare. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="bg-surface rounded-xl border border-line shadow-sm p-5 lg:col-span-2">
          <h3 className="font-display text-[15px] font-bold text-ink mb-1">Intake over time</h3>
          <p className="text-[12px] text-ink-muted mb-3">
            Last 30 days · {trend.counted} of {trend.total} complaints fall in this window
          </p>
          <TrendLine points={trend.points} height={150} />
        </section>
        <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
          <h3 className="font-display text-[15px] font-bold text-ink mb-3">Status</h3>
          <Donut data={ranked(metrics.byStatus, 6).top} centerLabel="complaints" />
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Backlog age. Prefers /analytics/aging — which counts every open
            complaint server-side, un-windowed — and falls back to the browser
            buckets, relabelled, when that call did not land. */}
        <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-[15px] font-bold text-ink">Open complaints by age</h3>
            <Provenance level={aging ? 'verified' : 'derived'} />
          </div>
          <p className="text-[12px] text-ink-muted mb-3">
            {aging?.oldestOpenDays != null
              ? `${aging.openTotal} open · oldest has waited ${aging.oldestOpenDays} days`
              : 'Open only — a closed complaint is not ageing.'}
          </p>
          <BarList
            data={aging
              ? aging.buckets.map((b) => [b.label, b.count])
              : Object.entries(metrics.ageBuckets)}
            total={aging ? aging.openTotal : metrics.open}
            emptyMessage="Nothing is open right now."
          />
        </section>

        {/* Departments by TURNAROUND, not volume. Volume alone says which
            department is busiest, which an officer can already see from the
            category mix; how long each one takes is the figure that changes a
            dispatch decision, and it needs the resolvedAt stamp to compute. */}
        <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display text-[15px] font-bold text-ink">Department turnaround</h3>
            <Provenance level={departments.length ? 'verified' : 'insufficient'} />
          </div>
          <p className="text-[12px] text-ink-muted mb-3">
            Report to first “Resolved”. Median sits beside the mean because one
            complaint left open for a year drags an average somewhere no real
            complaint is.
          </p>
          {departments.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Nothing has been resolved yet, so there is no turnaround to measure.
            </p>
          ) : (
            <ul className="divide-y divide-line -my-2.5">
              {departments.slice(0, 6).map((d) => {
                const width = worstDept ? Math.max((d.avgHours / worstDept) * 100, 3) : 0;
                const skewed = d.medianHours > 0 && d.avgHours / d.medianHours >= 1.5;
                return (
                  <li key={d.department} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium text-ink truncate">{d.department}</span>
                      <span className="text-[13px] font-semibold text-ink tnum shrink-0">
                        {formatHours(d.avgHours)}
                        <span className="text-[11px] font-normal text-ink-faint ml-1.5">avg</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-inset overflow-hidden">
                      <div
                        className={`h-full rounded-full animate-grow-x origin-left ${skewed ? 'bg-caution-500' : 'bg-civic-600'}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-[11px] text-ink-faint tnum">
                        median {formatHours(d.medianHours)} · {d.resolved} resolved
                      </span>
                      {skewed && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-caution-700">
                          long tail
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

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
                    to={complaintPath('municipal_officer', c.id)}
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
