// Field Workers — read-only staff directory for an officer to check
// availability and skills before opening a complaint to assign one.
//
// Backed by GET /workers/, the same call the complaint queue's assignment
// drawer already makes. Assignment itself happens from a complaint (see
// ComplaintDrawer) since the backend's skill check is per-complaint; this
// page is for browsing the roster, not the action.
import React, { useMemo, useState } from 'react';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconSearch, IconUsers } from '../../components/dashboard/icons';
import { listFieldWorkers } from '../../api/workers';
import useAsync from '../../hooks/useAsync';

const AVAILABILITY_STYLES = {
  Available: 'bg-emerald-50 text-emerald-700',
  'Off Duty': 'bg-slate-100 text-slate-500',
};

export default function OfficerWorkers() {
  const { data, error, loading, refetch } = useAsync(() => listFieldWorkers(), []);
  const workers = useMemo(() => data || [], [data]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) => `${w.name} ${w.skill}`.toLowerCase().includes(q));
  }, [workers, query]);

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Field Workers</h1>
        <p className="text-[14px] text-slate-500">Roster of field workers and their availability.</p>
      </div>

      <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 max-w-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100 transition">
        <IconSearch size={18} className="text-slate-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or skill…"
          aria-label="Search field workers"
          className="flex-1 py-2.5 text-[14px] text-slate-800 outline-none bg-transparent"
        />
      </div>

      {loading ? (
        <LoadingPanel label="Loading field workers…" variant="cards" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          icon={IconUsers}
          title={workers.length === 0 ? 'No field workers registered yet' : 'No match'}
          message={workers.length === 0 ? 'An administrator can add field workers.' : 'Try a different search.'}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="font-semibold px-5 py-3">Name</th>
                  <th className="font-semibold px-3 py-3">Phone</th>
                  <th className="font-semibold px-3 py-3">Skills</th>
                  <th className="font-semibold px-5 py-3">Availability</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-[13px] font-medium text-slate-800 whitespace-nowrap">{w.name}</td>
                    <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{w.phone}</td>
                    <td className="px-3 py-3 text-[13px] text-slate-600">{w.skill}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${AVAILABILITY_STYLES[w.availability] || 'bg-slate-100 text-slate-600'}`}>
                        {w.availability}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
