// TEMPORARY mock data for the municipal officer dashboard.
// TODO(raja-api): wire to backend, scoped to the officer's department:
//   stats       -> GET /api/officer/stats
//   assigned    -> GET /api/complaints?officerId=<me>&sort=-createdAt
//   fieldWorkers-> GET /api/field-workers?department=<dept>

export const stats = [
  { key: 'assigned', label: 'Assigned to Dept', value: 64, trend: 'Across your department', tone: 'emerald' },
  { key: 'in_progress', label: 'In Progress', value: 21, trend: 'Being worked on', tone: 'blue' },
  { key: 'resolved', label: 'Resolved (30d)', value: 138, trend: '+15% vs last month', tone: 'purple' },
  { key: 'pending', label: 'Pending Action', value: 9, trend: 'Awaiting assignment', tone: 'amber' },
];

// Complaints routed to this officer's department. `worker` is the assigned
// field worker, or null when it still needs assigning.
export const assignedComplaints = [
  { id: 'CC-2024-001245', issue: 'Pothole on Main Street', category: 'Pothole', location: 'MG Road, City', severity: 'High', status: 'In Progress', worker: 'Ramesh Kumar' },
  { id: 'CC-2024-001243', issue: 'Water Leakage on footpath', category: 'Water Leakage', location: 'Sector 5, City', severity: 'High', status: 'New', worker: null },
  { id: 'CC-2024-001239', issue: 'Garbage not collected', category: 'Garbage', location: 'Sector 12, City', severity: 'Medium', status: 'Assigned', worker: 'Sunita Devi' },
  { id: 'CC-2024-001236', issue: 'Broken Streetlight', category: 'Streetlight', location: 'Park Road, City', severity: 'Low', status: 'New', worker: null },
  { id: 'CC-2024-001233', issue: 'Blocked storm drain', category: 'Water Leakage', location: 'Sector 9, City', severity: 'Medium', status: 'In Progress', worker: 'Amit Verma' },
];

// Field workers in the officer's department + current availability.
export const fieldWorkers = [
  { name: 'Ramesh Kumar', skill: 'Road Repair', availability: 'Busy' },
  { name: 'Sunita Devi', skill: 'Sanitation', availability: 'Available' },
  { name: 'Amit Verma', skill: 'Plumbing', availability: 'Busy' },
  { name: 'Priya Nair', skill: 'Electrical', availability: 'Available' },
  { name: 'Vikram Singh', skill: 'General', availability: 'Off Duty' },
];
