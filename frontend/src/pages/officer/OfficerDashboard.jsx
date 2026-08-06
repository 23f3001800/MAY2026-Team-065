// Municipal officer overview: queue KPIs, a recent-complaints snapshot, and
// field-worker availability — backed by GET /complaints/ (officers get every
// complaint, same as admin) and GET /workers/.
//
// One thing this can't show that the old mock did: which worker is assigned
// to a row. ComplaintResponse (backend/schemas.py) never returns
// fieldWorkerId, so there is no way to resolve "assigned to" from this list —
// only the complaint queue's drawer, which fetches the worker roster
// separately, can offer assignment at all. Rather than invent a name, that
// column is left out here.
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StatTile from '../../components/dashboard/StatTile';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import { getCurrentUser } from '../../api/auth';
import { listComplaints } from '../../api/complaints';
import { listFieldWorkers } from '../../api/workers';
import useAsync from '../../hooks/useAsync';

const AVAILABILITY = {
  Available: 'text-emerald-600 bg-emerald-500',
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

async function loadDashboard() {
  const [complaints, workers] = await Promise.all([listComplaints(), listFieldWorkers()]);
  return { complaints, workers };
}

export default function OfficerDashboard() {
  const user = getCurrentUser();
  const { data, error, loading, refetch } = useAsync(loadDashboard, []);

  const stats = useMemo(() => {
    if (!data) return [];
    const by = (s) => data.complaints.filter((c) => c.status === s).length;
    return [
      { key: 'total', label: 'Total Complaints', value: data.complaints.length, tone: 'emerald' },
      { key: 'new', label: 'Unassigned', value: by('New'), tone: 'amber' },
      { key: 'assigned', label: 'Assigned', value: by('Assigned'), tone: 'blue' },
      { key: 'resolved', label: 'Resolved', value: by('Resolved'), tone: 'purple' },
    ];
  }, [data]);

  const recent = useMemo(() => {
    if (!data) return [];
    return [...data.complaints].sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt)).slice(0, 6);
  }, [data]);

  const workers = useMemo(() => (data?.workers || []).slice(0, 6), [data]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Officer Dashboard</h1>
          <p className="text-[14px] text-slate-500">
            Welcome back, {user?.name || 'officer'}. Here's the city-wide queue.
          </p>
        </div>
        <Link
          to="/officer/complaints"
          className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
        >
          View Queue
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
            {stats.map((s) => <StatTile key={s.key} {...s} />)}
          </div>

          {/* Queue + workers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="font-display font-bold text-slate-900">Recent Complaints</h3>
                <Link to="/officer/complaints" className="text-[13px] font-semibold text-primary hover:underline">
                  View All
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="text-[14px] text-slate-500 p-8 text-center">No complaints have been reported yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="font-semibold px-5 py-2.5">Issue</th>
                        <th className="font-semibold px-3 py-2.5">Severity</th>
                        <th className="font-semibold px-3 py-2.5">Status</th>
                        <th className="font-semibold px-5 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((c) => (
                        <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="text-[13px] font-medium text-slate-800">{c.issue}</div>
                            <div className="text-[11px] text-slate-400">{c.category} · {c.location}</div>
                          </td>
                          <td className="px-3 py-3"><SeverityBadge severity={c.severity} /></td>
                          <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to="/officer/complaints"
                              className={`inline-block text-[12px] font-semibold hover:underline ${c.status === 'New' ? 'text-amber-600' : 'text-primary'}`}
                            >
                              {c.status === 'New' ? 'Assign' : 'View'}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Field workers availability */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="font-display font-bold text-slate-900">Field Workers</h3>
                <Link to="/officer/workers" className="text-[13px] font-semibold text-primary hover:underline">
                  All
                </Link>
              </div>
              {workers.length === 0 ? (
                <p className="text-[13px] text-slate-500 p-6 text-center">No field workers registered yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {workers.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 px-5 py-3">
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
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
