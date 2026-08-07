// Complaint endpoints. Every function returns UI-shaped data (see mappers.js);
// callers never see the wire format.
import { apiRequest } from './client';
import { API_BASE_URL } from '../config';
import {
  fromApiComplaint, fromApiFeedback, fromApiHistory, fromApiMedia,
  toApiStatus, toApiSeverity, UI_ONLY_STATUSES,
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
export async function listComplaints() {
  const data = await apiRequest('/complaints/');
  return (data || []).map(fromApiComplaint);
}

export async function getComplaint(complaintId) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}`);
  return fromApiComplaint(data);
}

export async function listMyTasks() {
  const data = await apiRequest('/complaints/worker/tasks');
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
export function uploadComplaintImages(complaintId, files) {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  return apiRequest(`/complaints/${encodeURIComponent(complaintId)}/images`, {
    method: 'POST',
    body: form,
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

export async function submitFeedback(complaintId, { rating, comments }) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/feedback`, {
    method: 'POST',
    body: { rating, comments: comments || null },
  });
  return fromApiFeedback(data);
}
