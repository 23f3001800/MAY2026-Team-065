// History — tasks the worker has already closed out (Resolved or Rejected),
// filtered client-side from the same GET /complaints/worker/tasks used by
// My Tasks. Opens the same TaskDrawer in read-only mode since there is
// nothing left to change on a closed task.
import React, { useMemo, useState } from 'react';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import TaskDrawer from '../../components/worker/TaskDrawer';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconMapPin, IconClock } from '../../components/dashboard/icons';
import { listMyTasks } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';

const CLOSED_STATUSES = ['Resolved', 'Rejected'];

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function WorkerHistory() {
  const { data, error, loading, refetch } = useAsync(() => listMyTasks(), []);
  const items = useMemo(() => data || [], [data]);
  const closed = useMemo(
    () => items.filter((t) => CLOSED_STATUSES.includes(t.status)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [items],
  );

  const [selectedId, setSelectedId] = useState(null);
  const selected = closed.find((t) => t.id === selectedId) || null;

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">History</h1>
        <p className="text-[14px] text-slate-500">Tasks you've already resolved or rejected.</p>
      </div>

      {loading ? (
        <LoadingPanel label="Loading history…" variant="table" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : closed.length === 0 ? (
        <EmptyPanel icon={IconClock} title="No completed tasks yet" message="Resolved and rejected tasks will show up here." />
      ) : (
        <ul className="space-y-3">
          {closed.map((t) => (
            <li
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 flex-wrap cursor-pointer hover:border-primary transition-colors"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-slate-800">{t.issue}</span>
                  <SeverityBadge severity={t.severity} />
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mt-1">
                  <IconMapPin size={13} /> {t.location}
                  <span className="mx-1">·</span>
                  <span>Closed {formatDate(t.updatedAt)}</span>
                </div>
              </div>
              <StatusBadge status={t.status} />
            </li>
          ))}
        </ul>
      )}

      {selected && <TaskDrawer task={selected} readOnly busy={false} onDismiss={() => setSelectedId(null)} onStatusChange={() => {}} />}
    </div>
  );
}
