// Officer complaint queue — the screen the grievance workflow runs through.
// Filter and search the department's complaints, then open one to review the
// AI classification, override it, merge duplicates, assign a field worker, or
// verify resolution evidence and close it.
//
// All actions mutate local state only; see mockOfficerQueue.js for the
// endpoints these map to once the backend exists.
import React, { useEffect, useMemo, useState } from 'react';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import ComplaintDrawer from '../../components/officer/ComplaintDrawer';
import {
  IconSearch, IconChevronDown, IconInbox, IconSparkles, IconAlertTriangle, IconCheckCircle,
} from '../../components/dashboard/icons';
import {
  queue as seedQueue, workers, CATEGORIES, SEVERITIES, QUEUE_STATUSES,
} from '../../data/mockOfficerQueue';

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Severity ordering so the queue surfaces the urgent work first.
const SEVERITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="appearance-none bg-white rounded-xl border border-slate-200 pl-3.5 pr-9 py-2.5 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer"
      >
        <option value="All">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <IconChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

export default function OfficerComplaints() {
  const [items, setItems] = useState(seedQueue);
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [since, setSince] = useState('');

  // Auto-dismiss the confirmation banner.
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = items.find((c) => c.id === selectedId) || null;

  const counts = useMemo(() => ({
    unassigned: items.filter((c) => c.status === 'New').length,
    active: items.filter((c) => c.status === 'Assigned' || c.status === 'In Progress').length,
    verify: items.filter((c) => c.status === 'Resolved').length,
    duplicates: items.filter((c) => c.duplicateCandidates?.length > 0 && c.status !== 'Merged').length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((c) => {
        if (status !== 'All' && c.status !== status) return false;
        if (category !== 'All' && c.category !== category) return false;
        if (severity !== 'All' && c.severity !== severity) return false;
        if (since && new Date(c.reportedAt) < new Date(since)) return false;
        if (q && !`${c.issue} ${c.id} ${c.location} ${c.description}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const rank = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
        return rank !== 0 ? rank : new Date(b.reportedAt) - new Date(a.reportedAt);
      });
  }, [items, query, status, category, severity, since]);

  const patch = (id, changes) =>
    setItems((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));

  const handleOverride = (id, { category: cat, severity: sev }) => {
    patch(id, { category: cat, severity: sev });
    setToast(`${id} reclassified as ${cat} · ${sev}.`);
  };

  const handleAssign = (id, worker) => {
    patch(id, { worker: worker.name, status: 'Assigned' });
    setToast(`${id} assigned to ${worker.name}.`);
  };

  const handleMerge = (id, intoId) => {
    patch(id, { status: 'Merged', duplicateCandidates: [], mergedInto: intoId });
    setToast(`${id} merged into ${intoId}.`);
    setSelectedId(null);
  };

  const handleClose = (id) => {
    patch(id, { status: 'Closed' });
    setToast(`${id} verified and closed.`);
  };

  const resetFilters = () => {
    setQuery(''); setStatus('All'); setCategory('All'); setSeverity('All'); setSince('');
  };

  const statChips = [
    { label: 'Awaiting assignment', value: counts.unassigned, tone: 'bg-amber-50 text-amber-700 border-amber-200', filter: 'New' },
    { label: 'Active', value: counts.active, tone: 'bg-blue-50 text-blue-700 border-blue-200', filter: null },
    { label: 'Awaiting verification', value: counts.verify, tone: 'bg-violet-50 text-violet-700 border-violet-200', filter: 'Resolved' },
    { label: 'Possible duplicates', value: counts.duplicates, tone: 'bg-slate-100 text-slate-600 border-slate-200', filter: null },
  ];

  return (
    <div className="max-w-[1300px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Complaint Queue</h1>
        <p className="text-[14px] text-slate-500">
          Review, prioritise and assign complaints routed to your department.
        </p>
      </div>

      {toast && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-medium px-4 py-3 rounded-xl">
          <IconCheckCircle size={16} className="shrink-0" /> {toast}
        </div>
      )}

      {/* At-a-glance counts; the actionable ones filter the table. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statChips.map((s) => (
          <button
            key={s.label}
            onClick={() => s.filter && setStatus(s.filter)}
            disabled={!s.filter}
            className={`text-left rounded-2xl border p-4 transition-colors ${s.tone} ${
              s.filter ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className="text-[26px] font-bold leading-none font-display">{s.value}</div>
            <div className="text-[12px] font-medium mt-1.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100 transition">
          <IconSearch size={18} className="text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, issue, location…"
            aria-label="Search complaints"
            className="flex-1 py-2.5 text-[14px] text-slate-800 outline-none bg-transparent"
          />
        </div>
        <FilterSelect label="Status" value={status} onChange={setStatus} options={QUEUE_STATUSES} allLabel="All Statuses" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORIES} allLabel="All Categories" />
        <FilterSelect label="Severity" value={severity} onChange={setSeverity} options={SEVERITIES} allLabel="All Severities" />
        <input
          type="date"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          aria-label="Reported on or after"
          className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer"
        />
      </div>

      {/* Queue */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <IconInbox size={26} />
          </div>
          <h2 className="font-display font-bold text-slate-800 text-lg">No complaints match</h2>
          <p className="text-[14px] text-slate-500 mt-1">Try widening the filters.</p>
          <button onClick={resetFilters} className="mt-4 text-[13px] font-semibold text-primary hover:underline">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="font-semibold px-5 py-3">ID</th>
                  <th className="font-semibold px-3 py-3">Issue</th>
                  <th className="font-semibold px-3 py-3">Category</th>
                  <th className="font-semibold px-3 py-3">Severity</th>
                  <th className="font-semibold px-3 py-3">Location</th>
                  <th className="font-semibold px-3 py-3">Assigned</th>
                  <th className="font-semibold px-3 py-3">Status</th>
                  <th className="font-semibold px-3 py-3">Reported</th>
                  <th className="font-semibold px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const overridden = c.category !== c.aiCategory;
                  const dupes = c.duplicateCandidates?.length > 0 && c.status !== 'Merged';
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-[12px] font-mono text-slate-500 whitespace-nowrap">{c.id}</td>
                      <td className="px-3 py-3">
                        <div className="text-[13px] font-medium text-slate-800">{c.issue}</div>
                        {dupes && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 mt-1">
                            <IconAlertTriangle size={11} /> {c.duplicateCandidates.length} possible duplicate
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-[13px] text-slate-600">{c.category}</div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-0.5 ${
                          overridden ? 'text-slate-400' : c.aiConfidence < 0.6 ? 'text-amber-600' : 'text-primary'
                        }`}>
                          <IconSparkles size={10} />
                          {overridden ? 'Overridden' : `AI ${Math.round(c.aiConfidence * 100)}%`}
                        </span>
                      </td>
                      <td className="px-3 py-3"><SeverityBadge severity={c.severity} /></td>
                      <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{c.location}</td>
                      <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                        {c.worker || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-3 py-3 text-[12px] text-slate-400 whitespace-nowrap">{formatDate(c.reportedAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setSelectedId(c.id)}
                          className="text-[12px] font-semibold text-primary hover:underline whitespace-nowrap"
                        >
                          {c.status === 'New' ? 'Review & assign' : c.status === 'Resolved' ? 'Verify' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Compact cards below the table breakpoint */}
          <ul className="lg:hidden divide-y divide-slate-100">
            {filtered.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelectedId(c.id)} className="w-full text-left p-4 active:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[14px] font-medium text-slate-800">{c.issue}</div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-[12px] font-mono text-slate-400 mt-0.5">{c.id}</div>
                  <div className="flex items-center gap-2 mt-2 text-[12px] text-slate-500">
                    <span>{c.category}</span><span>·</span><span>{c.location}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <SeverityBadge severity={c.severity} />
                    <span className="text-[12px] text-slate-400">{c.worker || 'Unassigned'}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[12px] text-slate-400">Showing {filtered.length} of {items.length} complaints</p>

      {selected && (
        <ComplaintDrawer
          complaint={selected}
          workers={workers}
          onDismiss={() => setSelectedId(null)}
          onOverride={handleOverride}
          onAssign={handleAssign}
          onMerge={handleMerge}
          onCloseComplaint={handleClose}
        />
      )}
    </div>
  );
}
