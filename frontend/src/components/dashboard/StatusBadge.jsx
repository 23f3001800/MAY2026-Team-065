// Colored pill for a complaint status.
//
// Each status carries a dot as well as a colour. Colour alone fails for the
// ~8% of men with a colour-vision deficiency, and these pills are how the whole
// app communicates state — the dot plus the label is what actually does the
// work, with colour as reinforcement.
import React from 'react';

const STYLES = {
  'New': { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', dot: 'bg-emerald-500' },
  'Assigned': { chip: 'bg-amber-50 text-amber-800 ring-amber-600/15', dot: 'bg-amber-500' },
  'In Progress': { chip: 'bg-blue-50 text-blue-700 ring-blue-600/15', dot: 'bg-blue-500' },
  'Resolved': { chip: 'bg-violet-50 text-violet-700 ring-violet-600/15', dot: 'bg-violet-500' },
  'Rejected': { chip: 'bg-red-50 text-red-700 ring-red-600/15', dot: 'bg-red-500' },
  'Critical': { chip: 'bg-red-50 text-red-700 ring-red-600/15', dot: 'bg-red-500' },
  'Closed': { chip: 'bg-slate-100 text-slate-700 ring-slate-500/15', dot: 'bg-slate-500' },
  'Merged': { chip: 'bg-slate-100 text-slate-600 ring-slate-500/15', dot: 'bg-slate-400' },
};

const FALLBACK = { chip: 'bg-slate-100 text-slate-600 ring-slate-500/15', dot: 'bg-slate-400' };

// Statuses that mean "someone is working on this right now" get a live dot.
const ACTIVE = new Set(['In Progress']);

export default function StatusBadge({ status, className = '' }) {
  const { chip, dot } = STYLES[status] || FALLBACK;
  const live = ACTIVE.has(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${chip} ${className}`}
    >
      <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
        {live && (
          <span className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${dot}`} />
        )}
        <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${dot}`} />
      </span>
      {status}
    </span>
  );
}
