// A single KPI tile: label, big value, trend line, and a tinted icon.
import React from 'react';
import { IconClipboard, IconHourglass, IconCheckCircle, IconAlertTriangle, IconTrendingUp } from './icons';

// tone -> icon + color classes. Kept here so the page only passes a tone key.
const TONES = {
  emerald: { icon: IconClipboard, ring: 'bg-emerald-50 text-emerald-600' },
  blue: { icon: IconHourglass, ring: 'bg-blue-50 text-blue-600' },
  purple: { icon: IconCheckCircle, ring: 'bg-violet-50 text-violet-600' },
  amber: { icon: IconAlertTriangle, ring: 'bg-amber-50 text-amber-600' },
};

export default function StatCard({ label, value, trend, tone }) {
  const { icon: Icon, ring } = TONES[tone] || TONES.emerald;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${ring}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-3 font-display text-[28px] font-bold text-slate-900 leading-none">
        {value.toLocaleString()}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[12px] font-medium text-emerald-600">
        <IconTrendingUp size={14} />
        {trend}
      </div>
    </div>
  );
}
