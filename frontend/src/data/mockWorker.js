// TEMPORARY mock data for the field worker dashboard.
// TODO(raja-api): wire to backend, scoped to the signed-in worker:
//   tasks  -> GET /api/complaints?fieldWorkerId=<me>&status!=Resolved
//   rating -> GET /api/field-workers/<me>/rating (avg from feedbacks)
//   PATCH  -> PATCH /api/complaints/<id> { status } to advance a task

export const assignedTasks = [
  { id: 'CC-2024-001245', issue: 'Pothole on Main Street', category: 'Pothole', location: 'MG Road, City', severity: 'High', status: 'In Progress', due: 'Today, 4:00 PM' },
  { id: 'CC-2024-001239', issue: 'Garbage not collected', category: 'Garbage', location: 'Sector 12, City', severity: 'Medium', status: 'Assigned', due: 'Today, 6:00 PM' },
  { id: 'CC-2024-001236', issue: 'Broken Streetlight', category: 'Streetlight', location: 'Park Road, City', severity: 'Low', status: 'Assigned', due: 'Tomorrow, 11:00 AM' },
  { id: 'CC-2024-001230', issue: 'Fallen tree branch', category: 'Other', location: 'Green Park, City', severity: 'Medium', status: 'In Progress', due: 'Today, 2:00 PM' },
  { id: 'CC-2024-001228', issue: 'Clogged drain cleared', category: 'Water Leakage', location: 'Sector 9, City', severity: 'Low', status: 'Resolved', due: 'Completed' },
];

// Availability options mirror the field_workers.availabilityStatus enum.
export const AVAILABILITY_OPTIONS = ['Available', 'Busy', 'Off Duty'];

export const workerRating = 4.6;
