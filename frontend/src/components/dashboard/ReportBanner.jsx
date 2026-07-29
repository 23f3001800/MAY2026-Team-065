// Full-width call-to-action prompting the citizen to report a new issue.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconMapPin, IconArrowRight } from './icons';

export default function ReportBanner() {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-blue-50 p-5 sm:p-6 flex items-center gap-4 flex-wrap">
      <div className="w-12 h-12 rounded-xl bg-white/70 flex items-center justify-center text-primary shrink-0">
        <IconMapPin size={24} />
      </div>
      <div className="flex-1 min-w-[200px]">
        <h4 className="font-display font-bold text-slate-900">See an issue in your area?</h4>
        <p className="text-[13px] text-slate-600">Report it now and help your city get better!</p>
      </div>
      <button
        onClick={() => navigate('/report')}
        className="inline-flex items-center gap-2 bg-primary hover:bg-emerald-600 text-white font-semibold text-[14px] px-5 py-2.5 rounded-xl shadow-btn transition-colors"
      >
        Report Issue <IconArrowRight size={16} />
      </button>
    </div>
  );
}
