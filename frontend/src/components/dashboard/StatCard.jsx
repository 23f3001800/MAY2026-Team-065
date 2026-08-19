// A single KPI tile: label, big value, trend line, and a tinted icon.
//
// The value counts up on mount. It is short (600ms) and eased out, so it reads
// as the number settling rather than a slot machine — long enough to draw the
// eye to what changed, short enough that nobody waits to read it.
import React from 'react';
import {
  IconClipboard, IconHourglass, IconCheckCircle, IconAlertTriangle, IconTrendingUp,
} from './icons';
import useCountUp from '../../hooks/useCountUp';

// tone -> icon + colour classes. Kept here so the page only passes a tone key.
const TONES = {
  emerald: { icon: IconClipboard, ring: 'bg-emerald-50 text-emerald-600', glow: 'group-hover:ring-emerald-200' },
  blue: { icon: IconHourglass, ring: 'bg-blue-50 text-blue-600', glow: 'group-hover:ring-blue-200' },
  purple: { icon: IconCheckCircle, ring: 'bg-violet-50 text-violet-600', glow: 'group-hover:ring-violet-200' },
  amber: { icon: IconAlertTriangle, ring: 'bg-amber-50 text-amber-600', glow: 'group-hover:ring-amber-200' },
};

export default function StatCard({ label, value, trend, tone, onClick }) {
  const { icon: Icon, ring, glow } = TONES[tone] || TONES.emerald;
  const numeric = typeof value === 'number' ? value : Number(value) || 0;
  const shown = useCountUp(numeric);

  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`group relative w-full text-left bg-white rounded-2xl border border-line p-5 shadow-sm ring-1 ring-transparent transition-all duration-200 ${glow} ${
        interactive ? 'lift hover:shadow-md focus-ring cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-ink-muted">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${ring}`}>
          <Icon size={18} />
        </span>
      </div>

      <div className="mt-3 font-display text-[28px] font-bold text-ink leading-none tnum">
        {shown.toLocaleString()}
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1 text-[12px] font-medium text-emerald-600">
          <IconTrendingUp size={14} />
          {trend}
        </div>
      )}
    </Tag>
  );
}
