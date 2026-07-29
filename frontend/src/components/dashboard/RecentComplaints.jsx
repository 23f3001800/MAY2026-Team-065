// Recent complaints table with a "View All" link to the full list.
import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

export default function RecentComplaints({ rows }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="font-display font-bold text-slate-900">Recent Complaints</h3>
        <Link to="/my-complaints" className="text-[13px] font-semibold text-primary hover:underline">
          View All
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400">
              <th className="font-semibold px-5 py-2.5">ID</th>
              <th className="font-semibold px-3 py-2.5">Issue</th>
              <th className="font-semibold px-3 py-2.5">Location</th>
              <th className="font-semibold px-3 py-2.5">Status</th>
              <th className="font-semibold px-5 py-2.5">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-[12px] font-mono text-slate-500 whitespace-nowrap">{r.id}</td>
                <td className="px-3 py-3 text-[13px] font-medium text-slate-800">{r.issue}</td>
                <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{r.location}</td>
                <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-5 py-3 text-[12px] text-slate-400 whitespace-nowrap">{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
