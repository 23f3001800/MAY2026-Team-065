// Sidebar navigation items for the admin area.
import {
  IconGrid, IconUsers, IconClipboard, IconTag,
  IconReport, IconUserCircle,
} from '../dashboard/icons';

export const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/admin/users', label: 'User Management', icon: IconUsers },
  { to: '/admin/complaints', label: 'Complaints', icon: IconClipboard },
  { to: '/admin/categories', label: 'Categories', icon: IconTag },
  { to: '/admin/reports', label: 'Reports', icon: IconReport },
  { to: '/admin/profile', label: 'Profile', icon: IconUserCircle },
];
