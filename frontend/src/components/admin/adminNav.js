// Sidebar navigation items for the admin area.
import {
  IconGrid, IconUsers, IconClipboard, IconBuilding, IconTag,
  IconChart, IconReport, IconSettings,
} from '../dashboard/icons';

export const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/admin/users', label: 'User Management', icon: IconUsers },
  { to: '/admin/complaints', label: 'Complaints', icon: IconClipboard },
  { to: '/admin/departments', label: 'Departments', icon: IconBuilding },
  { to: '/admin/categories', label: 'Categories', icon: IconTag },
  { to: '/admin/analytics', label: 'Analytics', icon: IconChart },
  { to: '/admin/reports', label: 'Reports', icon: IconReport },
  { to: '/admin/settings', label: 'Settings', icon: IconSettings },
];
