// Complaints-by-category donut. Pure SVG (pathLength=100 trick) so each
// segment's dash length equals its percentage — no chart dependency.
import React from 'react';

export default function CategoryDonut({ data }) {
  let cumulative = 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 className="font-display font-bold text-slate-900 mb-4">Complaints by Category</h3>

      <div className="flex items-center gap-6 flex-wrap">
        <svg viewBox="0 0 42 42" className="w-36 h-36 shrink-0 -rotate-90" role="img" aria-label="Complaints by category">
          {/* Track */}
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="5" />
          {data.map((seg) => {
            const dash = `${seg.percent} ${100 - seg.percent}`;
            const offset = -cumulative;
            cumulative += seg.percent;
            return (
              <circle
                key={seg.label}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={seg.color}
                strokeWidth="5"
                strokeDasharray={dash}
                strokeDashoffset={offset}
                pathLength="100"
              />
            );
          })}
        </svg>

        {/* Legend */}
        <ul className="flex-1 min-w-[150px] space-y-2.5">
          {data.map((seg) => (
            <li key={seg.label} className="flex items-center gap-2.5 text-[13px]">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-slate-600 flex-1">{seg.label}</span>
              <span className="font-semibold text-slate-800">{seg.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
