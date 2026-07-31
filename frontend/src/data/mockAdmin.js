// TEMPORARY mock data for the admin dashboard.
// TODO(raja-api): wire to backend aggregates:
//   stats            -> GET /api/admin/stats
//   complaintsOverTime -> GET /api/admin/complaints-over-time
//   topCategories    -> GET /api/admin/top-categories
//   recentUsers      -> GET /api/users?limit=5&sort=-createdAt

export const stats = [
  { key: 'total', label: 'Total Complaints', value: '1,245', trend: '+12% this month', tone: 'emerald' },
  { key: 'resolved', label: 'Resolved', value: '890', trend: '+15% this month', tone: 'purple' },
  { key: 'in_progress', label: 'In Progress', value: '320', trend: '+8% this month', tone: 'blue' },
  { key: 'avg_time', label: 'Avg. Resolution Time', value: '3.6 days', trend: '-0.4 days vs last month', tone: 'amber' },
];

// Monthly complaint volume (Jan–Jun).
export const complaintsOverTime = [
  { label: 'Jan', value: 180 },
  { label: 'Feb', value: 240 },
  { label: 'Mar', value: 210 },
  { label: 'Apr', value: 320 },
  { label: 'May', value: 290 },
  { label: 'Jun', value: 420 },
];

// Top issue categories by count. Colors kept in sync with the dashboard donut.
export const topCategories = [
  { label: 'Pothole', value: 438, color: '#10b981' },
  { label: 'Garbage', value: 312, color: '#3b82f6' },
  { label: 'Water Leakage', value: 250, color: '#f59e0b' },
  { label: 'Streetlight', value: 125, color: '#8b5cf6' },
  { label: 'Others', value: 120, color: '#94a3b8' },
];

// Recent users for the dashboard snapshot (full list lives in User Management).
export const recentUsers = [
  { name: 'John Doe', email: 'john@example.com', role: 'citizen', status: 'Active' },
  { name: 'Jane Smith', email: 'jane@example.com', role: 'municipal_officer', status: 'Active' },
  { name: 'Ramesh Kumar', email: 'ramesh@example.com', role: 'field_worker', status: 'Active' },
  { name: 'Admin User', email: 'admin@example.com', role: 'admin', status: 'Active' },
];
