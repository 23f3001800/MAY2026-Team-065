// Sidebar navigation items for the field worker area.
import {
  IconGrid, IconClipboard, IconChart, IconUserCircle,
} from '../dashboard/icons';

export const WORKER_NAV = [
  { to: '/worker/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/worker/tasks', label: 'My Tasks', icon: IconClipboard },
  { to: '/worker/performance', label: 'Performance', icon: IconChart },
  { to: '/worker/profile', label: 'Profile', icon: IconUserCircle },
];
