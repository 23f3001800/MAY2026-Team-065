// Task Map — where the worker's open tasks are, without a map dependency.
//
// No map library (Leaflet, Google Maps JS) is installed in this project, and
// adding one just for a single screen would be a heavier change than this
// page needs. Real coordinates do exist on every complaint (GET
// /complaints/worker/tasks returns location.latitude/longitude), so each task
// here links out to Google Maps rather than faking a canvas with pins on it.
import React, { useMemo } from 'react';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconMapPin, IconCrosshair } from '../../components/dashboard/icons';
import { listMyTasks } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';

const OPEN_STATUSES = ['New', 'Assigned'];
const SEVERITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export default function WorkerMap() {
  const { data, error, loading, refetch } = useAsync(() => listMyTasks(), []);
  const items = useMemo(() => data || [], [data]);

  const open = useMemo(
    () =>
      items
        .filter((t) => OPEN_STATUSES.includes(t.status) && t.coords)
        .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)),
    [items],
  );

  return (
    <div className="max-w-[900px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Task Map</h1>
        <p className="text-[14px] text-slate-500">Open tasks by location, nearest severity first.</p>
      </div>

      {loading ? (
        <LoadingPanel label="Loading task locations…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : open.length === 0 ? (
        <EmptyPanel icon={IconMapPin} title="No open tasks with a location" message="Open tasks with recorded coordinates will show up here." />
      ) : (
        <ul className="space-y-3">
          {open.map((t) => (
            <li key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 flex-wrap">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-primary flex items-center justify-center shrink-0">
                <IconMapPin size={18} />
              </span>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-slate-800">{t.issue}</span>
                  <SeverityBadge severity={t.severity} />
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-[12px] text-slate-400 mt-1">{t.location}</div>
                <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                  {t.coords.latitude.toFixed(5)}, {t.coords.longitude.toFixed(5)}
                </div>
              </div>
              <a
                href={`https://www.google.com/maps?q=${t.coords.latitude},${t.coords.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold text-primary border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <IconCrosshair size={14} /> Open in Maps
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
