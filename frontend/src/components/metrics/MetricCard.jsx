// A single operations metric.
//
// A number alone in a box tells you the value but not whether it is good,
// moving, or a large share of anything — so every card carries a visual that
// answers one of those:
//
//   series  a sparkline, when the metric has a shape over time
//   share   a proportion ring, when the number is part of a whole
//   split   a segmented bar, when the number decomposes into named parts
//
// Provenance stays, because the trust model depends on it. The calculation
// expander is gone: it pushed arithmetic into the primary reading path for
// something most people never open.
import React, { useId } from 'react';
import Provenance from './Provenance';
import useCountUp from '../../hooks/useCountUp';

const TONES = {
  neutral: { accent: '#0f8f56', bar: 'bg-leaf-600', text: 'text-leaf-700' },
  positive: { accent: '#199a62', bar: 'bg-leaf-500', text: 'text-leaf-600' },
  caution: { accent: '#b45309', bar: 'bg-caution-600', text: 'text-caution-700' },
  critical: { accent: '#b42318', bar: 'bg-danger-600', text: 'text-danger-700' },
};

// Compact sparkline. No axes: at this size they would cost more room than the
// data. The shape is the message — flat, climbing, or spiking.
function Sparkline({ points, color }) {
  const id = useId();
  if (!points || points.length < 2) return null;

  const values = points.map((p) => (typeof p === 'number' ? p : p.count));
  const max = Math.max(...values, 1);
  const W = 100;
  const H = 28;
  const step = W / (values.length - 1);

  const coords = values.map((v, i) => [i * step, H - (v / max) * (H - 3) - 1.5]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-7" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Proportion ring. Reads faster than a percentage for "how much of the whole",
// because the eye judges an arc without parsing digits.
function Ring({ share, color, size = 46 }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, share)) * c;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        className="text-surface-inset" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round" strokeDasharray={`${filled} ${c - filled}`}
        className="transition-[stroke-dasharray] duration-700 ease-out"
      />
    </svg>
  );
}

// Segmented bar for a metric that decomposes — e.g. open split by age band.
function Split({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return null;
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-inset">
        {segments.map((seg) => (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.value}`}
            style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }}
            className="transition-all duration-500"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {segments.filter((s) => s.value > 0).map((seg) => (
          <span key={seg.label} className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color }} />
            {seg.label}
            <span className="tnum text-ink-body font-medium">{seg.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MetricCard({
  label, value, unit = '', context,
  provenance = 'derived', tone = 'neutral', footnote, onClick,
  series, share, split,
}) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const shown = useCountUp(numeric ? value : 0);
  const t = TONES[tone] || TONES.neutral;

  const interactive = typeof onClick === 'function' && numeric;
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`relative w-full text-left bg-surface rounded-xl border border-line shadow-sm overflow-hidden p-4 flex flex-col
        ${interactive ? 'focus-ring lift hover:shadow-md hover:border-leaf-300 cursor-pointer transition-all' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        <Provenance level={numeric ? provenance : 'insufficient'} />
      </div>

      {numeric ? (
        <>
          <div className="flex items-end justify-between gap-3 mt-2.5">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-[30px] font-bold text-ink leading-none tnum">
                  {shown.toLocaleString()}
                </span>
                {unit && <span className={`text-[16px] font-semibold ${t.text}`}>{unit}</span>}
              </div>
              {context && <div className="mt-1 text-[12px] text-ink-muted tnum">{context}</div>}
            </div>
            {typeof share === 'number' && <Ring share={share} color={t.accent} />}
          </div>

          {series && (
            <div className="mt-3 -mx-1">
              <Sparkline points={series} color={t.accent} />
            </div>
          )}

          {split && <div className="mt-3"><Split segments={split} /></div>}
        </>
      ) : (
        <div className="mt-2.5 flex-1">
          <div className="font-display text-[20px] font-semibold text-ink-faint leading-none">—</div>
          <p className="text-[12px] text-ink-muted mt-1.5 leading-snug">
            Insufficient verified data for this metric.
          </p>
        </div>
      )}

      {footnote && <div className="mt-2 text-[11px] text-ink-faint leading-snug">{footnote}</div>}
    </Tag>
  );
}
