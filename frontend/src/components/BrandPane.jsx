// Left "illustration" pane shared by Login and Register — branding, a mock
// live feed, and a quote. Hidden on narrow screens (<820px).
import React from 'react';

export default function BrandPane() {
  return (
    <div className="flex-1 illustration-gradient border-r border-[rgba(255,255,255,0.07)] p-12 flex flex-col justify-between relative overflow-hidden max-[820px]:hidden">
      {/* Branding */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 logo-gradient rounded-xl flex items-center justify-center text-white font-extrabold text-xl font-display shadow-logo">
          C
        </div>
        <div className="font-display font-bold text-xl tracking-[-0.5px] gradient-text-title">
          SmartCivicConnect
        </div>
      </div>

      {/* Civic Feed Mock */}
      <div className="my-10 relative">
        <div className="bg-[rgba(9,13,22,0.6)] border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 relative z-10 shadow-feed">
          <div className="flex justify-between items-center mb-4 border-b border-[rgba(255,255,255,0.05)] pb-[10px]">
            <span className="flex items-center text-[12px] font-semibold">
              <span className="w-2 h-2 bg-primary rounded-full inline-block mr-2 shadow-[0_0_10px_#10b981] animate-pulse-dot" />
              Ward Resolution Live Feed
            </span>
            <span className="text-[10px] text-[#64748b]">Updated just now</span>
          </div>

          <div className="flex gap-3 bg-[rgba(255,255,255,0.03)] p-3 rounded-[10px] text-[13px] mb-2 items-center border-l-[3px] border-primary text-left">
            <div className="flex-1">
              <div className="font-semibold text-[#f8fafc]">Waterline Leakage Resolved</div>
              <div className="text-[11px] text-[#94a3b8]">Sector 4 · Ward #22</div>
            </div>
          </div>

          <div className="flex gap-3 bg-[rgba(255,255,255,0.03)] p-3 rounded-[10px] text-[13px] mb-2 items-center border-l-[3px] border-secondary text-left">
            <div className="flex-1">
              <div className="font-semibold text-[#f8fafc]">Streetlight Outage Logged</div>
              <div className="flex justify-between text-[11px] text-[#94a3b8]">
                <span>Park Lane · Ward #12</span>
                <span className="text-secondary font-semibold">Pending</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[10px] p-3 text-center transition-smooth hover:bg-[rgba(255,255,255,0.04)] hover:-translate-y-0.5">
              <div className="font-display text-xl font-bold text-primary">1,492</div>
              <div className="text-[11px] text-[#94a3b8] mt-1 uppercase tracking-[0.5px]">Resolved</div>
            </div>
            <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-[10px] p-3 text-center transition-smooth hover:bg-[rgba(255,255,255,0.04)] hover:-translate-y-0.5">
              <div className="font-display text-xl font-bold text-secondary">86%</div>
              <div className="text-[11px] text-[#94a3b8] mt-1 uppercase tracking-[0.5px]">SLA Efficiency</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote */}
      <div className="text-sm text-[#94a3b8] leading-relaxed">
        <p>
          "A cleaner, safer, and smarter municipality begins with{' '}
          <span className="text-primary font-semibold">civic mindfulness</span>{' '}
          and prompt civic reporting."
        </p>
      </div>
    </div>
  );
}
