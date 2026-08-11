// Admin overview: KPIs, complaints-over-time trend, top categories, and a
// user snapshot — all real, combining three calls:
//   GET /admin/analytics  -> total + status/severity breakdown
//   GET /complaints/      -> admins get every complaint; used for the trend
//                            and category chart, which the analytics
//                            endpoint doesn't provide
//   GET /admin/users      -> a sample of accounts for the table below
//
// UserModel has no createdAt column, so there is no way to sort "recent"
// users by signup time -- the table below is just "Users", not "Recent
// Users", and shows whatever the backend returns first.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarList, TrendLine, Donut } from '../../components/charts';
import MetricCard from '../../components/metrics/MetricCard';
import { computeMetrics, volumeSeries, ranked } from '../../lib/complaintMetrics';
import useCategories from '../../hooks/useCategories';
import ComplaintHeatMap from '../../components/map/ComplaintHeatMap';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import { IconUserPlus } from '../../components/dashboard/icons';
import { ROLES } from '../../config';
import { getCityAnalytics } from '../../api/admin';
import { listComplaints } from '../../api/complaints';
import { listUsers } from '../../api/admin';
import useAsync from '../../hooks/useAsync';

const ROLE_PILL = {
  citizen: 'bg-emerald-50 text-emerald-700',
  officer: 'bg-blue-50 text-blue-700',
  municipal_officer: 'bg-blue-50 text-blue-700',
  field_worker: 'bg-amber-50 text-amber-700',
  administrator: 'bg-violet-50 text-violet-700',
  admin: 'bg-violet-50 text-violet-700',
};


async function loadDashboard() {
  const [analytics, complaints, users] = await Promise.all([
    getCityAnalytics(),
    listComplaints(),
    listUsers({ limit: 6 }),
  ]);
  return { analytics, complaints, users };
}

export default function AdminDashboard() {
  const { data, error, loading, refetch } = useAsync(loadDashboard, []);

  // Aggregation lives in lib/complaintMetrics so admin, officer and citizen all
  // share one definition. The previous version computed its own — including an
  // "Avg. Resolution Time" from (updatedAt - reportedAt), which is wrong rather
  // than imprecise: updatedAt moves on any edit, so a complaint recategorised
  // months later reported a months-long resolution. That tile is now the
  // honest insufficient-data state.
  const metrics = useMemo(() => computeMetrics(data?.complaints), [data]);
  const { categories } = useCategories();

  // Every seeded category, zeros included. ranked() only surfaces categories
  // that have complaints, so a category nobody has reported disappears — and
  // "nothing reported under Streetlight" is a finding, not an absence of one.
  const allCategories = useMemo(
    () => categories
      .map((c) => [c.label, metrics.byCategory[c.label] || 0])
      .sort((a, b) => b[1] - a[1]),
    [categories, metrics.byCategory],
  );

  // /admin/analytics IS a server aggregate, unlike everything else here, so the
  // one figure it gives us is labelled Verified rather than Derived.
  const verifiedTotal = data?.analytics?.overview?.totalComplaints ?? null;

  const trend = useMemo(() => volumeSeries(data?.complaints, 30), [data]);


  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-[14px] text-slate-500">City-wide overview of civic complaints and users.</p>
        </div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
        >
          <IconUserPlus size={16} /> Manage Users
        </Link>
      </div>

      {loading ? (
        <LoadingPanel label="Loading the dashboard…" variant="stats" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              label="Total Complaints"
              value={verifiedTotal ?? metrics.total}
              provenance={verifiedTotal !== null ? 'verified' : 'derived'}
              series={trend.points}
              footnote={verifiedTotal !== null ? 'From /admin/analytics · last 30 days' : 'Last 30 days'}
            />
            <MetricCard
              label="Resolved"
              value={metrics.resolved}
              tone="positive"
              share={metrics.total ? metrics.resolved / metrics.total : 0}
              context={`of ${metrics.total} total`}
            />
            <MetricCard
              label="Resolution Rate"
              value={metrics.resolutionRate === null ? null : Number(metrics.resolutionRate.toFixed(1))}
              unit="%"
              context={metrics.resolutionRate === null ? null : `${metrics.resolved} / ${metrics.total}`}
              tone="positive"
              share={metrics.resolutionRate === null ? undefined : metrics.resolutionRate / 100}
            />
            {/* Deliberately null — see the note on `metrics` above. */}
            <MetricCard
              label="Avg. Resolution Time"
              value={null}
              provenance="insufficient"
              tone="caution"
              footnote="No resolution timestamp exists on a complaint."
            />
          </div>

          {/* Where the pressure is */}
          <section>
            <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="font-display text-[16px] font-bold text-ink">Complaint density</h2>
                <p className="text-[12px] text-ink-muted mt-0.5">
                  Weighted by severity — hot areas are where the serious work is, not just the most reports.
                </p>
              </div>
            </div>
            <ComplaintHeatMap complaints={data.complaints} height="440px" />
          </section>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
              <h3 className="font-display text-[15px] font-bold text-ink mb-1">Complaints over time</h3>
              <p className="text-[12px] text-ink-muted mb-3">
                Last 30 days · {trend.counted} of {trend.total} complaints fall in this window
              </p>
              <TrendLine points={trend.points} height={140} />
            </section>
            <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <h3 className="font-display text-[15px] font-bold text-ink">Categories</h3>
                <span className="text-[11px] text-ink-faint tnum">{allCategories.length} configured</span>
              </div>
              <p className="text-[12px] text-ink-muted mb-3">
                Every category, including any with nothing reported
              </p>
              <BarList data={allCategories} total={metrics.total} />
            </section>
          </div>

          {/* Absorbed from the old Analytics and Departments pages. Three
              separate screens over one dataset meant an admin had to hold the
              numbers in their head while navigating between them. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
              <h3 className="font-display text-[15px] font-bold text-ink mb-3">Status distribution</h3>
              <Donut data={ranked(metrics.byStatus, 6).top} centerLabel="complaints" />
            </section>

            <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
              <h3 className="font-display text-[15px] font-bold text-ink mb-1">Open complaints by age</h3>
              <p className="text-[12px] text-ink-muted mb-3">
                Open only — a closed complaint is not ageing.
              </p>
              <BarList
                data={Object.entries(metrics.ageBuckets)}
                total={metrics.open}
                emptyMessage="Nothing is open right now."
              />
            </section>

            <section className="bg-surface rounded-xl border border-line shadow-sm p-5">
              <h3 className="font-display text-[15px] font-bold text-ink mb-1">Departments</h3>
              <p className="text-[12px] text-ink-muted mb-3">
                Load by routing department
              </p>
              <BarList
                data={ranked(metrics.byDepartment, 6).top}
                total={metrics.total}
                emptyMessage="No complaint carries a department yet."
              />
            </section>
          </div>

          {/* Users */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-display font-bold text-slate-900">Users</h3>
              <Link to="/admin/users" className="text-[13px] font-semibold text-primary hover:underline">
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="font-semibold px-5 py-2.5">Name</th>
                    <th className="font-semibold px-3 py-2.5">Email</th>
                    <th className="font-semibold px-5 py-2.5">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-[13px] font-medium text-slate-800 whitespace-nowrap">{u.name}</td>
                      <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${ROLE_PILL[String(u.role).toLowerCase()] || 'bg-slate-100 text-slate-600'}`}>
                          {ROLES[u.role]?.label || u.roleLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
