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

    // Advisory AI triage. All nullable: complaints filed before triage existed,
    // or while it was switched off, carry none of it. `ai` is null rather than
    // an object of nulls so components can branch on one check.
    ai: c.aiAnalyzedAt || c.aiSuggestedCategoryId || c.aiSeverity
      ? {
          suggestedCategoryId: c.aiSuggestedCategoryId || null,
          // The label is resolved here so the drawer does not have to know
          // about the category table.
          suggestedCategory: c.aiSuggestedCategoryId
            ? CATEGORIES.find((x) => x.categoryId === c.aiSuggestedCategoryId)?.label
              || c.aiSuggestedCategoryId
            : null,
          severity: c.aiSeverity ? fromApiSeverity(c.aiSeverity) : null,
          confidence: typeof c.aiConfidence === 'number' ? c.aiConfidence : null,
          summary: c.aiSummary || null,
          // 'rules' (deterministic engine) or 'gemini' (model call).
          source: c.aiSource || null,
          analyzedAt: c.aiAnalyzedAt || null,
        }
      : null,

    // Set by the officer merge flow / duplicate detection.
    duplicateOfComplaintId: c.duplicateOfComplaintId || null,
  };
}

// True when the AI proposed something different from what the record says.
// The officer drawer uses this to decide whether to offer an "accept" action.
export function aiDisagrees(complaint) {
  const ai = complaint?.ai;
  if (!ai) return false;
  const categoryDiffers = Boolean(ai.suggestedCategoryId)
    && ai.suggestedCategoryId !== complaint.categoryId;
  const severityDiffers = Boolean(ai.severity) && ai.severity !== complaint.severity;
  return categoryDiffers || severityDiffers;
}

// ── Status history ────────────────────────────────────────────────
// GET /complaints/{id}/history. This is the audit trail the complaint detail
// timeline was previously faking from createdAt/updatedAt.
export function fromApiHistory(h) {
  if (!h) return null;
  return {
    id: h.historyId,
    status: fromApiStatus(h.status),
    remarks: h.remarks || '',
    at: h.timestamp,
  };
}

// ── Media attachments ─────────────────────────────────────────────
// GET /complaints/{id}/media. `fileUrl` is a server-relative path such as
// "/uploads/CMP-1_ab12cd.jpg", so it has to be joined to the API origin rather
// than used as-is — the frontend is served from a different port in dev.
export function fromApiMedia(m, baseUrl = '') {
  if (!m) return null;
  const url = m.fileUrl || '';
  return {
    id: m.mediaId,
    url: /^https?:\/\//i.test(url) ? url : `${baseUrl}${url}`,
    contentType: m.type || '',
    uploadedBy: m.uploadedBy || null,
    uploadedAt: m.uploadedAt || null,
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

// ── Admin: users ──────────────────────────────────────────────────
// GET /admin/users returns the polymorphic UserModel as plain dicts (no
// response_model, so whatever columns exist on the concrete subtype come
// through). department/skillSet are only present on officer/worker rows.
const ADMIN_ROLE_LABEL = {
  citizen: 'Citizen',
  officer: 'Municipal Officer',
  municipal_officer: 'Municipal Officer',
  field_worker: 'Field Worker',
  administrator: 'Administrator',
};

export function fromApiUser(u) {
  if (!u) return null;
  return {
    id: u.userId,
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    role: u.role,
    roleLabel: ADMIN_ROLE_LABEL[String(u.role).toLowerCase()] || u.role,
    department: u.department || null,
    designation: u.designation || null,
    skillSet: u.skillSet || null,
    availabilityStatus: u.availabilityStatus || null,
    // The backend accepts writes to this field, but UserModel has no
    // isActive column, so the value it echoes back never actually reflects
    // a persisted suspension. Default true rather than imply a state we
    // cannot confirm.
    isActive: u.isActive !== false,
  };
}
