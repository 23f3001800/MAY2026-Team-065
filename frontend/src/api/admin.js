// Admin-only endpoints: city analytics, user search, officer provisioning,
// suspend/edit, and password resets. Every function here 403s server-side for
// anyone who isn't `administrator`, so pages calling these only ever render
// behind the admin route guard.
import { apiRequest } from './client';
import { fromApiUser, fromApiCredentialDelivery } from './mappers';

/**
 * City-wide counts. The backend aggregates totals and per-status/severity
 * breakdowns; anything more granular (trends, top categories, per-department
 * rollups) has to be computed client-side from GET /complaints/, which admins
 * can already call in full.
 */
export function getCityAnalytics() {
  return apiRequest('/admin/analytics');
}

/**
 * @param {object} [opts]
 *   query   matched against name/email (ILIKE, server-side)
 *   role    exact match on the stored polymorphic identity
 *              ('citizen' | 'officer' | 'field_worker' | 'administrator')
 *   skip/limit  pagination, defaults 0/50, backend caps limit at 100
 */
export async function listUsers({ query, role, skip = 0, limit = 100 } = {}) {
  const data = await apiRequest('/admin/users', { params: { query, role, skip, limit } });
  return (data || []).map(fromApiUser);
}

/**
 * Creates a Municipal Officer account. The backend's SystemOfficialCreate
 * schema also accepts role: "field_worker", but that branch was never
 * implemented server-side (main.py only builds a MunicipalOfficerModel) and
 * throws a 500 if used. Field workers must go through createFieldWorker
 * (POST /workers/) instead -- see api/workers.js.
 */
export async function createOfficer({ name, email, phone, password, department, designation }) {
  const data = await apiRequest('/admin/users/official', {
    method: 'POST',
    body: {
      name,
      email,
      phone: phone || 'Not Provided',
      // Optional. Omitted, the server generates one and emails it -- see the
      // note on createFieldWorker.
      password: password || undefined,
      role: 'municipal_officer',
      department: department || 'Unassigned',
      designation: designation || 'General Officer',
    },
  });
  return {
    userId: data?.userId || null,
    message: data?.message || '',
    credentialDelivery: fromApiCredentialDelivery(data?.credentialDelivery),
  };
}

/**
 * Update an account.
 *
 * Everything here now persists. Through Sprint 1 this endpoint answered
 * "User updated successfully" while saving nothing -- it wrote
 * `field_worker.skills` where the column is `skillSet` -- so the UI locked the
 * fields rather than lie about them. The backend was fixed and returns the
 * updated record, which is why the caller can trust the response instead of
 * re-reading the list.
 *
 * Only send what changed: omitted fields are left alone, so saving a phone
 * number cannot blank an address.
 *
 * @param {object} changes
 *   name, email, phone   any account
 *   department           municipal officers only
 *   skills               field workers only, as an array
 *   isActive             false suspends: blocks sign-in and existing tokens
 * @returns the updated user, already mapped
 */
export async function updateUser(userId, changes = {}) {
  const body = {};
  for (const key of ['name', 'email', 'phone', 'department', 'skills', 'isActive']) {
    if (changes[key] !== undefined) body[key] = changes[key];
  }
  const data = await apiRequest(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body,
  });
  return fromApiUser(data);
}

/**
 * Deactivate an account. A SOFT delete.
 *
 * Complaints reference citizenId, officerId and fieldWorkerId, and status
 * history records who made every transition, so removing the row would orphan
 * the audit trail. The account is marked inactive instead, which blocks
 * sign-in and invalidates tokens already issued.
 *
 * Reverse it with updateUser(id, { isActive: true }).
 */
export async function deactivateUser(userId) {
  const data = await apiRequest(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  return fromApiUser(data);
}

export function resetUserPassword(userId, newPassword) {
  return apiRequest(`/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'PATCH',
    body: { newPassword },
  });
}

/**
 * POST /admin/sla/sweep
 *
 * Scans for complaints that have breached their expected resolution window and
 * raises a notification for each. This is the "alert officers when complaints
 * breach expected resolution timelines" requirement.
 *
 * It is a manual trigger, which is worth being honest about in the UI: nothing
 * runs it on a schedule yet, so breaches are only detected when somebody
 * presses the button.
 */
export function runSlaSweep() {
  return apiRequest('/admin/sla/sweep', { method: 'POST' });
}

/**
 * Give every ownerless open complaint to its department's officer.
 *
 * Complaints are routed on filing now, but that only helps the ones filed
 * since. Anything created while ownership was a side effect of dispatch, and
 * never dispatched, has no officer -- and the officer notifications for
 * escalation, resolution and SLA breach are addressed to officerId, so for
 * those complaints they are created for nobody.
 *
 * Idempotent: it only touches complaints where officerId is null, so running it
 * twice is not a second pass over the same records.
 *
 * `unroutable` is keyed by department and is the interesting half of the
 * answer: those are the departments with no officer at all. That is a staffing
 * gap, not a run failure, and it does not fix itself.
 *
 * @returns {{message: string, considered: number, routed: number,
 *            unroutable: Record<string, number>}}
 */
export function routeUnassignedComplaints() {
  return apiRequest('/admin/complaints/route-unassigned', { method: 'POST' });
}
