// Sidebar navigation items for the municipal officer area.
import {
  IconGrid, IconClipboard, IconUsers, IconChart, IconBell,
  IconUserCircle, IconSettings,
} from '../dashboard/icons';

export const OFFICER_NAV = [
  { to: '/officer/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/officer/complaints', label: 'Assigned Complaints', icon: IconClipboard },
  { to: '/officer/workers', label: 'Field Workers', icon: IconUsers },
  { to: '/officer/analytics', label: 'Analytics', icon: IconChart },
  { to: '/officer/notifications', label: 'Notifications', icon: IconBell, badge: 5 },
  { to: '/officer/profile', label: 'Profile', icon: IconUserCircle },
  { to: '/officer/settings', label: 'Settings', icon: IconSettings },
];
