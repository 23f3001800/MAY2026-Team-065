// KPI tile for the admin dashboard. Accepts a pre-formatted string value
// (e.g. "1,245" or "3.6 days") and a neutral trend line.
import React from 'react';
import { IconClipboard, IconCheckCircle, IconHourglass, IconClock } from '../dashboard/icons';

const TONES = {
  emerald: { icon: IconClipboard, ring: 'bg-emerald-50 text-emerald-600' },
  purple: { icon: IconCheckCircle, ring: 'bg-violet-50 text-violet-600' },
  blue: { icon: IconHourglass, ring: 'bg-blue-50 text-blue-600' },
  amber: { icon: IconClock, ring: 'bg-amber-50 text-amber-600' },
};

export default function AdminStatCard({ label, value, trend, tone }) {
  const { icon: Icon, ring } = TONES[tone] || TONES.emerald;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${ring}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-3 font-display text-[28px] font-bold text-slate-900 leading-none">{value}</div>
      {trend && <div className="mt-2 text-[12px] font-medium text-slate-400">{trend}</div>}
    </div>
  );
}
