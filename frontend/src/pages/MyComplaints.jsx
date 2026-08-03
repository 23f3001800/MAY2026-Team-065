// My Complaints — the citizen's full complaint history with status tabs,
// text search, and a category filter.
//
// Backed by GET /complaints/, which the backend scopes to the signed-in citizen.
// Filtering and search run client-side: the endpoint takes no query parameters,
// and a citizen's own list is small enough that it does not matter.
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/dashboard/StatusBadge';
import SeverityBadge from '../components/dashboard/SeverityBadge';
import { LoadingPanel, ErrorPanel, EmptyPanel } from '../components/dashboard/AsyncStates';
import { IconSearch, IconChevronDown, IconEye, IconReport } from '../components/dashboard/icons';
import { STATUS_FILTERS, CATEGORY_FILTERS } from '../data/filters';
import { listComplaints } from '../api/complaints';
import useAsync from '../hooks/useAsync';

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyComplaints() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');

  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const complaints = useMemo(() => data || [], [data]);

  // Counts per status for the tab badges.
  const counts = useMemo(() => {
    const c = { All: complaints.length };
    for (const item of complaints) c[item.status] = (c[item.status] || 0) + 1;
    return c;
  }, [complaints]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return complaints.filter((c) => {
      if (status !== 'All' && c.status !== status) return false;
      if (category !== 'All' && c.category !== category) return false;
      if (q && !(`${c.issue} ${c.id} ${c.location}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [complaints, status, category, query]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">My Complaints</h1>
          <p className="text-[14px] text-slate-500">Track and manage the issues you've reported.</p>
        </div>
        <Link
          to="/report"
          className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
        >
          <IconReport size={16} /> Report Issue
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                active ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s}
              <span className={`text-[11px] font-bold px-1.5 rounded-full ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>
                {counts[s] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + category filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-emerald-100 transition">
          <IconSearch size={18} className="text-slate-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, issue or location…"
            className="flex-1 py-2.5 text-[14px] text-slate-800 outline-none bg-transparent"
          />
        </div>
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="appearance-none bg-white rounded-xl border border-slate-200 pl-3.5 pr-9 py-2.5 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer"
          >
            {CATEGORY_FILTERS.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
            ))}
          </select>
          <IconChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Result set */}
      {loading ? (
        <LoadingPanel label="Loading your complaints…" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          title={complaints.length === 0 ? 'No complaints yet' : 'No complaints found'}
          message={
            complaints.length === 0
              ? "You haven't reported anything yet. When you do, it will show up here."
              : 'Try changing the filters, or report a new issue.'
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="font-semibold px-5 py-3">ID</th>
                  <th className="font-semibold px-3 py-3">Issue</th>
                  <th className="font-semibold px-3 py-3">Category</th>
                  <th className="font-semibold px-3 py-3">Location</th>
                  <th className="font-semibold px-3 py-3">Severity</th>
                  <th className="font-semibold px-3 py-3">Status</th>
                  <th className="font-semibold px-3 py-3">Date</th>
                  <th className="font-semibold px-5 py-3 text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-[12px] font-mono text-slate-500 whitespace-nowrap">{c.id}</td>
                    <td className="px-3 py-3 text-[13px] font-medium text-slate-800">{c.issue}</td>
                    <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{c.category}</td>
                    <td className="px-3 py-3 text-[13px] text-slate-500 whitespace-nowrap">{c.location}</td>
                    <td className="px-3 py-3"><SeverityBadge severity={c.severity} /></td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-3 text-[12px] text-slate-400 whitespace-nowrap">{formatDate(c.date)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/complaints/${c.id}`} className="inline-flex text-slate-400 hover:text-primary" aria-label={`View ${c.id}`}>
                        <IconEye size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden divide-y divide-slate-100">
            {filtered.map((c) => (
              <li
                key={c.id}
                onClick={() => navigate(`/complaints/${c.id}`)}
                className="p-4 active:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-slate-800 text-[14px]">{c.issue}</div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-[12px] font-mono text-slate-400 mt-0.5">{c.id}</div>
                <div className="flex items-center gap-2 mt-2 text-[12px] text-slate-500">
                  <span>{c.category}</span><span>·</span><span>{c.location}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <SeverityBadge severity={c.severity} />
                  <span className="text-[12px] text-slate-400">{formatDate(c.date)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && complaints.length > 0 && (
        <p className="text-[12px] text-slate-400">
          Showing {filtered.length} of {complaints.length} complaints
        </p>
      )}
    </div>
  );
}
