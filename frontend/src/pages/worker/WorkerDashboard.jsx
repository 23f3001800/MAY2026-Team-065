// Field worker overview: availability toggle, task KPIs, and an interactive
// task list where the worker advances a job's status. Data is mocked and the
// status changes are local only (see TODO in src/data/mockWorker.js).
import React, { useMemo, useState } from 'react';
import StatTile from '../../components/dashboard/StatTile';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import { IconStar, IconMapPin } from '../../components/dashboard/icons';
import { getCurrentUser } from '../../api/auth';
import { assignedTasks, AVAILABILITY_OPTIONS, workerRating } from '../../data/mockWorker';

// What the primary action does next, given a task's current status.
const NEXT = {
  Assigned: { status: 'In Progress', label: 'Start' },
  'In Progress': { status: 'Resolved', label: 'Mark Resolved' },
};

const AVAIL_STYLE = {
  Available: 'bg-emerald-500 text-white',
  Busy: 'bg-amber-500 text-white',
  'Off Duty': 'bg-slate-400 text-white',
};

export default function WorkerDashboard() {
  const user = getCurrentUser();
  const firstName = user?.name?.split(' ')[0] || 'there';

  const [tasks, setTasks] = useState(assignedTasks);
  const [availability, setAvailability] = useState('Available');

  const advance = (id) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id && NEXT[t.status] ? { ...t, status: NEXT[t.status].status, due: NEXT[t.status].status === 'Resolved' ? 'Completed' : t.due } : t)),
    );

  const kpis = useMemo(() => {
    const by = (s) => tasks.filter((t) => t.status === s).length;
    return [
      { key: 'assigned', label: 'Assigned', value: by('Assigned'), trend: 'Waiting to start', tone: 'amber' },
      { key: 'in_progress', label: 'In Progress', value: by('In Progress'), trend: 'Currently working', tone: 'blue' },
      { key: 'completed', label: 'Completed', value: by('Resolved'), trend: 'Marked resolved', tone: 'purple' },
      { key: 'rating', label: 'Avg. Rating', value: `${workerRating} ★`, trend: 'From citizen feedback', tone: 'amber', icon: IconStar },
    ];
  }, [tasks]);

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      {/* Header + availability */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Hi, {firstName}</h1>
          <p className="text-[14px] text-slate-500">Here are the tasks assigned to you today.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-slate-400 mr-1">Availability</span>
          {AVAILABILITY_OPTIONS.map((opt) => {
            const active = availability === opt;
            return (
              <button
                key={opt}
                onClick={() => setAvailability(opt)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                  active ? AVAIL_STYLE[opt] : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <StatTile key={k.key} {...k} />
        ))}
      </div>

      {/* Task list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-display font-bold text-slate-900">My Tasks</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => {
            const next = NEXT[t.status];
            return (
              <li key={t.id} className="flex items-center gap-4 px-5 py-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-slate-800">{t.issue}</span>
                    <SeverityBadge severity={t.severity} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mt-1">
                    <IconMapPin size={13} /> {t.location}
                    <span className="mx-1">·</span>
                    <span>{t.category}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400">{t.due}</div>
                  <div className="mt-1"><StatusBadge status={t.status} /></div>
                </div>

                <div className="w-[130px] text-right">
                  {next ? (
                    <button
                      onClick={() => advance(t.id)}
                      className={`w-full px-3 py-2 rounded-lg text-[12px] font-semibold text-white transition-colors ${
                        t.status === 'In Progress' ? 'bg-primary hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {next.label}
                    </button>
                  ) : (
                    <span className="inline-block w-full px-3 py-2 rounded-lg text-[12px] font-semibold text-emerald-600 bg-emerald-50">
                      Done
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-[12px] text-slate-400">
        Status changes are saved locally for now — they'll sync once the backend is connected.
      </p>
    </div>
  );
}
