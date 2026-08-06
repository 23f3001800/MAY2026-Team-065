// Complaint queue — shared between the officer and admin areas, since both
// roles pass the backend's `["officer", "administrator"]` (or
// `["administrator", "officer"]`) check on every complaint-management
// endpoint: GET /complaints/, PATCH .../assign, .../status, .../category, and
// GET /workers/. The only difference between the two screens is copy.
//
// Filtering and sorting are client-side; GET /complaints/ takes no query
// parameters.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import ComplaintDrawer from '../../components/officer/ComplaintDrawer';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconSearch, IconChevronDown } from '../../components/dashboard/icons';
import Toast from '../../components/dashboard/Toast';
import { listComplaints, assignFieldWorker, updateComplaintStatus, recategoriseComplaint } from '../../api/complaints';
import { analyzeComplaint } from '../../api/ai';
import { listFieldWorkers } from '../../api/workers';
import { CATEGORIES, ASSIGNABLE_STATUSES } from '../../api/mappers';
import useAsync from '../../hooks/useAsync';

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Severity ordering so the queue surfaces the urgent work first.
const SEVERITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const CATEGORY_LABELS = CATEGORIES.map((c) => c.label);

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

export default function ComplaintQueue({ title, subtitle }) {
  const { data, error, loading, refetch, setData } = useAsync(() => listComplaints(), []);
  const items = useMemo(() => data || [], [data]);

  // Workers load independently: a failure here should not blank the queue, it
  // should just disable assignment.
  const [workers, setWorkers] = useState([]);
  const [workersError, setWorkersError] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [since, setSince] = useState('');

  useEffect(() => {
    let cancelled = false;
    listFieldWorkers()
      .then((w) => { if (!cancelled) setWorkers(w); })
      .catch((err) => {
        if (!cancelled && err.name !== 'SessionExpiredError') setWorkersError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  // Auto-dismiss now lives in <Toast>, which also handles the close button.

  const selected = items.find((c) => c.id === selectedId) || null;

  const counts = useMemo(() => ({
    unassigned: items.filter((c) => c.status === 'New').length,
    assigned: items.filter((c) => c.status === 'Assigned').length,
    resolved: items.filter((c) => c.status === 'Resolved').length,
    rejected: items.filter((c) => c.status === 'Rejected').length,
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

  // Every mutation returns the updated complaint, so the row is patched in
  // place rather than refetching the whole list.
  const applyUpdate = useCallback((updated) => {
    setData((list) => (list || []).map((c) => (c.id === updated.id ? updated : c)));
  }, [setData]);

  const runAction = useCallback(async (fn, successMessage) => {
    setBusy(true);
    setActionError('');
    try {
      const updated = await fn();
      applyUpdate(updated);
      setToast(successMessage);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }, [applyUpdate]);

  const handleRecategorise = (id, categoryId) => {
    const label = CATEGORIES.find((c) => c.categoryId === categoryId)?.label || categoryId;
    return runAction(() => recategoriseComplaint(id, categoryId), `${id} recategorised as ${label}.`);
  };

  const handleAssign = (id, worker) =>
    runAction(() => assignFieldWorker(id, worker.id), `${id} assigned to ${worker.name}.`);

  const handleStatusChange = (id, next, remarks) =>
    runAction(() => updateComplaintStatus(id, next, remarks), `${id} marked as ${next}.`);

  // POST /ai/complaints/{id}/analyze returns the triage result, not the
  // complaint, so refetch the row rather than trying to patch it from a
  // different shape.
  const handleAnalyse = useCallback(async (id) => {
    setBusy(true);
    setActionError('');
    try {
      await analyzeComplaint(id);
      const fresh = await listComplaints();
      setData(fresh);
      setToast(`${id} re-analysed.`);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }, [setData]);

  const resetFilters = () => {
    setQuery(''); setStatus('All'); setCategory('All'); setSeverity('All'); setSince('');
  };

  const statChips = [
    { label: 'Awaiting assignment', value: counts.unassigned, tone: 'bg-amber-50 text-amber-700 border-amber-200', filter: 'New' },
    { label: 'Assigned', value: counts.assigned, tone: 'bg-blue-50 text-blue-700 border-blue-200', filter: 'Assigned' },
    { label: 'Resolved', value: counts.resolved, tone: 'bg-violet-50 text-violet-700 border-violet-200', filter: 'Resolved' },
    { label: 'Rejected', value: counts.rejected, tone: 'bg-slate-100 text-slate-600 border-slate-200', filter: 'Rejected' },
  ];

  return (
    <div className="max-w-[1300px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-[14px] text-slate-500">{subtitle}</p>
      </div>

      <Toast message={toast} tone="success" onDismiss={() => setToast('')} />
      {/* Errors do not auto-hide: the action did not happen, so the user needs
          to read this at their own pace. */}
      <Toast message={actionError} tone="error" onDismiss={() => setActionError('')} autoHideMs={0} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statChips.map((s) => (
          <button
            key={s.label}
            onClick={() => setStatus(s.filter)}
            className={`text-left rounded-2xl border p-4 transition-colors hover:brightness-95 ${s.tone}`}
          >
            <div className="text-[26px] font-bold leading-none font-display">{s.value}</div>
            <div className="text-[12px] font-medium mt-1.5">{s.label}</div>
          </button>
        ))}
      </div>

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
        <FilterSelect label="Status" value={status} onChange={setStatus} options={ASSIGNABLE_STATUSES} allLabel="All Statuses" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORY_LABELS} allLabel="All Categories" />
        <FilterSelect label="Severity" value={severity} onChange={setSeverity} options={SEVERITIES} allLabel="All Severities" />
        <input
          type="date"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          aria-label="Reported on or after"
          className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer"
        />
      </div>

      {loading ? (
        <LoadingPanel label="Loading the complaint queue…" variant="table" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          title={items.length === 0 ? 'No complaints yet' : 'No complaints match'}
          message={items.length === 0 ? 'Nothing has been reported to the city yet.' : 'Try widening the filters.'}
        >
          {items.length > 0 && (
            <button onClick={resetFilters} className="text-[13px] font-semibold text-primary hover:underline">
              Clear all filters
            </button>
          )}
        </EmptyPanel>
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
                  <th className="font-semibold px-3 py-3">Status</th>
                  <th className="font-semibold px-3 py-3">Reported</th>
                  <th className="font-semibold px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{ '--i': i }}
                    className="border-t border-slate-100 hover:bg-slate-50 transition-colors animate-rise-in stagger"
                  >
                    <td className="px-5 py-3 text-[12px] font-mono text-slate-500 whitespace-nowrap">{c.id}</td>
                    <td className="px-3 py-3 text-[13px] font-medium text-slate-800">{c.issue}</td>
                    <td className="px-3 py-3 text-[13px] text-slate-600 whitespace-nowrap">{c.category}</td>
                    <td className="px-3 py-3"><SeverityBadge severity={c.severity} /></td>
                    <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{c.location}</td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-3 text-[12px] text-slate-400 whitespace-nowrap">{formatDate(c.reportedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setSelectedId(c.id)}
                        className="text-[12px] font-semibold text-primary hover:underline whitespace-nowrap"
                      >
                        {c.status === 'New' ? 'Review & assign' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                  <div className="mt-2"><SeverityBadge severity={c.severity} /></div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <p className="text-[12px] text-slate-400">Showing {filtered.length} of {items.length} complaints</p>
      )}

      {selected && (
        <ComplaintDrawer
          complaint={selected}
          workers={workers}
          workersError={workersError}
          busy={busy}
          onDismiss={() => setSelectedId(null)}
          onRecategorise={handleRecategorise}
          onAssign={handleAssign}
          onStatusChange={handleStatusChange}
          onAnalyse={handleAnalyse}
          onOpenComplaint={(id) => setSelectedId(id)}
        />
      )}
    </div>
  );
}
