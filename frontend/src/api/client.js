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

/**
 * A rejected request, carrying the status code that rejected it.
 *
 * The code is the whole point. 403 and 409 are different problems with
 * different fixes, and collapsing them into one red banner sends people looking
 * in the wrong place: an officer told "forbidden" for a move that was merely
 * out of order goes hunting for a permissions bug that does not exist.
 *
 *   403  you may not do this, and waiting will not change that
 *   409  this does not follow from the state the record is in right now --
 *        often because somebody else moved it while you were looking at it
 *
 * Extends Error and keeps `detail` as the message, so the many callers that
 * only read `err.message` are unaffected.
 */
export class ApiError extends Error {
  constructor(status, detail, fallback) {
    super(detail || fallback);
    this.name = 'ApiError';
    this.status = status;
    // The server's own words, or null when it sent none. The 409 detail names
    // the valid next steps, which is the most useful sentence in the response.
    this.detail = detail || null;
  }

  get isForbidden() { return this.status === 403; }
  get isConflict() { return this.status === 409; }
  get isNotFound() { return this.status === 404; }
  get isValidation() { return this.status === 422; }
}

// Used only when the server sent no detail of its own. Never overrides one:
// "Valid next steps: under review, assigned" beats anything written here.
function fallbackMessage(status) {
  switch (status) {
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'That record could not be found.';
    case 409:
      return 'That is not a valid next step from where this record is now. '
        + 'Someone may have changed it while you were looking at it — refresh and try again.';
    case 429:
      return 'Too many requests. Wait a moment and try again.';
    default:
      return status >= 500
        ? 'The server hit an error handling that. Try again in a moment.'
        : `Request failed (${status})`;
  }
}

/**
 * How to present a failed action: which banner, and what to say above the
 * server's own message.
 *
 * A conflict is not the user doing something wrong, so it is a warning rather
 * than an error -- and `recoverable` marks the case where refetching and
 * retrying is the actual fix, which the caller can act on.
 *
 * @returns {{tone: 'error'|'warning', heading: string|null, message: string, recoverable: boolean}}
 */
export function describeApiError(err) {
  const status = err?.status;
  const message = err?.message || 'Something went wrong.';

  if (status === 409) {
    return {
      tone: 'warning',
      heading: 'That step is out of order',
      message,
      recoverable: true,
    };
  }
  if (status === 403) {
    return {
      tone: 'error',
      heading: 'Not yours to do',
      message,
      recoverable: false,
    };
  }
  return { tone: 'error', heading: null, message, recoverable: false };
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
 *   acceptStatuses
 *            status codes to return the parsed body for instead of throwing.
 *            For endpoints whose failure response IS the answer -- GET
 *            /health/ready reports 503 when the database is unreachable, and
 *            the body naming which subsystem is down is exactly what the caller
 *            wanted. Throwing there would discard the diagnosis.
 */
export async function apiRequest(
  path,
  {
    method = 'GET', body, auth = true, params, headers: extraHeaders,
    acceptStatuses = [],
  } = {},
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

  // 304 is a SUCCESS: the body you already have is still current. Nothing here
  // sends If-None-Match today -- GET /categories carries an ETag and
  // Cache-Control, and the browser's own HTTP cache revalidates it invisibly,
  // so fetch only ever sees a 200. This guard exists because the day somebody
  // adds a manual conditional request, the "every non-2xx is an error" rule
  // below would turn a successful revalidation into a thrown error, and that
  // is a confusing thing to debug.
  //
  // Returning null rather than the body: this layer has no cache to read the
  // previous response back out of. A caller that sends If-None-Match owns the
  // stored copy and must substitute it when this returns null.
  if (response.status === 304) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (an HTML error page, or an empty body).
  }

  if (!response.ok && !acceptStatuses.includes(response.status)) {
    throw new ApiError(
      response.status,
      readError(data),
      fallbackMessage(response.status),
    );
  }
  return data;
}
