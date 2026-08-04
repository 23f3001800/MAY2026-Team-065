// Admin-only endpoints: city analytics, user search, officer provisioning,
// suspend/edit, and password resets. Every function here 403s server-side for
// anyone who isn't `administrator`, so pages calling these only ever render
// behind the admin route guard.
import { apiRequest } from './client';
import { fromApiUser } from './mappers';

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
export function createOfficer({ name, email, phone, password, department, designation }) {
  return apiRequest('/admin/users/official', {
    method: 'POST',
    body: {
      name,
      email,
      phone: phone || 'Not Provided',
      password,
      role: 'municipal_officer',
      department: department || 'Unassigned',
      designation: designation || 'General Officer',
    },
  });
}

/**
 * Suspend/activate a user, or change an officer's department.
 *
 * Worth knowing: UserModel has no `isActive` column and FieldWorkerModel has
 * no `department` column, so those two writes are accepted by the backend but
 * never persist -- the response says "updated successfully" either way. Only
 * an officer's `department` actually lands in the database. Callers should
 * not assume a 200 here changed anything but department for a
 * municipal_officer.
 */
export function updateUser(userId, { isActive, department } = {}) {
  return apiRequest(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: { isActive, department },
  });
}

export function resetUserPassword(userId, newPassword) {
  return apiRequest(`/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'PATCH',
    body: { newPassword },
  });
}
