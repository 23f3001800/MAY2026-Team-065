// Citizen self-service endpoints.
//
// Both are scoped to the caller by the token — there is no user id in the path,
// so a citizen can only ever edit their own record. That is the backend's
// guarantee, not the frontend's; do not add an id parameter here.
import { apiRequest } from './client';

/**
 * PATCH /citizens/me/profile
 * Every field is optional, so send only what changed. Omitting a field leaves
 * it alone; sending an empty string would clear it.
 */
export function updateMyProfile({ name, phone, address }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (phone !== undefined) body.phone = phone;
  if (address !== undefined) body.address = address;
  return apiRequest('/citizens/me/profile', { method: 'PATCH', body });
}

/**
 * PATCH /citizens/me/password
 * Requires the old password, so a stolen session alone cannot change it.
 * A wrong old password comes back as a 400 with a message worth showing.
 */
export function changeMyPassword({ oldPassword, newPassword }) {
  return apiRequest('/citizens/me/password', {
    method: 'PATCH',
    body: { oldPassword, newPassword },
  });
}
