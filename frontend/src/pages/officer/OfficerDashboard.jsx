// Municipal officer overview: department KPIs, the assigned-complaints queue,
// and field-worker availability. Data is mocked (see src/data/mockOfficer.js).
import React from 'react';
import { Link } from 'react-router-dom';
import StatTile from '../../components/dashboard/StatTile';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import { getCurrentUser } from '../../api/auth';
import { stats, assignedComplaints, fieldWorkers } from '../../data/mockOfficer';

const AVAILABILITY = {
  'Available': 'text-emerald-600 bg-emerald-500',
  'Busy': 'text-amber-600 bg-amber-500',
  'Off Duty': 'text-slate-400 bg-slate-400',
};

function Availability({ status }) {
  const [text, dot] = (AVAILABILITY[status] || 'text-slate-400 bg-slate-400').split(' ');
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {status}
    </span>
  );
}

export default function OfficerDashboard() {
  const user = getCurrentUser();
  const department = user?.department ? `${user.department} Department` : 'your department';

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Officer Dashboard</h1>
          <p className="text-[14px] text-slate-500">
            Complaints and team activity for <span className="capitalize">{department}</span>.
          </p>
        </div>
        <Link
          to="/officer/complaints"
          className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
        >
          View Queue
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatTile key={s.key} {...s} />
        ))}
      </div>

      {/* Queue + workers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned complaints queue */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900">Assigned Complaints</h3>
            <Link to="/officer/complaints" className="text-[13px] font-semibold text-primary hover:underline">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="font-semibold px-5 py-2.5">Issue</th>
                  <th className="font-semibold px-3 py-2.5">Severity</th>
                  <th className="font-semibold px-3 py-2.5">Status</th>
                  <th className="font-semibold px-3 py-2.5">Worker</th>
                  <th className="font-semibold px-5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignedComplaints.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-[13px] font-medium text-slate-800">{c.issue}</div>
                      <div className="text-[11px] text-slate-400">{c.category} · {c.location}</div>
                    </td>
                    <td className="px-3 py-3"><SeverityBadge severity={c.severity} /></td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                      {c.worker
                        ? <span className="text-slate-600">{c.worker}</span>
                        : <span className="text-amber-600 font-medium">Unassigned</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to="/officer/complaints"
                        className={`inline-block text-[12px] font-semibold ${c.worker ? 'text-primary' : 'text-amber-600'} hover:underline`}
                      >
                        {c.worker ? 'View' : 'Assign'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Field workers availability */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-display font-bold text-slate-900">Field Workers</h3>
            <Link to="/officer/workers" className="text-[13px] font-semibold text-primary hover:underline">
              All
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {fieldWorkers.map((w) => (
              <li key={w.name} className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-semibold text-[13px]">
                  {w.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-slate-800 truncate">{w.name}</div>
                  <div className="text-[11px] text-slate-400">{w.skill}</div>
                </div>
                <Availability status={w.availability} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
