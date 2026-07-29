// Generic "coming soon" screen for citizen sections that aren't built yet,
// so every sidebar link resolves to a real route.
import React from 'react';
import { IconClipboard } from '../components/dashboard/icons';

export default function Placeholder({ title }) {
  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="font-display text-2xl font-bold text-slate-900 mb-6">{title}</h1>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-primary flex items-center justify-center mb-4">
          <IconClipboard size={26} />
        </div>
        <h2 className="font-display font-bold text-slate-800 text-lg">{title} is coming soon</h2>
        <p className="text-[14px] text-slate-500 mt-1 max-w-sm">
          This section is under construction. The dashboard is ready — the rest of the citizen
          experience will land here next.
        </p>
      </div>
    </div>
  );
}
