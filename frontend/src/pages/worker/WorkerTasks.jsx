// My Tasks — every complaint assigned to the signed-in field worker, with a
// drawer to move a task's status.
//
// Backed by GET /complaints/worker/tasks (scoped server-side to the current
// worker) and PATCH /complaints/{id}/status, which the backend allows for the
// worker assigned to that complaint.
import React, { useCallback, useMemo, useState } from 'react';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import TaskDrawer from '../../components/worker/TaskDrawer';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconMapPin, IconCheckCircle, IconClipboard } from '../../components/dashboard/icons';
import { listMyTasks, updateComplaintStatus } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';

const OPEN_STATUSES = ['New', 'Assigned'];

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function WorkerTasks() {
  const { data, error, loading, refetch, setData } = useAsync(() => listMyTasks(), []);
  const items = useMemo(() => data || [], [data]);
  const open = useMemo(() => items.filter((t) => OPEN_STATUSES.includes(t.status)), [items]);

  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = items.find((t) => t.id === selectedId) || null;

  const applyUpdate = useCallback((updated) => {
    setData((list) => (list || []).map((t) => (t.id === updated.id ? updated : t)));
  }, [setData]);

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

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">My Tasks</h1>
        <p className="text-[14px] text-slate-500">Complaints assigned to you that still need action.</p>
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
      ) : open.length === 0 ? (
        <EmptyPanel
          icon={IconClipboard}
          title="Nothing open right now"
          message={items.length === 0 ? 'No complaints have been assigned to you yet.' : 'All your assigned tasks are already resolved or rejected.'}
        />
      ) : (
        <ul className="space-y-3">
          {open.map((t) => (
            <li key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-slate-800">{t.issue}</span>
                  <SeverityBadge severity={t.severity} />
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mt-1">
                  <IconMapPin size={13} /> {t.location}
                  <span className="mx-1">·</span>
                  <span>{t.category}</span>
                  <span className="mx-1">·</span>
                  <span>Reported {formatDate(t.reportedAt)}</span>
                </div>
              </div>
              <StatusBadge status={t.status} />
              <button
                onClick={() => setSelectedId(t.id)}
                className="shrink-0 px-3.5 py-2 rounded-lg text-[12px] font-semibold text-white bg-primary hover:bg-emerald-600 transition-colors"
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && items.length > 0 && (
        <p className="text-[12px] text-slate-400">{open.length} open of {items.length} total assigned tasks</p>
      )}

      {selected && (
        <TaskDrawer
          task={selected}
          busy={busy}
          onDismiss={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
