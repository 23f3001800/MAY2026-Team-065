// Colored pill for a complaint status. Maps the backend StatusEnum values
// to light-theme tints.
import React from 'react';

const STYLES = {
  'New': 'bg-emerald-100 text-emerald-700',
  'Assigned': 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Resolved': 'bg-violet-100 text-violet-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Critical': 'bg-red-100 text-red-700',
  'Closed': 'bg-slate-200 text-slate-700',
  'Merged': 'bg-slate-200 text-slate-600',
};

export default function StatusBadge({ status }) {
  const cls = STYLES[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}
