// Field worker endpoints (officer and admin facing, plus the worker's own
// availability toggle).
import { apiRequest } from './client';
import { fromApiWorker } from './mappers';

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
