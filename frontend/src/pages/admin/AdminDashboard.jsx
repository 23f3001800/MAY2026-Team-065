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
import AdminStatCard from '../../components/admin/AdminStatCard';
import LineChart from '../../components/admin/LineChart';
import BarList from '../../components/admin/BarList';
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

function monthKey(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short' });
}

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

  const stats = useMemo(() => {
    if (!data) return [];
    const { analytics, complaints } = data;
    const byStatus = analytics.breakdownByStatus || {};
    const resolved = complaints.filter((c) => c.status === 'Resolved');
    const avgDays = resolved.length
      ? (resolved.reduce((sum, c) => sum + (new Date(c.updatedAt) - new Date(c.reportedAt)), 0) / resolved.length / 86400000).toFixed(1)
      : null;
    return [
      { key: 'total', label: 'Total Complaints', value: analytics.overview?.totalComplaints ?? complaints.length, trend: 'City-wide', tone: 'emerald' },
      { key: 'resolved', label: 'Resolved', value: byStatus.RESOLVED || 0, trend: 'Closed out', tone: 'purple' },
      { key: 'assigned', label: 'Assigned', value: byStatus.ASSIGNED || 0, trend: 'In progress', tone: 'blue' },
      { key: 'avg_time', label: 'Avg. Resolution Time', value: avgDays ? `${avgDays} days` : '—', trend: 'Reported to resolved', tone: 'amber' },
    ];
  }, [data]);

  const complaintsOverTime = useMemo(() => {
    if (!data) return [];
    const counts = new Map();
    for (const c of data.complaints) {
      const key = monthKey(c.reportedAt);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }, [data]);

  const topCategories = useMemo(() => {
    if (!data) return [];
    const counts = new Map();
    for (const c of data.complaints) counts.set(c.category, (counts.get(c.category) || 0) + 1);
    const palette = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#94a3b8'];
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
  }, [data]);

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
        <LoadingPanel label="Loading the dashboard…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {stats.map((s) => <AdminStatCard key={s.key} {...s} />)}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {complaintsOverTime.length > 1 && <LineChart title="Complaints Over Time" data={complaintsOverTime} />}
            <BarList title="Top Issue Categories" data={topCategories.length ? topCategories : [{ label: 'No data yet', value: 0, color: '#94a3b8' }]} />
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
