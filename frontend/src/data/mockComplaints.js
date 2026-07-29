// TEMPORARY mock list of the signed-in citizen's complaints.
// TODO(raja-api): replace with GET /api/complaints?citizenId=<me>&sort=-createdAt
// Shape mirrors the `complaints` table joined with category/location.

export const myComplaints = [
  { id: 'CC-2024-001245', issue: 'Pothole on Main Street', category: 'Pothole', location: 'MG Road, City', status: 'In Progress', severity: 'High', date: '2024-05-25' },
  { id: 'CC-2024-001244', issue: 'Garbage Overflow near market', category: 'Garbage', location: 'Sector 12, City', status: 'Assigned', severity: 'Medium', date: '2024-05-25' },
  { id: 'CC-2024-001243', issue: 'Water Leakage on footpath', category: 'Water Leakage', location: 'Sector 5, City', status: 'New', severity: 'High', date: '2024-05-24' },
  { id: 'CC-2024-001242', issue: 'Broken Streetlight', category: 'Streetlight', location: 'Park Road, City', status: 'In Progress', severity: 'Low', date: '2024-05-23' },
  { id: 'CC-2024-001240', issue: 'Illegal dumping in park', category: 'Garbage', location: 'Green Park, City', status: 'Resolved', severity: 'Medium', date: '2024-05-20' },
  { id: 'CC-2024-001238', issue: 'Deep pothole near school', category: 'Pothole', location: 'School Lane, City', status: 'Resolved', severity: 'High', date: '2024-05-18' },
  { id: 'CC-2024-001235', issue: 'Overflowing drain', category: 'Water Leakage', location: 'Sector 9, City', status: 'Rejected', severity: 'Low', date: '2024-05-15' },
  { id: 'CC-2024-001231', issue: 'Flickering street lamp', category: 'Streetlight', location: 'Market Road, City', status: 'Resolved', severity: 'Low', date: '2024-05-12' },
];

// Status filter options (map to backend StatusEnum). "All" shows everything.
export const STATUS_FILTERS = ['All', 'New', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];

// Category filter options (map to backend categories).
export const CATEGORY_FILTERS = ['All', 'Pothole', 'Garbage', 'Water Leakage', 'Streetlight', 'Other'];
