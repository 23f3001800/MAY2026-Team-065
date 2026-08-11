// Reports — filter the full complaint list and export it as CSV.
//
// There is no backend report-generation endpoint, so this builds the report
// entirely client-side from GET /complaints/ (which admins already receive
// in full) rather than inventing a "reports" data model that doesn't exist.
// The filters mirror the ones on the complaint queue.
import React, { useMemo, useState } from 'react';
import StatTile from '../../components/dashboard/StatTile';
import { LoadingPanel, ErrorPanel } from '../../components/dashboard/AsyncStates';
import { IconChevronDown, IconReport } from '../../components/dashboard/icons';
import { CATEGORIES, ASSIGNABLE_STATUSES } from '../../api/mappers';
import { listComplaints } from '../../api/complaints';
import useAsync from '../../hooks/useAsync';
import SlaSweepPanel from '../../components/admin/SlaSweepPanel';
import ResolutionReportPanel from '../../components/admin/ResolutionReportPanel';

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const CATEGORY_LABELS = CATEGORIES.map((c) => c.label);

function toCsv(rows) {
  const headers = ['ID', 'Issue', 'Category', 'Severity', 'Status', 'Location', 'Reported', 'Last Updated'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const c of rows) {
    lines.push([c.id, c.issue, c.category, c.severity, c.status, c.location, c.reportedAt, c.updatedAt].map(escape).join(','));
  }
  return lines.join('\n');
}

function downloadCsv(rows) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `complaints-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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

export default function AdminReports() {
  const { data, error, loading, refetch } = useAsync(() => listComplaints(), []);
  const complaints = useMemo(() => data || [], [data]);

  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => complaints.filter((c) => {
    if (status !== 'All' && c.status !== status) return false;
    if (category !== 'All' && c.category !== category) return false;
    if (severity !== 'All' && c.severity !== severity) return false;
    if (from && new Date(c.reportedAt) < new Date(from)) return false;
    if (to && new Date(c.reportedAt) > new Date(`${to}T23:59:59`)) return false;
    return true;
  }), [complaints, status, category, severity, from, to]);

  const resolved = filtered.filter((c) => c.status === 'Resolved').length;

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-[14px] text-slate-500">Filter the complaint record and export it as CSV.</p>
        </div>
        <button
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-[14px] px-4 py-2.5 rounded-xl shadow-btn transition-colors"
        >
          <IconReport size={16} /> Export CSV ({filtered.length})
        </button>
      </div>

      <ResolutionReportPanel complaints={complaints} />

      <SlaSweepPanel />

      {loading ? (
        <LoadingPanel label="Loading complaints…" variant="table" />
      ) : error ? (
        <ErrorPanel error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="flex gap-3 flex-wrap">
            <FilterSelect label="Status" value={status} onChange={setStatus} options={ASSIGNABLE_STATUSES} allLabel="All Statuses" />
            <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORY_LABELS} allLabel="All Categories" />
            <FilterSelect label="Severity" value={severity} onChange={setSeverity} options={SEVERITIES} allLabel="All Severities" />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] text-slate-700 outline-none focus:border-primary cursor-pointer" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatTile label="Matching Complaints" value={filtered.length} tone="emerald" />
            <StatTile label="Resolved" value={resolved} tone="purple" />
            <StatTile label="Resolution Rate" value={filtered.length ? `${Math.round((resolved / filtered.length) * 100)}%` : '—'} tone="blue" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="font-semibold px-5 py-3">ID</th>
                    <th className="font-semibold px-3 py-3">Issue</th>
                    <th className="font-semibold px-3 py-3">Category</th>
                    <th className="font-semibold px-3 py-3">Severity</th>
                    <th className="font-semibold px-3 py-3">Status</th>
                    <th className="font-semibold px-5 py-3">Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-5 py-2.5 text-[12px] font-mono text-slate-500 whitespace-nowrap">{c.id}</td>
                      <td className="px-3 py-2.5 text-[13px] text-slate-700">{c.issue}</td>
                      <td className="px-3 py-2.5 text-[13px] text-slate-500 whitespace-nowrap">{c.category}</td>
                      <td className="px-3 py-2.5 text-[13px] text-slate-500 whitespace-nowrap">{c.severity}</td>
                      <td className="px-3 py-2.5 text-[13px] text-slate-500 whitespace-nowrap">{c.status}</td>
                      <td className="px-5 py-2.5 text-[12px] text-slate-400 whitespace-nowrap">{new Date(c.reportedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
