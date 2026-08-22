// Complaint endpoints. Every function returns UI-shaped data (see mappers.js);
// callers never see the wire format.
import { apiRequest } from './client';
import { API_BASE_URL } from '../config';
import {
  fromApiComplaint, fromApiFeedback, fromApiHistory, fromApiMedia,
  fromApiStatus, toApiStatus, toApiSeverity, UI_ONLY_STATUSES,
} from './mappers';

/**
 * Files a complaint, then uploads its photos.
 *
 * The backend takes these as two calls -- POST /complaints/ is JSON only, and
 * images go to a separate endpoint keyed by the new complaint id. They are not
 * in one transaction, so photos can fail after the complaint is safely filed.
 * Rather than hide that, the image error comes back alongside the complaint and
 * the caller decides how to word it.
 *
 * @param {File[]} [images] any number of photos, sent in one batch request
 * @returns {{ complaint: object, imageError: string|null }}
 */
export async function createComplaint({ description, categoryId, latitude, longitude, address, images = [] }) {
  const created = await apiRequest('/complaints/', {
    method: 'POST',
    body: {
      description,
      categoryId,
      location: { latitude, longitude, address },
    },
  });

  const complaint = fromApiComplaint(created);
  const files = Array.from(images || []).filter(Boolean);
  if (!files.length) return { complaint, imageError: null };

  try {
    await uploadComplaintImages(complaint.id, files);
    return { complaint, imageError: null };
  } catch (err) {
    return { complaint, imageError: err.message };
  }
}

// The backend reads the upload from a field literally named "file".
export function uploadComplaintImage(complaintId, file) {
  const form = new FormData();
  form.append('file', file);
  return apiRequest(`/complaints/${encodeURIComponent(complaintId)}/image`, {
    method: 'POST',
    body: form,
  });
}

// Scoped server-side by role: citizens get their own, officers and admins get
// everything. Field workers must use listMyTasks instead.
/**
 * @param {object} [opts]
 *   sort              'created' | 'aiConfidence' | 'expectedResolution'
 *   order             'asc' | 'desc'
 *   aiConfidenceMax   only complaints the classifier was at most this sure of
 *
 * Complaints that were never classified carry no confidence and the backend
 * excludes them from a confidence filter rather than treating them as zero --
 * "never classified" and "classified badly" are different queues.
 */
export async function listComplaints(opts = {}) {
  const { sort, order, aiConfidenceMax, aiConfidenceMin, limit, offset } = opts;
  const data = await apiRequest('/complaints/', {
    params: { sort, order, aiConfidenceMax, aiConfidenceMin, limit, offset },
  });
  return (data || []).map(fromApiComplaint);
}

export async function getComplaint(complaintId) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}`);
  return fromApiComplaint(data);
}

/**
 * A worker's own tasks.
 *
 * With `origin`, the backend orders them by distance from that point and
 * returns distanceKm on each. Without it, they come back newest first. The
 * backend refuses sort=distance with no coordinates rather than silently
 * falling back, so this only asks for it when it has a real position.
 */
export async function listMyTasks({ origin } = {}) {
  const params = origin
    ? { sort: 'distance', lat: origin.latitude, lng: origin.longitude }
    : undefined;
  const data = await apiRequest('/complaints/worker/tasks', { params });
  return (data || []).map(fromApiComplaint);
}

/**
 * Complaints near a point. The backend runs a bounding-box query and returns no
 * distance, so callers that need one compute it client-side.
 */
export async function listNearbyComplaints({ latitude, longitude, radiusKm = 5 }) {
  const data = await apiRequest('/complaints/nearby', {
    params: { latitude, longitude, radius_km: radiusKm },
  });
  return (data || []).map(fromApiComplaint);
}

/**
 * Assign many complaints to one worker.
 *
 * Partial success is normal and is reported per complaint: one already-resolved
 * complaint does not fail the rest. Returns the backend's shape unchanged so
 * the caller can show exactly which ones did not take, and why.
 *
 * @returns {{assigned: string[], failed: {complaintId, reason}[],
 *            assignedCount: number, failedCount: number}}
 */
export function bulkAssign(complaintIds, fieldWorkerId) {
  return apiRequest('/complaints/bulk-assign', {
    method: 'PATCH',
    body: { complaintIds, fieldWorkerId },
  });
}

/**
 * Open complaints past their SLA deadline.
 *
 * Not date-filtered: a complaint from months ago that is still open is the
 * point of it. `atRisk` is only populated when asked for.
 */
export async function listEscalations({ includeAtRisk = false } = {}) {
  return apiRequest('/complaints/escalations', {
    params: { includeAtRisk: includeAtRisk ? 'true' : undefined },
  });
}

export async function assignFieldWorker(complaintId, fieldWorkerId) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/assign`, {
    method: 'PATCH',
    body: { fieldWorkerId },
  });
  return fromApiComplaint(data);
}

