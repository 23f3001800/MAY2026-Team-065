// Citizen home — a dashboard, not a second complaints list.
//
// This screen used to lead with a card for the newest complaint, another for
// the one waiting longest, and a list beneath. That made it a worse copy of the
// Complaints tab, which already does listing, filtering, search and a map far
// better. Individual complaints belong there; what belongs here is the shape of
// a citizen's record — how much they have reported, how much of it got fixed,
// what kind of problems they report, and whether anything needs them.
//
// Backed by GET /complaints/, already scoped server-side to the signed-in
// citizen. Aggregation is shared with the officer and admin views via
// lib/complaintMetrics so "resolved" means the same thing everywhere. There is
// no server-side analytics for citizens — /analytics/* is officials-only — so
// every figure here is a browser aggregate and is labelled Derived, honestly.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Donut, BarList, TrendLine } from '../components/charts';
import Provenance from '../components/metrics/Provenance';
import { LoadingPanel, ErrorPanel } from '../components/dashboard/AsyncStates';
import {
  IconReport, IconArrowRight, IconClock, IconCheckCircle, IconStar, IconList,
} from '../components/dashboard/icons';
import { listComplaints } from '../api/complaints';
import { computeMetrics, ranked, volumeSeries } from '../lib/complaintMetrics';
import useAsync from '../hooks/useAsync';

/**
 * A headline figure with a proportion bar beneath it.
 *
 * The bar is the point: "3 resolved" means nothing without knowing whether that
 * is out of four or out of forty, and a bare number in a box was exactly the
 * thing this dashboard was criticised for.
 */
