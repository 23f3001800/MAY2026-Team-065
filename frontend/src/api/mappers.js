// Translation layer between the backend's wire format and the shapes the UI
// components already speak. Keeping it here means pages never deal with
// SCREAMING_CASE enums or category ids.
//
// The CATEGORIES table below is a fallback only -- useCategories fetches the
// real list from GET /categories. Keep it roughly in step with seed.py so the
// fallback stays sane, but it is no longer the source of truth.

// ── Status ────────────────────────────────────────────────────────
// Mirrors backend/database.py StatusEnum, which now runs to ten states across
// three phases: intake & triage, action & dispatch, closure & validation.
// Nothing is display-only any more -- every status here round-trips.
const STATUS_FROM_API = {
  PENDING: 'New',
  UNDER_REVIEW: 'Under Review',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
  VERIFIED: 'Verified',
  REOPENED: 'Reopened',
  REJECTED: 'Rejected',
};

const STATUS_TO_API = Object.fromEntries(
  Object.entries(STATUS_FROM_API).map(([api, ui]) => [ui, api]),
);

// Kept for callers that still import it; nothing is UI-only now that the
// backend models the full lifecycle.
export const UI_ONLY_STATUSES = [];

export function fromApiStatus(status) {
  if (!status) return 'New';
  return STATUS_FROM_API[String(status).toUpperCase()] || String(status);
}

export function toApiStatus(status) {
  return STATUS_TO_API[status] || null;
}

// Lifecycle order, used to sort dropdowns and lay out progress.
export const ALL_STATUSES = Object.values(STATUS_FROM_API);

// Statuses no longer counted as active work (backend TERMINAL_STATUSES).
export const TERMINAL_STATUSES = ['Verified', 'Rejected'];

/**
 * FALLBACK ONLY. Which statuses a role may set, mirroring the role half of
 * services/lifecycle.py.
 *
 * This answers "may this role ever set that status" and nothing else. It does
 * not know what state the complaint is in, so on its own it offers moves the
 * backend refuses with a 409: RESOLVED on a complaint nobody has been
 * dispatched to, IN_PROGRESS on one the citizen has already verified.
 *
 * The real answer is GET /complaints/{id}/allowed-statuses, which applies both
 * halves of the rule -- the transition graph and the role matrix -- to this
 * complaint right now. Use useAllowedStatuses; this is what it falls back to
 * when that call fails, so a network blip degrades to a slightly-too-generous
 * menu rather than no controls at all.
 */
const CITIZEN_SETTABLE = ['Verified', 'Reopened'];
const WORKER_SETTABLE = ['In Progress', 'On Hold', 'Resolved', 'Escalated'];

export function statusesSettableBy(role) {
  switch (role) {
    case 'citizen': return CITIZEN_SETTABLE;
    case 'field_worker': return WORKER_SETTABLE;
    // municipal_officer, admin — triage and dispatch decisions included.
    default: return ALL_STATUSES;
  }
}

/**
 * Why a move that is legal from here is not offered to *this* user.
 *
 * `transitions` from the allowed-statuses endpoint lists every move the
 * lifecycle permits from the current status, regardless of who is asking.
 * Subtract `allowed` and what is left is blocked on permission, not on order --
 * and that is worth saying out loud. A control that explains "only the citizen
 * can verify this" tells an officer the work is done and they are waiting on
 * someone else; the same control silently absent tells them nothing.
 *
 * Mirrors the CITIZEN_SETTABLE / WORKER_SETTABLE / OFFICIAL_ONLY split in
 * services/lifecycle.py. Returns null for a status with no note to add.
 */
const STATUS_OWNER_NOTE = {
  'Verified': 'only the citizen who filed this, or an official, can verify it',
  'Reopened': 'only the citizen who filed this, or an official, can reopen it',
  'In Progress': 'only the assigned field worker, or an official, can set this',
  'On Hold': 'only the assigned field worker, or an official, can set this',
  'Resolved': 'only the assigned field worker, or an official, can set this',
  'Escalated': 'only the assigned field worker, or an official, can set this',
  'New': 'only an officer or administrator can set this',
  'Under Review': 'only an officer or administrator can set this',
  'Assigned': 'only an officer or administrator can set this',
  'Rejected': 'only an officer or administrator can set this',
};

export function statusOwnerNote(status) {
  return STATUS_OWNER_NOTE[status] || null;
}

// Back-compat alias: the officer queue used this name for "everything".
export const ASSIGNABLE_STATUSES = ALL_STATUSES;

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
    // When it FIRST entered Resolved. Null means unknown — either it never has,
    // or it predates the column and had no history entry to backfill from.
    // Never treat null as zero.
    resolvedAt: c.resolvedAt || null,

    // When the city undertook to fix this by, from the severity SLA. Null when
    // the backend could not compute it -- never a guess, and never rendered as
    // "due now".
    expectedResolutionAt: c.expectedResolutionAt || null,
    slaBreached: c.slaBreached === true,
    // Hours until the deadline; negative once overdue, null once closed.
    hoursRemaining: typeof c.hoursRemaining === 'number' ? c.hoursRemaining : null,

    // Only present on the worker task feed when sorted by distance.
    distanceKm: typeof c.distanceKm === 'number' ? c.distanceKm : null,

    // The people on the record. citizenId in particular turns the before/after
    // photo split from an inference into a fact (see lib/evidence.js).
    citizenId: c.citizenId || null,
    officerId: c.officerId || null,
    fieldWorkerId: c.fieldWorkerId || null,

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
          // aiSummary is deliberately not carried through. It restated the
          // description without adding anything an officer could act on, and
          // every extra line in the drawer competes with the decisions that
          // matter. The field still exists on the wire and on the report slip.
          confidence: typeof c.aiConfidence === 'number' ? c.aiConfidence : null,
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
    // Which side of the work this documents, decided by the backend at upload
    // time: 'report' or 'resolution'. Null on records served by a backend that
    // predates the column, which is what the fallback in lib/evidence.js is for.
    phase: m.phase || null,
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

// ── Account creation: was the password actually delivered? ────────
/**
 * "Created" and "they can sign in" are two different facts, and only the first
 * is guaranteed. When `emailed` is false the administrator still has to make
 * contact by hand, and they need to know that at the moment of creation rather
 * than a week later when the new hire says nothing ever arrived.
 *
 * Returns null when the backend sent no such field, which is the honest answer
 * for a deployment that predates it -- the caller words that case as unknown
 * rather than as success.
 */
export function fromApiCredentialDelivery(d) {
  if (!d || typeof d.emailed !== 'boolean') return null;
  return { emailed: d.emailed, detail: d.detail || '' };
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
