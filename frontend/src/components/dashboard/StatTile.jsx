// Generic KPI tile shared across role dashboards. Accepts a string|number
// value, an optional neutral trend line, and a tone (or an explicit icon).
import React from 'react';
import { IconClipboard, IconHourglass, IconCheckCircle, IconAlertTriangle, IconClock, IconUsers } from './icons';

const TONES = {
  emerald: { icon: IconClipboard, ring: 'bg-leaf-50 text-leaf-600' },
  blue: { icon: IconHourglass, ring: 'bg-blue-50 text-blue-600' },
  purple: { icon: IconCheckCircle, ring: 'bg-violet-50 text-violet-600' },
  amber: { icon: IconAlertTriangle, ring: 'bg-amber-50 text-amber-600' },
  slate: { icon: IconClock, ring: 'bg-slate-100 text-slate-500' },
  users: { icon: IconUsers, ring: 'bg-blue-50 text-blue-600' },
};

export default function StatTile({ label, value, trend, tone = 'emerald', icon }) {
  const cfg = TONES[tone] || TONES.emerald;
  const Icon = icon || cfg.icon;
  const display = typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.ring}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-3 font-display text-[28px] font-bold text-slate-900 leading-none">{display}</div>
      {trend && <div className="mt-2 text-[12px] font-medium text-slate-400">{trend}</div>}
    </div>
  );
}
