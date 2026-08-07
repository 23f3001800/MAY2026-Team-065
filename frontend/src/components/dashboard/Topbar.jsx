// Light sticky top bar for the citizen area.
import React from 'react';
import { IconMenu, IconMapPin, IconChevronDown } from './icons';
import NotificationBell from './NotificationBell';

export default function Topbar({ user, onMenu, showLocation = true, notificationsHref = '/notifications' }) {
  const name = user?.name?.split(' ')[0] || 'there';
  const initial = (user?.name?.[0] || 'U').toUpperCase();

  return (
    <header className="sticky top-0 z-20 h-[68px] bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenu}
        className="lg:hidden text-slate-600 hover:text-slate-900 p-1"
        aria-label="Open menu"
      >
        <IconMenu size={22} />
      </button>

      {/* Location selector */}
      {showLocation && (
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition-colors">
          <IconMapPin size={16} className="text-primary" />
          MG Road, City
          <IconChevronDown size={14} className="text-slate-400" />
        </button>
      )}

      <div className="flex-1" />

      {/* Notifications — real feed, replaces the old hardcoded "3" badge. */}
      <NotificationBell viewAllHref={notificationsHref} />

      {/* User */}
      <div className="flex items-center gap-2.5 pl-2">
        <div className="w-9 h-9 rounded-full logo-gradient flex items-center justify-center text-white font-bold text-sm">
          {initial}
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="text-[13px] font-semibold text-slate-800">Hi, {name}</div>
          <div className="text-[11px] text-slate-400 capitalize">{user?.role?.replace('_', ' ') || 'citizen'}</div>
        </div>
      </div>
    </header>
  );
}
