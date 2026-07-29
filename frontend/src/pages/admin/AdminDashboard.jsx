// Admin overview: KPIs, complaints-over-time trend, top categories, and a
// recent-users snapshot. Data is mocked (see src/data/mockAdmin.js).
import React from 'react';
import { Link } from 'react-router-dom';
import AdminStatCard from '../../components/admin/AdminStatCard';
import LineChart from '../../components/admin/LineChart';
import BarList from '../../components/admin/BarList';
import { IconUserPlus } from '../../components/dashboard/icons';
import { ROLES } from '../../config';
import { stats, complaintsOverTime, topCategories, recentUsers } from '../../data/mockAdmin';

const ROLE_PILL = {
  citizen: 'bg-emerald-50 text-emerald-700',
  municipal_officer: 'bg-blue-50 text-blue-700',
  field_worker: 'bg-amber-50 text-amber-700',
  admin: 'bg-violet-50 text-violet-700',
};

export default function AdminDashboard() {
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <AdminStatCard key={s.key} {...s} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineChart title="Complaints Over Time" data={complaintsOverTime} />
        <BarList title="Top Issue Categories" data={topCategories} />
      </div>

      {/* Recent users */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-display font-bold text-slate-900">Recent Users</h3>
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
                <th className="font-semibold px-3 py-2.5">Role</th>
                <th className="font-semibold px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.email} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-[13px] font-medium text-slate-800 whitespace-nowrap">{u.name}</td>
                  <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{u.email}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${ROLE_PILL[u.role] || 'bg-slate-100 text-slate-600'}`}>
                      {ROLES[u.role]?.label || u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
