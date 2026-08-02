// Translation layer between the backend's wire format and the shapes the UI
// components already speak. Keeping it here means pages never deal with
// SCREAMING_CASE enums or category ids.
//
// Two mismatches are worth knowing about, because they are not translation
// problems -- they are missing backend capability:
//
// 1. StatusEnum is PENDING | ASSIGNED | RESOLVED | REJECTED. The UI lifecycle
//    also has "In Progress" and "Closed", which have nowhere to go. They are
//    display-only; see UI_ONLY_STATUSES below and never send them.
// 2. There is no GET /categories, so CATEGORIES below is a hardcoded mirror of
//    backend/seed.py. If raja edits the seed, this list has to change with it.

// ── Status ────────────────────────────────────────────────────────
const STATUS_FROM_API = {
  PENDING: 'New',
  ASSIGNED: 'Assigned',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

const STATUS_TO_API = {
  New: 'PENDING',
  Assigned: 'ASSIGNED',
  Resolved: 'RESOLVED',
  Rejected: 'REJECTED',
};

// Statuses the UI can render but the backend cannot store. Anything here must
// not reach a PATCH body -- toApiStatus returns null so callers fail loudly
// rather than silently writing the wrong state.
export const UI_ONLY_STATUSES = ['In Progress', 'Closed'];

export function fromApiStatus(status) {
  if (!status) return 'New';
  return STATUS_FROM_API[String(status).toUpperCase()] || String(status);
}

export function toApiStatus(status) {
  return STATUS_TO_API[status] || null;
}

// Statuses an officer or worker can actually transition a complaint into.
export const ASSIGNABLE_STATUSES = Object.keys(STATUS_TO_API);

// ── Severity ──────────────────────────────────────────────────────
export function fromApiSeverity(severity) {
  if (!severity) return 'Low';
  const s = String(severity).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function toApiSeverity(severity) {
  return severity ? String(severity).toUpperCase() : null;
}

// ── Categories ────────────────────────────────────────────────────
// Mirrors the seed data in backend/seed.py. `label` is the short name the UI
// shows; `name` is what the backend calls it.
export const CATEGORIES = [
  { categoryId: 'CAT-ROA-01', label: 'Pothole', name: 'Pothole / Road Damage', department: 'Roads & Transport' },
  { categoryId: 'CAT-SAN-01', label: 'Garbage', name: 'Garbage Collection / Debris', department: 'Sanitation' },
  { categoryId: 'CAT-WAT-01', label: 'Water Leakage', name: 'Water Leak / Pipe Burst', department: 'Water & Plumbing' },
  { categoryId: 'CAT-ELE-01', label: 'Streetlight', name: 'Streetlight Outage', department: 'Electrical' },
  { categoryId: 'CAT-PUB-01', label: 'Other', name: 'Park / Public Property Damage', department: 'Public Works' },
];

export function categoryLabel(category) {
  if (!category) return 'Uncategorised';
  const match = CATEGORIES.find((c) => c.categoryId === category.categoryId);
  return match ? match.label : category.name || 'Uncategorised';
}

// ── Complaints ────────────────────────────────────────────────────
// The backend has no title field, so the list views derive one from the first
// sentence of the description. Truncated rather than wrapped, since the table
// gives it a single line.
function deriveTitle(description) {
  if (!description) return 'Untitled complaint';
  const firstSentence = description.split(/(?<=[.!?])\s/)[0] || description;
  const trimmed = firstSentence.trim();
  return trimmed.length > 70 ? `${trimmed.slice(0, 67)}…` : trimmed;
}

/**
 * Normalises a ComplaintResponse into the shape the existing pages render.
 * Fields the backend does not return yet (worker, AI confidence, duplicates,
 * resolution evidence) are left undefined rather than faked -- the components
 * already handle their absence.
 */
export function fromApiComplaint(c) {
  if (!c) return null;
  return {
    id: c.complaintId,
    issue: deriveTitle(c.description),
    description: c.description || '',
    category: categoryLabel(c.category),
    categoryId: c.category?.categoryId || null,
    department: c.category?.department || null,
    location: c.location?.address || 'Location not recorded',
    coords: c.location
      ? { latitude: c.location.latitude, longitude: c.location.longitude }
      : null,
    status: fromApiStatus(c.status),
    severity: fromApiSeverity(c.severity),
    date: c.createdAt,
    reportedAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// ── Field workers ─────────────────────────────────────────────────
const AVAILABILITY_FROM_API = {
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Off Duty',
};

export function fromApiWorker(w) {
  if (!w) return null;
  return {
    id: w.userId,
    name: w.name,
    phone: w.phone,
    // skillSet is a free-text string like "Plumbing, Sanitation".
    skill: w.skillSet || 'General',
    availability: AVAILABILITY_FROM_API[w.availabilityStatus] || w.availabilityStatus || 'Unknown',
    // The worker list carries no task count; the officer queue treats a missing
    // value as "unknown" rather than showing a misleading zero.
    openTasks: null,
  };
}

// ── Notifications ─────────────────────────────────────────────────
// The backend sends one type today (STATUS_UPDATE) with the status baked into
// the message text, so the icon is inferred from the message.
function notificationKind(message = '') {
  const m = message.toLowerCase();
  if (m.includes('resolved')) return 'resolved';
  if (m.includes('rejected')) return 'rejected';
  if (m.includes('assigned')) return 'assigned';
  return 'status';
}

export function fromApiNotification(n) {
  if (!n) return null;
  return {
    id: n.notificationId,
    type: notificationKind(n.message),
    complaintId: n.complaintId,
    title: 'Complaint update',
    message: n.message,
    sentAt: n.sentAt,
    isRead: Boolean(n.isRead),
  };
}

// ── Feedback ──────────────────────────────────────────────────────
export function fromApiFeedback(f) {
  if (!f) return null;
  return {
    id: f.feedbackId,
    rating: f.rating,
    comments: f.comments || '',
    submittedAt: f.submittedAt,
  };
}
