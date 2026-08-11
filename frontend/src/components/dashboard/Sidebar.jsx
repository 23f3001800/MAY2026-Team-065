// Dark left navigation rail for the citizen area.
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  IconGrid, IconReport, IconList, IconTrack, IconMapPin,
  IconStar, IconUserCircle, IconLogout, IconArrowRight,
} from './icons';

// Nav items shown to a citizen. `badge` renders a small count pill.
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/report', label: 'Report Issue', icon: IconReport },
  { to: '/my-complaints', label: 'My Complaints', icon: IconList },
  { to: '/track', label: 'Track Complaints', icon: IconTrack },
  { to: '/nearby', label: 'Nearby Issues', icon: IconMapPin },
  { to: '/feedback', label: 'Feedback', icon: IconStar },
  { to: '/profile', label: 'Profile', icon: IconUserCircle },
];

export default function Sidebar({ open, onNavigate, onLogout, items = NAV_ITEMS, showCta = true }) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onNavigate}
      />

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[260px] shrink-0 bg-civic-950 border-r border-white/[0.06] flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-[68px] border-b border-white/5 shrink-0">
          <div className="w-9 h-9 rounded-lg logo-gradient flex items-center justify-center text-white font-extrabold font-display shadow-logo">
            C
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-[15px] text-white">Smart CivicConnect</div>
            <div className="text-[10px] text-slate-500">Report. Resolve. Rebuild.</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium
                 focus-ring transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.6)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-0.5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active marker on the rail edge. Gives the eye a fixed
                      anchor for "where am I" that survives scrolling the list. */}
                  <span
                    aria-hidden="true"
                    className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-primary transition-all duration-200 ${
                      isActive ? 'h-6 opacity-100' : 'h-0 opacity-0'
                    }`}
                  />
                  <Icon size={18} className={isActive ? '' : 'transition-transform duration-200 group-hover:scale-110'} />
                  <span className="flex-1">{label}</span>
                  {badge ? (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center tnum">
                      {badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* CTA card (citizen only) */}
        {showCta && (
          <div className="px-3 pb-3 shrink-0">
            <div className="rounded-xl p-4 bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/5">
              <div className="text-white text-[13px] font-semibold leading-snug mb-3">
                Let's make our city better together!
              </div>
              <NavLink
                to="/report"
                onClick={onNavigate}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-white transition-colors"
              >
                Report an issue <IconArrowRight size={14} />
              </NavLink>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="px-3 pb-4 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <IconLogout size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
