// Complaint endpoints. Every function returns UI-shaped data (see mappers.js);
// callers never see the wire format.
import { apiRequest } from './client';
import {
  fromApiComplaint, fromApiFeedback, toApiStatus, UI_ONLY_STATUSES,
} from './mappers';

/**
 * Files a complaint, then uploads the photo if there is one.
 *
 * The backend takes these as two calls -- POST /complaints/ is JSON only, and
 * the image goes to a separate endpoint keyed by the new complaint id. They are
 * not in one transaction, so the photo can fail after the complaint is safely
 * filed. Rather than hide that, the image error comes back alongside the
 * complaint and the caller decides how to word it.
 *
 * @returns {{ complaint: object, imageError: string|null }}
 */
export async function createComplaint({ description, categoryId, latitude, longitude, address, image }) {
  const created = await apiRequest('/complaints/', {
    method: 'POST',
    body: {
      description,
      categoryId,
      location: { latitude, longitude, address },
    },
  });

  const complaint = fromApiComplaint(created);
  if (!image) return { complaint, imageError: null };

  try {
    await uploadComplaintImage(complaint.id, image);
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

export async function submitFeedback(complaintId, { rating, comments }) {
  const data = await apiRequest(`/complaints/${encodeURIComponent(complaintId)}/feedback`, {
    method: 'POST',
    body: { rating, comments: comments || null },
  });
  return fromApiFeedback(data);
}