/**
 * Moves a complaint to a new status. Rejects UI-only statuses up front rather
 * than letting the backend 422 on an enum value it does not have.
 */
export async function updateComplaintStatus(complaintId, status, remarks) {
  const apiStatus = toApiStatus(status);
  if (!apiStatus) {
    throw new Error(
      `"${status}" is not a status the backend can store yet — it supports PENDING, ASSIGNED, `
      + `RESOLVED and REJECTED. ${UI_ONLY_STATUSES.join(' and ')} are display-only for now.`,
    );
  }
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/status`, {
    method: 'PATCH',
    body: { status: apiStatus, remarks: remarks || null },
  });
  return fromApiComplaint(data);
}

/**
 * Which statuses this user may move THIS complaint to, right now.
 *
 * Two rules decide it -- what the lifecycle permits from the current status,
 * and what the role is allowed to do -- and both live on the server. Asking is
 * the only way to get both: a client-side role map cannot know that RESOLVED is
 * illegal on a complaint nobody has been dispatched to, so it offers the button
 * and the officer collects a 409 for pressing it.
 *
 * `allowed` is what to offer. `transitions` is every move legal from here
 * regardless of who is asking, so a control that is present-but-disabled can
 * say why ("only the citizen can verify this") instead of vanishing.
 *
 * The set changes with the status, so refetch after any status change.
 *
 * @returns {{complaintId: string, current: string, allowed: string[], transitions: string[]}}
 *          statuses as UI labels, not wire enums.
 */
export async function getAllowedStatuses(complaintId) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/allowed-statuses`);
  return {
    complaintId: data?.complaintId || complaintId,
    current: fromApiStatus(data?.current),
    allowed: (data?.allowed || []).map(fromApiStatus),
    transitions: (data?.transitions || []).map(fromApiStatus),
  };
}

export async function recategoriseComplaint(complaintId, categoryId) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/category`, {
    method: 'PATCH',
    body: { categoryId },
  });
  return fromApiComplaint(data);
}

/**
 * The complaint's audit trail: every status transition with its timestamp and
 * remarks. Until this endpoint existed the detail page could only show
 * "reported" and "last updated".
 */
export async function getComplaintHistory(complaintId) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/history`);
  return (data || []).map(fromApiHistory);
}

/**
 * Photos attached to a complaint — both the citizen's original evidence and
 * the field worker's resolution proof. `uploadedBy` is the user id, so callers
 * that need to split the two compare it against the complaint's citizenId.
 */
export async function getComplaintMedia(complaintId) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/media`);
  return (data || []).map((m) => fromApiMedia(m, API_BASE_URL));
}

// Batch upload. The single-file endpoint still exists; this one takes several
// in one request, which is what the worker's evidence step wants.
/**
 * @param {string} complaintId
 * @param {File[]} files
 * @param {object} [opts]
 *   remarks         the worker's note, recorded in status history
 *   idempotencyKey  kept stable across retries of the SAME upload
 *
 * The key is what makes a retry safe. Without it, a partial success followed by
 * a retry puts a second copy of the same photo on the complaint — evidence that
 * reads as two separate visits. With it, the backend replays the original
 * response and stores nothing new.
 */
export function uploadComplaintImages(complaintId, files, { remarks, idempotencyKey } = {}) {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  if (remarks) form.append('remarks', remarks);
  return apiRequest(`/complaints/${encodeURIComponent(complaintId)}/images`, {
    method: 'POST',
    body: form,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
}

// Officer/admin severity override. Separate from the status PATCH because the
// backend records it as its own audited action.
export async function overrideSeverity(complaintId, severity, remarks) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/severity`, {
    method: 'PATCH',
    body: { severity: toApiSeverity(severity), remarks: remarks || null },
  });
  return fromApiComplaint(data);
}

/**
 * Folds a duplicate into the complaint it repeats. This is the action behind
 * the AI's duplicate flag — until now the UI could show the flag but not act
 * on it.
 */
export async function mergeComplaint(complaintId, intoComplaintId, remarks) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/merge`, {
    method: 'POST',
    body: { intoComplaintId, remarks: remarks || null },
  });
  return fromApiComplaint(data);
}

// The citizen's acknowledgement slip for a filed complaint.
export function getReportSlip(complaintId) {
  return apiRequest(`/complaints/${encodeURIComponent(complaintId)}/report-slip`);
}

/**
 * Feedback left on a complaint.
 *
 * The rating is the only judgement of the work that comes from outside the
 * organisation, so it is worth showing to the people who did it -- not just
 * collecting it. The backend authorises the same people who can read the
 * complaint, so an officer and the assigned worker both see it.
 */
export async function getComplaintFeedback(complaintId) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/feedback`);
  return (data || []).map(fromApiFeedback).filter(Boolean);
}

export async function submitFeedback(complaintId, { rating, comments }) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/feedback`, {
    method: 'POST',
    body: { rating, comments: comments || null },
  });
  return fromApiFeedback(data);
}