function Stat({ label, value, of, tone = 'neutral', icon: Icon, sub }) {
  const tones = {
    neutral: { chip: 'bg-leaf-50 text-leaf-700', bar: 'bg-leaf-600' },
    positive: { chip: 'bg-leaf-50 text-leaf-600', bar: 'bg-leaf-500' },
    caution: { chip: 'bg-caution-50 text-caution-700', bar: 'bg-caution-500' },
  };
  const t = tones[tone] || tones.neutral;
  const pct = of > 0 ? Math.round((value / of) * 100) : 0;

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-4">
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.chip}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[24px] font-bold text-ink leading-none tnum">{value}</div>
          <div className="text-[12px] text-ink-muted mt-1">{label}</div>
        </div>
      </div>
      {of > 0 && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
            <div
              className={`h-full rounded-full origin-left animate-grow-x ${t.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[11px] text-ink-faint mt-1.5 tnum">{sub || `${pct}% of ${of}`}</div>
        </div>
      )}
    </div>
  );
}

export default function CitizenDashboard() {
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const complaints = useMemo(() => data || [], [data]);
  const metrics = useMemo(() => computeMetrics(complaints), [complaints]);
  const trend = useMemo(() => volumeSeries(complaints, 90), [complaints]);

  // Resolved but not yet confirmed by the citizen — the one thing on this
  // screen that is an action rather than a figure, and nobody else can do it.
  const awaitingConfirmation = useMemo(
    () => complaints.filter((c) => c.status === 'Resolved'),
    [complaints],
  );

  const total = complaints.length;

  // Charts need a shape to show. Below this a donut is three slices of nothing
  // and reads as decoration, so the panels say so instead of drawing it.
  const enoughForCharts = total >= 3;

  if (loading) {
    return <div className="max-w-[1100px] mx-auto"><LoadingPanel label="Loading your record…" variant="stats" /></div>;
  }
  if (error) {
    return <div className="max-w-[1100px] mx-auto"><ErrorPanel error={error} onRetry={refetch} /></div>;
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-5 animate-rise-in">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[28px] font-bold text-ink leading-tight">
            Overview
          </h1>
          <p className="text-[14px] text-ink-muted mt-1">
            {total === 0
              ? 'Your reporting record will build up here as you report issues.'
              : `Your reporting record — ${total} complaint${total === 1 ? '' : 's'} filed in total.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/complaints"
            className="focus-ring inline-flex items-center gap-2 bg-surface border border-line hover:border-leaf-400 text-ink-body font-semibold text-[13px] px-3.5 py-2.5 rounded-xl shadow-sm transition-all"
          >
            <IconList size={15} /> My complaints
          </Link>
          <Link
            to="/report"
            className="focus-ring lift inline-flex items-center gap-2 bg-leaf-600 hover:bg-leaf-700 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-sm transition-all"
          >
            <IconReport size={16} /> Report an issue
          </Link>
        </div>
      </header>

      {/* The only thing here that asks for an action. It stays above the
          figures because a figure can wait and this cannot — no officer or
          worker can close these on the citizen's behalf. */}
      {awaitingConfirmation.length > 0 && (
        <div className="bg-leaf-50 border border-leaf-100 rounded-xl p-4 flex items-start gap-3 flex-wrap">
          <span className="w-9 h-9 rounded-xl bg-surface text-leaf-700 flex items-center justify-center shrink-0">
            <IconStar size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-ink">
              {awaitingConfirmation.length === 1
                ? 'A complaint has been marked fixed'
                : `${awaitingConfirmation.length} complaints have been marked fixed`}
            </div>
            <p className="text-[13px] text-ink-body mt-0.5 leading-snug">
              Confirm the work and rate it — nobody else can close these for you.
            </p>
          </div>
          <Link
            to="/complaints"
            className="focus-ring shrink-0 inline-flex items-center gap-1.5 bg-leaf-600 hover:bg-leaf-700 text-white font-semibold text-[13px] px-3.5 py-2 rounded-lg transition-colors"
          >
            Review <IconArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Reported in total"
          value={total}
          of={0}
          tone="neutral"
          icon={IconReport}
        />
        <Stat
          label="Still open"
          value={metrics.open}
          of={total}
          tone={metrics.open > 0 ? 'caution' : 'neutral'}
          icon={IconClock}
          sub={metrics.open === 0 && total > 0 ? 'nothing outstanding' : undefined}
        />
        <Stat
          label="Resolved"
          value={metrics.resolved}
          of={total}
          tone="positive"
          icon={IconCheckCircle}
        />
        <Stat
          label="Confirmed by you"
          value={metrics.byStatus?.Verified || 0}
          of={total}
          tone="positive"
          icon={IconStar}
          sub={awaitingConfirmation.length > 0
            ? `${awaitingConfirmation.length} awaiting your confirmation`
            : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <section className="bg-surface rounded-xl border border-line shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-[15px] font-bold text-ink">When you reported</h2>
            <Provenance level={total ? 'derived' : 'insufficient'} />
          </div>
          <p className="text-[12px] text-ink-muted mb-3">
            {total
              ? `Last 90 days · ${trend.counted} of ${trend.total} of your complaints fall in this window`
              : 'Nothing reported yet, so there is no history to plot.'}
          </p>
          {total ? (
            <TrendLine points={trend.points} height={150} />
          ) : (
            <div className="h-[150px] rounded-lg bg-surface-inset flex items-center justify-center">
              <p className="text-[13px] text-ink-muted">Your reporting history will appear here.</p>
            </div>
          )}
        </section>

        <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-display text-[15px] font-bold text-ink">Where they stand</h2>
            <Provenance level={total ? 'derived' : 'insufficient'} />
          </div>
          {total ? (
            <Donut data={ranked(metrics.byStatus, 6).top} size={150} thickness={24} centerLabel="complaints" />
          ) : (
            <p className="text-[13px] text-ink-muted py-6 text-center">
              Nothing to break down yet.
            </p>
          )}
        </section>
      </div>

      <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-display text-[15px] font-bold text-ink">What you report</h2>
          <Provenance level={enoughForCharts ? 'derived' : 'insufficient'} />
        </div>
        <p className="text-[12px] text-ink-muted mb-3">
          {enoughForCharts
            ? 'Across every complaint you have filed.'
            : 'A breakdown needs at least three complaints to say anything meaningful.'}
        </p>
        {enoughForCharts ? (
          <BarList data={ranked(metrics.byCategory, 6).top} total={total} />
        ) : (
          <p className="text-[13px] text-ink-muted">
            {total === 0
              ? 'Report an issue and the categories you report most will show up here.'
              : `You have filed ${total} so far. Not enough to draw a pattern from.`}
          </p>
        )}
      </section>

      {/* The one pointer out. The complaints themselves live in that tab — this
          is a link to them, not a copy of them. */}
      <Link
        to="/complaints"
        className="focus-ring group flex items-center justify-between gap-2 bg-surface rounded-xl border border-line shadow-sm px-4 py-3.5 hover:border-leaf-300 transition-colors"
      >
        <span className="text-[13.5px] font-semibold text-ink-body">
          {total === 0
            ? 'Open the complaints tab'
            : `Open, search and map all ${total} of your complaints`}
        </span>
        <IconArrowRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
