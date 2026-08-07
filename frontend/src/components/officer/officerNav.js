// Sidebar navigation items for the municipal officer area.
import {
  IconGrid, IconClipboard, IconUsers, IconChart,
  IconUserCircle, } from '../dashboard/icons';

export const OFFICER_NAV = [
  { to: '/officer/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/officer/complaints', label: 'Assigned Complaints', icon: IconClipboard },
  { to: '/officer/workers', label: 'Field Workers', icon: IconUsers },
  { to: '/officer/analytics', label: 'Analytics', icon: IconChart },
  { to: '/officer/profile', label: 'Profile', icon: IconUserCircle },
];
