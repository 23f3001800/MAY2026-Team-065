// Categories — the five complaint categories the backend recognises, plus
// how many complaints currently sit in each.
//
// There is no GET /categories endpoint, so the category list itself
// (id/name/department) is CATEGORIES in api/mappers.js, a hardcoded mirror of
// backend/seed.py -- the two must be edited together. The per-category counts
// are real, computed from GET /complaints/.
import React, { useMemo } from 'react';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import UnavailableNote from '../../components/dashboard/UnavailableNote';
import { IconTag, IconBuilding } from '../../components/dashboard/icons';
import { CATEGORIES } from '../../api/mappers';
import { listComplaints } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';

export default function AdminCategories() {
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const complaints = useMemo(() => data || [], [data]);

  const counts = useMemo(() => {
    const m = new Map();
    for (const c of complaints) m.set(c.category, (m.get(c.category) || 0) + 1);
    return m;
  }, [complaints]);

  return (
    <div className="max-w-[900px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Categories</h1>
        <p className="text-[14px] text-slate-500">The complaint categories the backend recognises today.</p>
      </div>

      <UnavailableNote>
        There is no endpoint to manage categories — this list mirrors the five categories seeded in
        <code className="mx-1 px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono">backend/seed.py</code>
        and can't be edited from here. The complaint counts alongside each one are real.
      </UnavailableNote>

      {loading ? (
        <LoadingPanel label="Counting complaints per category…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CATEGORIES.map((c) => (
            <li key={c.categoryId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-emerald-50 text-primary flex items-center justify-center shrink-0">
                    <IconTag size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-slate-800 truncate">{c.label}</div>
                    <div className="text-[12px] text-slate-400 truncate">{c.name}</div>
                  </div>
                </div>
                <div className="font-display text-[22px] font-bold text-slate-900 shrink-0">{counts.get(c.label) || 0}</div>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
                <IconBuilding size={13} className="text-slate-400" /> Routed to {c.department}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
