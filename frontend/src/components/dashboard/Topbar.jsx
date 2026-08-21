// Light sticky top bar for the citizen area.
import React from 'react';
import { IconMenu } from './icons';
import NotificationBell from './NotificationBell';
import LocationChip from './LocationChip';

export default function Topbar({
  user, onMenu, showLocation = true, notificationsHref = '/notifications', onLocated,
}) {
  const name = user?.name?.split(' ')[0] || 'there';
  const initial = (user?.name?.[0] || 'U').toUpperCase();

  return (
    <header className="sticky top-0 z-20 h-[76px] bg-surface border-b border-line flex items-center gap-3 px-4 sm:px-7">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenu}
        className="lg:hidden text-ink-muted hover:text-ink p-1"
        aria-label="Open menu"
      >
        <IconMenu size={22} />
      </button>

      {/* Real current area, replacing a hardcoded label that did nothing. */}
      {showLocation && <LocationChip onLocated={onLocated} />}

      <div className="flex-1" />

      {/* Notifications — real feed, replaces the old hardcoded "3" badge. */}
      <NotificationBell viewAllHref={notificationsHref} />

      {/* User */}
      <div className="flex items-center gap-2.5 pl-2">
        <div className="w-10 h-10 rounded-full bg-leaf-600 flex items-center justify-center text-white font-bold text-[15px]">
          {initial}
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="text-[13.5px] font-semibold text-ink">{user?.name || name}</div>
          <div className="text-[11.5px] text-ink-muted capitalize">{user?.role?.replace('_', ' ') || 'citizen'}</div>
        </div>
      </div>
    </header>
  );
}
