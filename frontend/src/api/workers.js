// Field worker endpoints (officer and admin facing, plus the worker's own
// availability toggle).
import { apiRequest } from './client';
import { fromApiWorker, fromApiCredentialDelivery } from './mappers';

/**
 * @param {string} [skillSet] free-text filter, matched with ILIKE server-side.
 *
 * Worth knowing before assigning: the backend rejects an assignment when the
 * complaint category's department is not a substring of the worker's skillSet.
 * That check is a plain string match, so a worker whose skillSet reads
 * "Plumbing" cannot take a "Water & Plumbing" complaint.
 */
export async function listFieldWorkers(skillSet) {
  const data = await apiRequest('/workers/', { params: { skillSet } });
  return (data || []).map(fromApiWorker);
}

// Field worker toggling their own availability. Backend accepts only the two
// literal values.
export function setMyAvailability(available) {
  return apiRequest('/workers/me/availability', {
    method: 'PATCH',
    body: { status: available ? 'AVAILABLE' : 'UNAVAILABLE' },
  });
}

/**
 * Admin-only: register a new field worker account.
 *
 * skillSet is free text (e.g. "Roads & Transport, Sanitation") -- assignment
 * later does a plain substring match against a complaint's department, so it
 * is worth typing department names out in full rather than abbreviating.
 *
 * `password` is optional. Omit it and the server generates one and emails it,
 * which is better than whatever an administrator invents under time pressure --
 * and means nobody but the account holder ever sees it. Whether that email
 * actually went anywhere comes back in credentialDelivery, which is the
 * caller's problem to surface: an account nobody can sign in to is not a
 * success.
 *
 * @returns {{worker: object, credentialDelivery: {emailed, detail}|null}}
 */
export async function createFieldWorker({ name, email, phone, password, skillSet }) {
  const data = await apiRequest('/workers/', {
    method: 'POST',
    // undefined is dropped by JSON.stringify, so an omitted password reaches
    // the server as absent rather than as null -- which the schema rejects.
    body: { name, email, phone, password: password || undefined, skillSet },
  });
  return {
    worker: fromApiWorker(data),
    credentialDelivery: fromApiCredentialDelivery(data?.credentialDelivery),
  };
}

/**
 * The signed-in worker's own profile: base address and last reported position.
 *
 * Separate from listFieldWorkers, which is the officer's view of the roster --
 * this one is scoped server-side to the caller and carries fields a worker may
 * change about themselves.
 */
export async function getMyWorkerProfile() {
  return apiRequest('/workers/me/profile');
}

/**
 * Update the worker's own profile.
 *
 * Coordinates must be sent as a pair; the backend 422s on half of one, because
 * a row with one coordinate looks locatable and is not. Omitted fields are left
 * alone rather than blanked, so saving a phone number does not clear an address.
 *
 * Skills are deliberately not settable here -- what a worker is qualified for
 * decides what they can be assigned, so it stays an administrator's call.
 */
export async function updateMyWorkerProfile({ name, phone, baseAddress, coords } = {}) {
  return apiRequest('/workers/me/profile', {
    method: 'PATCH',
    body: {
      name,
      phone,
      baseAddress,
      currentLatitude: coords?.latitude,
      currentLongitude: coords?.longitude,
    },
  });
}
