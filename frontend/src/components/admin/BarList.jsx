// Horizontal bar list (CSS widths) for ranked categories.
// data: [{ label, value, color }].
import React from 'react';

export default function BarList({ data, title }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      {title && <h3 className="font-display font-bold text-slate-900 mb-4">{title}</h3>}
      <ul className="space-y-3.5">
        {data.map((d) => (
          <li key={d.label}>
            <div className="flex items-center justify-between text-[13px] mb-1">
              <span className="text-slate-600">{d.label}</span>
              <span className="font-semibold text-slate-800">{d.value.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
