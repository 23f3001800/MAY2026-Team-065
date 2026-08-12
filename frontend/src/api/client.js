// Single HTTP entry point for the whole app: attaches the bearer token,
// normalises FastAPI's two error shapes, and turns an expired session into a
// clean redirect rather than a wall of 401s.
import { API_BASE_URL } from '../config';
import { getToken, clearSession } from './session';

// Thrown on a 401 so callers can tell "your session died" apart from "that
// request was rejected". Pages generally do not need to catch it -- the client
// has already cleared the session and sent the user to /login.
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.');
    this.name = 'SessionExpiredError';
  }
}

// FastAPI returns `detail` as a string for HTTPException, but as an array of
// per-field objects for 422 validation errors.
export function readError(data) {
  const { detail } = data || {};
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        // `loc` is like ["body", "location", "latitude"] -- the last entry is
        // the field name, which is the only part worth showing a user.
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
        return field && d.msg ? `${field}: ${d.msg}` : d.msg;
      })
      .filter(Boolean)
      .join(', ');
  }
  return null;
}

/**
 * @param {string} path      e.g. '/complaints/'
 * @param {object} options
 *   method   HTTP verb, defaults to GET
 *   body     plain object (sent as JSON), URLSearchParams (form), or FormData
 *   auth     attach the bearer token; defaults to true
 *   params   object appended as a query string, skipping null/undefined
 *   headers  extra request headers, e.g. Idempotency-Key on a retryable upload
 */
export async function apiRequest(
  path, { method = 'GET', body, auth = true, params, headers: extraHeaders } = {},
) {
  const headers = { ...(extraHeaders || {}) };
  let payload;

  if (body instanceof FormData) {
    // Deliberately no Content-Type: the browser has to set the multipart
    // boundary itself, and setting it by hand breaks the upload.
    payload = body;
  } else if (body instanceof URLSearchParams) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = body.toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  let response;
  try {
    response = await fetch(url.toString(), { method, headers, body: payload });
  } catch {
    // fetch only rejects on network failure (server down, CORS, offline).
    throw new Error('Cannot reach the server. Is the backend running?');
  }

  if (response.status === 401 && auth) {
    clearSession();
    // Hard redirect rather than a router navigate: this can fire from anywhere,
    // including outside a Router context, and a full reload guarantees no stale
    // authenticated state survives.
    if (window.location.pathname !== '/login') {
      window.location.assign('/login?expired=1');
    }
    throw new SessionExpiredError();
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (an HTML error page, or an empty body).
  }

  if (!response.ok) {
    throw new Error(readError(data) || `Request failed (${response.status})`);
  }
  return data;
}
