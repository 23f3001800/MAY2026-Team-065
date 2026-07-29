// TEMPORARY feed of complaints already reported near the citizen, shown so
// they can confirm an issue before filing a duplicate.
// TODO(raja-api): replace with the geo-query endpoint, e.g.
//   GET /api/complaints/nearby?lat=&lng=&radiusKm=
// `reportCount` is how many citizens have reported the same issue.

export const nearbyIssues = [
  {
    id: 'CC-2024-001245',
    issue: 'Pothole on Main Street',
    category: 'Pothole',
    location: 'MG Road, City',
    status: 'In Progress',
    severity: 'High',
    distanceKm: 0.3,
    reportCount: 7,
    date: '2024-05-25',
  },
  {
    id: 'CC-2024-001220',
    issue: 'Drain overflowing near junction',
    category: 'Water Leakage',
    location: 'MG Road junction, City',
    status: 'Assigned',
    severity: 'Medium',
    distanceKm: 0.6,
    reportCount: 4,
    date: '2024-05-23',
  },
  {
    id: 'CC-2024-001244',
    issue: 'Garbage Overflow near market',
    category: 'Garbage',
    location: 'Sector 12, City',
    status: 'Assigned',
    severity: 'Medium',
    distanceKm: 1.2,
    reportCount: 12,
    date: '2024-05-25',
  },
  {
    id: 'CC-2024-001242',
    issue: 'Broken Streetlight',
    category: 'Streetlight',
    location: 'Park Road, City',
    status: 'In Progress',
    severity: 'Low',
    distanceKm: 1.8,
    reportCount: 2,
    date: '2024-05-23',
  },
  {
    id: 'CC-2024-001219',
    issue: 'Footpath slabs broken outside clinic',
    category: 'Other',
    location: 'Hospital Road, City',
    status: 'New',
    severity: 'Medium',
    distanceKm: 2.4,
    reportCount: 1,
    date: '2024-05-22',
  },
  {
    id: 'CC-2024-001240',
    issue: 'Illegal dumping in park',
    category: 'Garbage',
    location: 'Green Park, City',
    status: 'Resolved',
    severity: 'Medium',
    distanceKm: 3.1,
    reportCount: 5,
    date: '2024-05-20',
  },
  {
    id: 'CC-2024-001212',
    issue: 'Street lamp out on service lane',
    category: 'Streetlight',
    location: 'Service Lane, City',
    status: 'Resolved',
    severity: 'Low',
    distanceKm: 4.5,
    reportCount: 3,
    date: '2024-05-14',
  },
];

// Radius options for the distance filter, in kilometres.
export const RADIUS_OPTIONS = [1, 2, 5];
