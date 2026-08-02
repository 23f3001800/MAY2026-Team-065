// AI Assistant — the backend has no classification, duplicate-detection or
// chat endpoint (see ComplaintDrawer's "AI Assistance" panel for the same
// gap on the officer side). Rather than fake a chatbot with canned replies,
// this page says plainly what's missing and routes the citizen to the two
// things that already work for the same goals: searching what's nearby
// before filing a duplicate, and filing a new report.
import React from 'react';
import { Link } from 'react-router-dom';
import { IconSparkles, IconSearch, IconReport } from '../components/dashboard/icons';

export default function AIAssistant() {
  return (
    <div className="max-w-[700px] mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">AI Assistant</h1>
        <p className="text-[14px] text-slate-500">Automatic help with categorising and filing complaints.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
          <IconSparkles size={26} />
        </div>
        <h2 className="font-display font-bold text-slate-800 text-lg">Not available yet</h2>
        <p className="text-[14px] text-slate-500 mt-2 max-w-md leading-relaxed">
          The backend has no AI classification, duplicate-detection, or chat endpoint. Rather than
          show invented confidence scores or a chatbot that can't actually reach your data, this
          page stays honest about the gap until that lands.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 w-full">
          <Link
            to="/nearby"
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-primary hover:bg-slate-50 transition-colors"
          >
            <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <IconSearch size={16} />
            </span>
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Check nearby issues</div>
              <div className="text-[12px] text-slate-500">See what's already reported before filing again</div>
            </div>
          </Link>
          <Link
            to="/report"
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-primary hover:bg-slate-50 transition-colors"
          >
            <span className="w-9 h-9 rounded-lg bg-emerald-50 text-primary flex items-center justify-center shrink-0">
              <IconReport size={16} />
            </span>
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Report an issue</div>
              <div className="text-[12px] text-slate-500">Pick a category yourself and file it directly</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
