// Left navigation rail, shared by all four role shells.
//
// It is a floating light card rather than a dark rail flush to the edge. The
// dark rail read as "console"; this product is a public service, and the
// signed-in shell should look like the front door a citizen already trusted
// enough to sign in through — same green, same drawn city, same mark.
//
// The park at the foot is not decoration for its own sake: it fills the dead
// space between the last nav row and Logout, which otherwise reads as an
// unfinished list.
import React from 'react';
import { NavLink } from 'react-router-dom';
import CivicMark from '../public/CivicMark';
import { ParkPanel } from '../public/HeroScene';
import {
  IconGrid, IconReport, IconList, IconStar, IconUserCircle, IconLogout, IconArrowRight,
} from './icons';

// Nav items shown to a citizen. `badge` renders a small count pill.
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/report', label: 'Report Issue', icon: IconReport },
  { to: '/complaints', label: 'Complaints', icon: IconList },
  { to: '/feedback', label: 'Feedback', icon: IconStar },
  { to: '/profile', label: 'Profile', icon: IconUserCircle },
];

export default function Sidebar({ open, onNavigate, onLogout, items = NAV_ITEMS, showCta = true }) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-30 lg:hidden transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onNavigate}
      />

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[276px] shrink-0 p-3 transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
          {/* Brand */}
          <div className="flex items-center gap-3 px-4 h-[76px] border-b border-line shrink-0">
            <CivicMark size={38} />
            <div className="leading-tight min-w-0">
              <div className="font-display font-bold text-[15px] text-ink truncate">
                SmartCivicConnect
              </div>
              <div className="text-[10.5px] text-ink-muted mt-0.5">Report. Resolve. Rebuild.</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="shrink-0 px-3 py-4 flex flex-col gap-1">
            {items.map(({ to, label, icon: Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold
                   focus-ring transition-all duration-200 ${
                    isActive
                      ? 'bg-leaf-600 text-white shadow-[0_8px_18px_-10px_rgba(15,143,86,0.85)]'
                      : 'text-ink-body hover:bg-leaf-50 hover:text-leaf-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active marker on the rail edge. Gives the eye a fixed
                        anchor for "where am I" that survives scrolling the list. */}
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[19px] top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-leaf-600 transition-all duration-200 ${
                        isActive ? 'h-7 opacity-100' : 'h-0 opacity-0'
                      }`}
                    />
                    <Icon
                      size={18}
                      className={isActive ? '' : 'text-leaf-600 transition-transform duration-200 group-hover:scale-110'}
                    />
                    <span className="flex-1">{label}</span>
                    {badge ? (
                      <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center tnum ${
                        isActive ? 'bg-white/25 text-white' : 'bg-danger-600 text-white'
                      }`}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* The city, filling the gap. Collapses to nothing on a short
              viewport rather than pushing Logout off the bottom. */}
          <div className="flex-1 min-h-0 px-3 pb-3">
            <div className="h-full min-h-0 rounded-xl overflow-hidden">
              <ParkPanel className="w-full h-full" />
            </div>
          </div>

          {/* CTA card (citizen only) */}
          {showCta && (
            <div className="px-3 pb-3 shrink-0">
              <div className="rounded-xl p-4 bg-leaf-50 border border-leaf-100">
                <div className="text-ink text-[13px] font-semibold leading-snug mb-3">
                  Let's make our city better together!
                </div>
                <NavLink
                  to="/report"
                  onClick={onNavigate}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-leaf-700 hover:text-leaf-800 transition-colors"
                >
                  Report an issue <IconArrowRight size={14} />
                </NavLink>
              </div>
            </div>
          )}

          {/* Logout */}
          <div className="px-3 pb-3 shrink-0">
            <button
              onClick={onLogout}
              className="focus-ring w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold
                         bg-surface border border-line text-ink-body
                         hover:border-red-200 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <IconLogout size={18} className="text-leaf-600" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
