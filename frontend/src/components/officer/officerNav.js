// Sidebar navigation items for the municipal officer area.
import {
  IconGrid, IconClipboard, IconAlertTriangle, IconCheckCircle, IconUsers,
  IconUserCircle,
} from '../dashboard/icons';

export const OFFICER_NAV = [
  { to: '/officer/dashboard', label: 'Dashboard', icon: IconGrid },
  { to: '/officer/complaints', label: 'Assigned Complaints', icon: IconClipboard },
  // Work that has run past the target the city set. The SLA sweep always
  // detected these and raised notifications, but nothing could ask for the
  // list, so they were only found by scrolling the queue.
  { to: '/officer/escalations', label: 'Overdue', icon: IconAlertTriangle },
  // Sign-off on submitted work. The one lifecycle step only an officer can
  // clear, and it needs before/after photographs at a size you can judge — a
  // row in the complaint queue could never give it that.
  { to: '/officer/verification', label: 'Verification', icon: IconCheckCircle },
  { to: '/officer/workers', label: 'Field Workers', icon: IconUsers },
  { to: '/officer/profile', label: 'Profile', icon: IconUserCircle },
];
