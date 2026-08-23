// Municipal officer endpoints.
//
// There is only one so far, and it exists because the login JWT is the app's
// only source of identity (see api/auth.js userFromToken) and it carries just
// email, userId and role. Department and designation live on the
// municipal_officers row, so nothing on the client could show an officer which
// desk they sit at -- which is now the thing that decides what reaches their
// queue.
import { apiRequest } from './client';

/**
 * The signed-in officer's own record: department and designation included.
 *
 * Read-only. Department decides which complaints route to an officer and which
 * ones they are shown, so changing it is an administrator's decision, not a
 * self-service field -- there is deliberately no PATCH counterpart.
 *
 * @returns {{userId, name, email, phone, department, designation}}
 */
export function getMyOfficerProfile() {
  return apiRequest('/officers/me/profile');
}
