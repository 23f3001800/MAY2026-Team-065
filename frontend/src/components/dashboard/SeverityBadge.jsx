// Small pill for a complaint's severity (backend SeverityEnum).
import React from 'react';

const STYLES = {
  Low: 'bg-emerald-50 text-emerald-700',
  Medium: 'bg-amber-50 text-amber-700',
  High: 'bg-red-50 text-red-700',
  Critical: 'bg-red-100 text-red-800',
};

export default function SeverityBadge({ severity }) {
  const cls = STYLES[severity] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}
