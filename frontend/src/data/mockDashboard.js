// TEMPORARY mock data for the citizen dashboard.
// TODO(raja-api): replace each export with a real fetch once the backend is up:
//   - stats            -> GET /api/complaints/stats  (counts + trend)
//   - recentComplaints -> GET /api/complaints?citizenId=<me>&limit=5&sort=-createdAt
//   - categoryBreakdown-> GET /api/complaints/by-category
// Shapes below mirror the `complaints`/`categories` tables in the ER diagram.

export const stats = [
  { key: 'total', label: 'Total Complaints', value: 1245, trend: '+12% from last month', tone: 'emerald' },
  { key: 'in_progress', label: 'In Progress', value: 320, trend: '+8% from last month', tone: 'blue' },
  { key: 'resolved', label: 'Resolved', value: 890, trend: '+15% from last month', tone: 'purple' },
  { key: 'critical', label: 'Critical Issues', value: 35, trend: '+5% from last month', tone: 'amber' },
];

// status values map to the backend StatusEnum.
export const recentComplaints = [
  { id: 'CC-2024-001245', issue: 'Pothole on Main Street', location: 'MG Road, City', status: 'In Progress', time: '10:30 AM' },
  { id: 'CC-2024-001244', issue: 'Garbage Overflow', location: 'Sector 12, City', status: 'Assigned', time: '9:15 AM' },
  { id: 'CC-2024-001243', issue: 'Water Leakage', location: 'Sector 5, City', status: 'New', time: '8:45 AM' },
  { id: 'CC-2024-001242', issue: 'Broken Streetlight', location: 'Park Road, City', status: 'In Progress', time: 'Yesterday' },
];

// Categorical palette chosen for contrast on white; keep in sync with legend.
export const categoryBreakdown = [
  { label: 'Pothole', percent: 35, color: '#10b981' },
  { label: 'Garbage', percent: 25, color: '#3b82f6' },
  { label: 'Water Leakage', percent: 20, color: '#f59e0b' },
  { label: 'Streetlight', percent: 10, color: '#8b5cf6' },
  { label: 'Others', percent: 10, color: '#94a3b8' },
];
