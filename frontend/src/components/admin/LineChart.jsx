// Minimal responsive line chart (SVG, no dependency) for a small time series.
// data: [{ label, value }]. Draws gridlines, an area fill, the line and dots.
import React from 'react';

const W = 340;
const H = 180;
const PAD = { top: 16, right: 12, bottom: 26, left: 32 };

export default function LineChart({ data, title }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  // Round the top gridline up to a "nice" number.
  const top = Math.ceil(max / 100) * 100 || 100;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const y = (v) => PAD.top + innerH - (v / top) * innerH;

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPath = `M ${x(0)},${PAD.top + innerH} L ${data.map((d, i) => `${x(i)},${y(d.value)}`).join(' L ')} L ${x(data.length - 1)},${PAD.top + innerH} Z`;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      {title && <h3 className="font-display font-bold text-slate-900 mb-4">{title}</h3>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title || 'Line chart'}>
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + y labels */}
        {gridLines.map((g) => {
          const gy = PAD.top + innerH - g * innerH;
          return (
            <g key={g}>
              <line x1={PAD.left} y1={gy} x2={W - PAD.right} y2={gy} stroke="#f1f5f9" strokeWidth="1" />
              <text x={PAD.left - 6} y={gy + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                {Math.round(g * top)}
              </text>
            </g>
          );
        })}

        {/* Area + line */}
        <path d={areaPath} fill="url(#lineFill)" />
        <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots + x labels */}
        {data.map((d, i) => (
          <g key={d.label}>
            <circle cx={x(i)} cy={y(d.value)} r="3.5" fill="#fff" stroke="#10b981" strokeWidth="2" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
