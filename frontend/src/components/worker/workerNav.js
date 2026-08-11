// Sidebar navigation items for the field worker area.
import {
  IconGrid, IconClipboard, IconClock,
  IconUserCircle, } from '../dashboard/icons';

export const WORKER_NAV = [
  { to: '/worker/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/worker/tasks', label: 'My Tasks', icon: IconClipboard },
  { to: '/worker/history', label: 'History', icon: IconClock },
  { to: '/worker/profile', label: 'Profile', icon: IconUserCircle },
];
