// Small pill for a complaint's severity (backend SeverityEnum).
//
// Severity is ordinal, so this encodes rank twice: colour temperature climbs
// Low -> Critical, and the leading bars fill up. Someone scanning a queue for
// urgent work can then sort by eye without reading every label — and the rank
// still survives a colour-vision deficiency.
import React from 'react';

const STYLES = {
  Low: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', bars: 1 },
  Medium: { chip: 'bg-amber-50 text-amber-800 ring-amber-600/15', bars: 2 },
  High: { chip: 'bg-orange-50 text-orange-800 ring-orange-600/20', bars: 3 },
  Critical: { chip: 'bg-red-50 text-red-700 ring-red-600/25', bars: 4 },
};

const FALLBACK = { chip: 'bg-slate-100 text-slate-600 ring-slate-500/15', bars: 0 };

export default function SeverityBadge({ severity, className = '' }) {
  const { chip, bars } = STYLES[severity] || FALLBACK;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ring-inset ${chip} ${className}`}
      title={`Severity: ${severity}`}
    >
      {/* Rising bars. aria-hidden because the label beside it says the same
          thing — announcing it twice is noise for a screen reader. */}
      <span className="flex items-end gap-[2px] h-[10px]" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`w-[2.5px] rounded-[1px] bg-current ${n <= bars ? 'opacity-100' : 'opacity-25'}`}
            style={{ height: `${3 + n * 1.8}px` }}
          />
        ))}
      </span>
      {severity}
    </span>
  );
}
