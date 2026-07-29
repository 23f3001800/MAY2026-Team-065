// TEMPORARY notification feed for the signed-in citizen.
// TODO(raja-api): replace with GET /api/notifications?userId=<me>&sort=-sentAt
// and PATCH /api/notifications/:id { isRead }. Shape mirrors the
// `notifications` table (notificationId, message, type, sentAt, isRead).

// `type` drives the icon and accent. Keep in sync with TYPE_META below.
export const notifications = [
  {
    id: 'NT-1009',
    type: 'status',
    complaintId: 'CC-2024-001245',
    title: 'Work started on your complaint',
    message: 'Ravi Kumar has begun work on “Pothole on Main Street”. Status changed to In Progress.',
    sentAt: '2024-05-27T14:05:00',
    isRead: false,
  },
  {
    id: 'NT-1008',
    type: 'assigned',
    complaintId: 'CC-2024-001244',
    title: 'Complaint assigned',
    message: '“Garbage Overflow near market” has been routed to Sanitation and assigned to Sunil Das.',
    sentAt: '2024-05-26T11:20:00',
    isRead: false,
  },
  {
    id: 'NT-1007',
    type: 'resolved',
    complaintId: 'CC-2024-001238',
    title: 'Complaint resolved — rate it',
    message: 'The pothole near the school gate has been repaired. Tap to view the evidence and leave a rating.',
    sentAt: '2024-05-21T16:40:00',
    isRead: false,
  },
  {
    id: 'NT-1006',
    type: 'status',
    complaintId: 'CC-2024-001243',
    title: 'Complaint received',
    message: 'We have logged “Water Leakage on footpath”. You will be notified when it is assigned.',
    sentAt: '2024-05-24T09:15:00',
    isRead: true,
  },
  {
    id: 'NT-1005',
    type: 'resolved',
    complaintId: 'CC-2024-001240',
    title: 'Complaint resolved',
    message: 'Illegal dumping in Green Park has been cleared. Thank you for your feedback.',
    sentAt: '2024-05-22T10:05:00',
    isRead: true,
  },
  {
    id: 'NT-1004',
    type: 'rejected',
    complaintId: 'CC-2024-001235',
    title: 'Complaint closed as duplicate',
    message: 'Your report of an overflowing drain duplicates CC-2024-001220, which is already in progress.',
    sentAt: '2024-05-16T13:30:00',
    isRead: true,
  },
];

export const NOTIFICATION_FILTERS = ['All', 'Unread'];
