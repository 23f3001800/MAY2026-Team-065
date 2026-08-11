// Chart primitives, in one module.
//
// These replace three near-duplicate components — admin/BarList, admin/LineChart
// and dashboard/CategoryDonut — which each hardcoded their own palette, empty
// state and label formatting. Four dashboards imported some mixture of them, so
// the same bar looked different depending on which page you were on.
//
// Shared rules, applied by every chart here:
//
//   * One categorical palette, ordered so adjacent series stay distinguishable
//     in greyscale as well as colour.
//   * Every value is labelled. A bar you cannot read the number off is
//     decoration, and this is an operations tool.
//   * Empty is an explicit state, never an empty box.
//   * SVG carries role="img" with a text summary, because a screen reader
//     gets nothing useful from the shapes.
import React, { useId, useState } from 'react';

// Civic-derived categorical ramp. Navy leads because it is the product's
// anchor; teal and amber follow because they already carry meaning elsewhere in
// the app (resolved / needs attention), so a chart reusing them reads
// consistently rather than arbitrarily.
export const SERIES = [
  '#1d4a78', // civic-600
  '#0e7c66', // teal-600
  '#b45309', // amber-600
  '#4d86b8', // civic-400
  '#12a184', // teal-500
  '#8593a1', // ink-400
];

export function seriesColor(i) {
  return SERIES[i % SERIES.length];
}

function EmptyChart({ message = 'Insufficient verified data for this chart.', height = 160 }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-line px-4 text-center"
      style={{ height }}
    >
      <p className="text-[12px] text-ink-muted max-w-[220px]">{message}</p>
    </div>
  );
}

/**
 * Horizontal ranked bars. The right shape for categories: labels stay
 * horizontal and readable however long the name is, which a vertical bar chart
 * cannot manage without rotating text.
 *
 * @param {Array<[string, number]>} data  [label, value] pairs, pre-sorted
 */
export function BarList({ data = [], total, onSelect, valueSuffix = '', emptyMessage }) {
  const rows = data.filter(([, v]) => typeof v === 'number');
  if (!rows.length) return <EmptyChart message={emptyMessage} />;

  const max = Math.max(...rows.map(([, v]) => v), 1);
  const denominator = typeof total === 'number' && total > 0 ? total : null;

  return (
    <ul className="space-y-3">
      {rows.map(([label, value], i) => {
        const pct = denominator ? (value / denominator) * 100 : null;
        const Row = onSelect ? 'button' : 'div';
        return (
          <li key={label}>
            <Row
              onClick={onSelect ? () => onSelect(label) : undefined}
              className={`w-full text-left ${onSelect ? 'focus-ring group cursor-pointer' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className={`text-ink-body truncate ${onSelect ? 'group-hover:text-civic-700' : ''}`}>
                  {label}
                </span>
                <span className="shrink-0 font-semibold text-ink tnum">
                  {value.toLocaleString()}{valueSuffix}
                  {pct !== null && (
                    <span className="ml-1 font-normal text-ink-faint">({pct.toFixed(0)}%)</span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-surface-inset overflow-hidden">
                <div
                  className="h-full rounded-full origin-left animate-grow-x transition-[filter] group-hover:brightness-110"
                  style={{ width: `${(value / max) * 100}%`, background: seriesColor(i) }}
                />
              </div>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Donut for a part-to-whole split. Capped at ~6 slices by the caller: beyond
 * that the arcs are too thin to compare and a BarList is the better shape.
 */
export function Donut({ data = [], size = 168, thickness = 26, centerLabel, emptyMessage }) {
  const [hover, setHover] = useState(null);
  const titleId = useId();

  const rows = data.filter(([, v]) => v > 0);
  const total = rows.reduce((sum, [, v]) => sum + v, 0);
  if (!total) return <EmptyChart message={emptyMessage} height={size} />;

  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const summary = rows.map(([l, v]) => `${l}: ${v}`).join(', ');

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-labelledby={titleId} className="-rotate-90">
          <title id={titleId}>{summary}</title>
          {rows.map(([label, value], i) => {
            const share = value / total;
            const dash = share * circumference;
            const el = (
              <circle
                key={label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seriesColor(i)}
                strokeWidth={hover === label ? thickness + 4 : thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className="transition-[stroke-width] duration-200"
                onMouseEnter={() => setHover(label)}
                onMouseLeave={() => setHover(null)}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-display text-[22px] font-bold text-ink leading-none tnum">
            {hover ? rows.find(([l]) => l === hover)[1] : total}
          </span>
          <span className="text-[11px] text-ink-muted mt-0.5 max-w-[80px] text-center leading-tight">
            {hover || centerLabel || 'total'}
          </span>
        </div>
      </div>

      <ul className="space-y-1.5 min-w-0 flex-1">
        {rows.map(([label, value], i) => (
          <li
            key={label}
            onMouseEnter={() => setHover(label)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 text-[12px] transition-opacity ${
              hover && hover !== label ? 'opacity-50' : ''
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: seriesColor(i) }} />
            <span className="text-ink-body truncate flex-1">{label}</span>
            <span className="text-ink font-semibold tnum shrink-0">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Sparkline / trend. Area plus line: the fill carries the shape at a glance,
 * the stroke keeps individual points readable.
 *
 * @param {Array<{date: string, count: number}>} points
 */
export function TrendLine({ points = [], height = 120, emptyMessage }) {
  const [hover, setHover] = useState(null);
  const gradId = useId();
  const titleId = useId();

  if (points.length < 2) return <EmptyChart message={emptyMessage} height={height} />;

  const max = Math.max(...points.map((p) => p.count), 1);
  const W = 100; // viewBox units — the SVG scales to its container
  const stepX = W / (points.length - 1);

  const coords = points.map((p, i) => [i * stepX, height - (p.count / max) * (height - 12) - 6]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${height} L0,${height} Z`;

  const peak = points.reduce((a, b) => (b.count > a.count ? b : a), points[0]);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-labelledby={titleId}
        onMouseLeave={() => setHover(null)}
      >
        <title id={titleId}>
          {`${points.length} days, peak ${peak.count} on ${peak.date}`}
        </title>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d4a78" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#1d4a78" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="#1d4a78" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />

        {/* Invisible hit areas — one per point, full height, so the pointer
            does not have to find a 2px dot. */}
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={i * stepX - stepX / 2}
            y={0}
            width={stepX}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover({ ...p, x: coords[i][0], y: coords[i][1] })}
          />
        ))}
        {hover && (
          <circle cx={hover.x} cy={hover.y} r="2.5" fill="#1d4a78" stroke="#fff" strokeWidth="1.5"
            vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      <div className="flex items-center justify-between text-[11px] text-ink-faint mt-1">
        <span>{points[0].date}</span>
        <span className="text-ink-body font-medium tnum">
          {hover ? `${hover.date}: ${hover.count}` : `peak ${peak.count}`}
        </span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}
