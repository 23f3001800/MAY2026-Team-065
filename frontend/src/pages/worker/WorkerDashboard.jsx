// Field worker overview: availability toggle and open-task KPIs/list, backed
// by real endpoints.
//
// Tasks come from GET /complaints/worker/tasks. The previous mocked version
// had an "In Progress" stage a worker could move a task through locally --
// the backend's StatusEnum has no such value (PENDING | ASSIGNED | RESOLVED |
// REJECTED), so the only real transition here is straight to Resolved or
// Rejected via PATCH /complaints/{id}/status. There is also no rating
// endpoint to average, so "Avg. Rating" -- which was invented in the mock --
// has been dropped rather than kept with fake numbers.
import React, { useCallback, useMemo, useState } from 'react';
import StatTile from '../../components/dashboard/StatTile';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import TaskDrawer from '../../components/worker/TaskDrawer';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import { IconMapPin, IconCheckCircle } from '../../components/dashboard/icons';
import { getCurrentUser } from '../../api/auth';
import { listMyTasks, updateComplaintStatus } from '../../api/complaints';
import { setMyAvailability } from '../../api/workers';
import useAsync from '../../hooks/useAsync';

const AVAIL_STYLE = {
  AVAILABLE: 'bg-emerald-500 text-white',
  UNAVAILABLE: 'bg-slate-400 text-white',
};

export default function WorkerDashboard() {
  const user = getCurrentUser();
  const firstName = user?.name?.split(' ')[0] || 'there';

  const { data, error, loading, refetch, setData } = useAsync(() => listMyTasks(), []);
  const tasks = useMemo(() => data || [], [data]);

  // No GET for the worker's own availabilityStatus (see WorkerProfile) --
  // only PATCH exists, so this stays null ("not confirmed") until they set it.
  const [availability, setAvailability] = useState(null);
  const [availBusy, setAvailBusy] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = tasks.find((t) => t.id === selectedId) || null;

  const applyUpdate = useCallback((updated) => {
    setData((list) => (list || []).map((t) => (t.id === updated.id ? updated : t)));
  }, [setData]);

  const handleAvailability = async (available) => {
    setAvailBusy(true);
    try {
      const result = await setMyAvailability(available);
      setAvailability(result.availabilityStatus);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setToast(err.message);
    } finally {
      setAvailBusy(false);
    }
  };

  const handleStatusChange = async (id, status, remarks) => {
    setBusy(true);
    try {
      const updated = await updateComplaintStatus(id, status, remarks);
      applyUpdate(updated);
      setToast(`${id} marked as ${status}.`);
      setSelectedId(null);
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const kpis = useMemo(() => {
    const by = (s) => tasks.filter((t) => t.status === s).length;
    return [
      { key: 'new', label: 'New', value: by('New'), trend: 'Not yet started', tone: 'amber' },
      { key: 'assigned', label: 'Assigned', value: by('Assigned'), trend: 'In your queue', tone: 'blue' },
      { key: 'resolved', label: 'Resolved', value: by('Resolved'), trend: 'Marked complete', tone: 'purple' },
      { key: 'total', label: 'Total Assigned', value: tasks.length, trend: 'All time', tone: 'emerald' },
    ];
  }, [tasks]);

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === 'New' || t.status === 'Assigned'),
    [tasks],
  );

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Hi, {firstName}</h1>
          <p className="text-[14px] text-slate-500">Here are the tasks assigned to you.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-slate-400 mr-1">Availability</span>
          <button
            onClick={() => handleAvailability(true)}
            disabled={availBusy}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-60 ${
              availability === 'AVAILABLE' ? AVAIL_STYLE.AVAILABLE : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => handleAvailability(false)}
            disabled={availBusy}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-60 ${
              availability === 'UNAVAILABLE' ? AVAIL_STYLE.UNAVAILABLE : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Off Duty
          </button>
        </div>
      </div>

      {toast && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-medium px-4 py-3 rounded-xl">
          <IconCheckCircle size={16} className="shrink-0" /> {toast}
        </div>
      )}

      {loading ? (
        <LoadingPanel label="Loading your tasks…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map((k) => <StatTile key={k.key} {...k} />)}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-display font-bold text-slate-900">Open Tasks</h3>
            </div>
            {openTasks.length === 0 ? (
              <p className="text-[14px] text-slate-500 p-8 text-center">Nothing open right now.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {openTasks.map((t) => (
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
                    <StatusBadge status={t.status} />
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className="shrink-0 px-3 py-2 rounded-lg text-[12px] font-semibold text-white bg-primary hover:bg-emerald-600 transition-colors"
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {selected && (
        <TaskDrawer task={selected} busy={busy} onDismiss={() => setSelectedId(null)} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
