// Filter options for the list screens. These are UI vocabulary, not mock data —
// they stay here now that the pages themselves read from the API.
import { CATEGORIES } from '../api/mappers';

// Mirrors the backend StatusEnum, in lifecycle order. "All" shows everything.
export const STATUS_FILTERS = ['All', 'New', 'Assigned', 'Resolved', 'Rejected'];

// Derived from the seeded categories so the two cannot drift apart.
export const CATEGORY_FILTERS = ['All', ...CATEGORIES.map((c) => c.label)];

// Radius options for the nearby search, in kilometres.
export const RADIUS_OPTIONS = [1, 2, 5];

export const NOTIFICATION_FILTERS = ['All', 'Unread'];
