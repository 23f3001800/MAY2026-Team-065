// Complaint queue — shared between the officer and admin areas, since both
// roles pass the backend's `["officer", "administrator"]` (or
// `["administrator", "officer"]`) check on every complaint-management
// endpoint: GET /complaints/, PATCH .../assign, .../status, .../category, and
// GET /workers/. The only difference between the two screens is copy.
//
// Filtering and sorting are client-side; GET /complaints/ takes no query
// parameters.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge';
import SeverityBadge from '../../components/dashboard/SeverityBadge';
import ConfidenceBadge, { DOUBTFUL_BELOW } from '../../components/dashboard/ConfidenceBadge';
import ComplaintDrawer from '../../components/officer/ComplaintDrawer';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../../components/dashboard/AsyncStates';
import { IconSearch, IconChevronDown } from '../../components/dashboard/icons';
import Toast from '../../components/dashboard/Toast';
import {
  listComplaints, assignFieldWorker, updateComplaintStatus, recategoriseComplaint,
  overrideSeverity, mergeComplaint, bulkAssign,
} from '../../api/complaints';
import { analyzeComplaint } from '../../api/ai';
import { listFieldWorkers } from '../../api/workers';
import { CATEGORIES, ASSIGNABLE_STATUSES } from '../../api/mappers';
import useAsync from '../../hooks/useAsync';
import { getCurrentUser } from '../../api/auth';
import { complaintPath } from '../../api/session';
import ComplaintMap from '../../components/map/ComplaintMap';

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
  // Table for triage, map for spotting clusters — the same filtered set either way.
  const [view, setView] = useState('table');

  // How the queue is ordered.
  //
  //   severity   what is worst, then oldest — the default triage judgement
  //   confidence least-confident classification first, so the ones the model
  //              was unsure about get a human eye before the obvious ones
  //   deadline   closest to its SLA deadline first
  //
  // Confidence ordering is the point of FB-05: the score was visible per
  // complaint but there was no way to bring the doubtful ones to the top, which
  // is what an officer actually asked for.
  const [sortBy, setSortBy] = useState('severity');
  // Hide complaints the classifier never saw. They are not "low confidence" —
  // they have no confidence at all — and mixing them in buries the ones worth
  // re-checking.
  const [onlyDoubtful, setOnlyDoubtful] = useState(false);

  // Complaints picked for a bulk action. A Set because membership is checked
  // once per row on every render.
  const [picked, setPicked] = useState(() => new Set());
  const [bulkWorkerId, setBulkWorkerId] = useState('');
  const [bulkResult, setBulkResult] = useState(null);

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
      .filter((c) => {
        if (!onlyDoubtful) return true;
        // A complaint with no score was never classified. That is a different
        // queue from "classified badly", so it is excluded rather than treated
        // as zero-confidence and floated to the top.
        return typeof c.ai?.confidence === 'number' && c.ai.confidence < DOUBTFUL_BELOW;
      })
      .sort((a, b) => {
        if (sortBy === 'confidence') {
          const ca = a.ai?.confidence;
          const cb = b.ai?.confidence;
          // Unclassified sorts last either way — it is not evidence of doubt.
          if (typeof ca !== 'number' && typeof cb !== 'number') return 0;
          if (typeof ca !== 'number') return 1;
          if (typeof cb !== 'number') return -1;
          return ca - cb;
        }
        if (sortBy === 'deadline') {
          const da = a.expectedResolutionAt ? new Date(a.expectedResolutionAt) : null;
          const db = b.expectedResolutionAt ? new Date(b.expectedResolutionAt) : null;
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da - db;
        }
        const rank = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
        return rank !== 0 ? rank : new Date(b.reportedAt) - new Date(a.reportedAt);
      });
  }, [items, query, status, category, severity, since, sortBy, onlyDoubtful]);

  // Picking survives filtering, but acting on something you cannot see is a
  // trap, so the bulk bar only ever counts what is currently on screen.
  const pickedVisible = useMemo(
    () => filtered.filter((c) => picked.has(c.id)),
    [filtered, picked],
  );

  const togglePick = useCallback((id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const pickAllVisible = useCallback(() => {
    setPicked((prev) => {
      const next = new Set(prev);
      const allPicked = filtered.every((c) => next.has(c.id));
      for (const c of filtered) {
        if (allPicked) next.delete(c.id); else next.add(c.id);
      }
      return next;
    });
  }, [filtered]);

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

  const handleOverrideSeverity = (id, next, remarks) =>
    runAction(() => overrideSeverity(id, next, remarks), `${id} severity set to ${next}.`);

  // A merge changes both complaints -- the duplicate closes and the target
  // gains a link -- so refetch rather than patching a single row.
  const handleMerge = useCallback(async (id, intoId, remarks) => {
    setBusy(true);
    setActionError('');
    try {
      await mergeComplaint(id, intoId, remarks);
      setData(await listComplaints());
      setToast(`${id} merged into ${intoId}.`);
      setSelectedId(null);
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }, [setData]);

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
    setSortBy('severity'); setOnlyDoubtful(false);
  };

  /**
   * Assign everything picked to one worker.
   *
   * Partial success is the normal outcome — an already-resolved complaint in
   * the batch fails on its own — so the per-complaint reasons are kept and
   * shown rather than collapsed into "some failed". Only the ones that took are
   * dropped from the selection, leaving the failures picked so the officer can
   * see what still needs a decision.
   */
  const runBulkAssign = useCallback(async () => {
    const ids = pickedVisible.map((c) => c.id);
    if (!ids.length || !bulkWorkerId) return;
    setBusy(true);
    setActionError('');
    setBulkResult(null);
    try {
      const result = await bulkAssign(ids, bulkWorkerId);
      setBulkResult(result);
      setPicked((prev) => {
        const next = new Set(prev);
        for (const id of result.assigned || []) next.delete(id);
        return next;
      });
      if (result.assignedCount) {
        setToast(
          result.failedCount
            ? `${result.assignedCount} assigned, ${result.failedCount} could not be.`
            : `${result.assignedCount} complaint${result.assignedCount === 1 ? '' : 's'} assigned.`,
        );
      }
      await refetch();
    } catch (err) {
      if (err.name !== 'SessionExpiredError') setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }, [pickedVisible, bulkWorkerId, refetch]);

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
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort the queue"
            className="appearance-none bg-white rounded-xl border border-slate-200 pl-3.5 pr-9 py-2.5 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer"
          >
            <option value="severity">Most severe first</option>
            <option value="confidence">Least confident AI first</option>
            <option value="deadline">Closest deadline first</option>
          </select>
          <IconChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        {/* The other half of FB-05: sorting brings the doubtful ones up, this
            removes everything else so a triage pass is a finite list. */}
        <button
          onClick={() => setOnlyDoubtful((v) => !v)}
          aria-pressed={onlyDoubtful}
          title="Complaints the classifier was less than 60% sure about"
          className={`focus-ring px-3.5 py-2.5 rounded-xl border text-[13px] font-semibold transition-colors ${
            onlyDoubtful
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Needs a second look
        </button>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white" role="group" aria-label="View">
          {['table', 'map'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`focus-ring px-3.5 py-2.5 text-[13px] font-medium capitalize transition-colors ${
                view === v ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk assignment. Complaints in one ward usually go to one worker, and
          doing that a row at a time is slow enough that officers batch it up
          mentally and lose half of it. Only counts what is currently visible —
          acting on rows a filter is hiding is a trap. */}
      {pickedVisible.length > 0 && (
        <div className="sticky top-2 z-20 flex items-center gap-3 flex-wrap bg-leaf-700 text-white rounded-xl px-4 py-3 shadow-md">
          <span className="text-[13px] font-semibold">
            {pickedVisible.length} selected
          </span>
          <select
            value={bulkWorkerId}
            onChange={(e) => setBulkWorkerId(e.target.value)}
            aria-label="Assign selected complaints to"
            className="bg-white/10 border border-white/25 rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-white/60"
          >
            <option value="" className="text-slate-800">Choose a field worker…</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id} className="text-slate-800">
                {w.name}{w.skillSet ? ` — ${w.skillSet}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={runBulkAssign}
            disabled={busy || !bulkWorkerId}
            className="focus-ring bg-white text-leaf-800 font-semibold text-[13px] px-3.5 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {busy ? 'Assigning…' : `Assign ${pickedVisible.length}`}
          </button>
          <button
            onClick={() => { setPicked(new Set()); setBulkResult(null); }}
            className="focus-ring text-[13px] font-medium text-white/80 hover:text-white underline"
          >
            Clear
          </button>
          <span className="text-[11.5px] text-white/70">
            A worker whose skills do not cover a complaint's department will be refused for that one.
          </span>
        </div>
      )}

      {/* Per-complaint outcomes. A batch where three of twenty failed is the
          normal case, and "some failed" is not something an officer can act on. */}
      {bulkResult?.failedCount > 0 && (
        <div className="bg-caution-50 border border-caution-100 rounded-xl px-4 py-3">
          <div className="text-[13px] font-semibold text-caution-800">
            {bulkResult.failedCount} could not be assigned
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {bulkResult.failed.map((f) => (
              <li key={f.complaintId} className="text-[12px] text-caution-800">
                <span className="font-mono">{f.complaintId}</span> — {f.reason}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setBulkResult(null)}
            className="text-[12px] font-semibold text-caution-800 underline mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

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
      ) : view === 'map' ? (
        <ComplaintMap
          complaints={filtered}
          height="520px"
          onSelect={(c) => setSelectedId(c.id)}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select every visible complaint"
                      checked={filtered.length > 0 && filtered.every((c) => picked.has(c.id))}
                      onChange={pickAllVisible}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-emerald-200 cursor-pointer"
                    />
                  </th>
                  <th className="font-semibold px-3 py-3">ID</th>
                  <th className="font-semibold px-3 py-3">Issue</th>
                  <th className="font-semibold px-3 py-3">Category</th>
                  {/* The key the queue can be ordered by. Without it on screen,
                      "least confident first" is indistinguishable from no order. */}
                  <th className="font-semibold px-3 py-3">AI confidence</th>
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
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.id}`}
                        checked={picked.has(c.id)}
                        onChange={() => togglePick(c.id)}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-emerald-200 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-3 text-[12px] font-mono whitespace-nowrap">
                      {/* The drawer is for a triage pass; the reference opens
                          the full record for the reading and deciding half. */}
                      <Link
                        to={complaintPath(getCurrentUser()?.role, c.id)}
                        className="focus-ring rounded text-slate-500 hover:text-leaf-700 hover:underline"
                      >
                        {c.id}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[13px] font-medium text-slate-800">{c.issue}</td>
                    <td className="px-3 py-3 text-[13px] text-slate-600 whitespace-nowrap">{c.category}</td>
                    <td className="px-3 py-3">
                      <ConfidenceBadge value={c.ai?.confidence} />
                    </td>
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
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={c.severity} />
                    <ConfidenceBadge value={c.ai?.confidence} showMeter={false} />
                  </div>
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
          role={getCurrentUser()?.role}
          onOverrideSeverity={handleOverrideSeverity}
          onMerge={handleMerge}
          onOpenComplaint={(id) => setSelectedId(id)}
        />
      )}
    </div>
  );
}
