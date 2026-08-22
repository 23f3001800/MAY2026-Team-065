// Auth endpoints plus the session surface the rest of the app imports.
// Storage lives in session.js; this file re-exports it so pages keep a single
// import site.
import { apiRequest } from './client';
import { normalizeRole } from '../config';

export {
  saveSession, getCurrentUser, clearSession, getToken, homePathForRole,
} from './session';

// The login endpoint uses FastAPI's OAuth2PasswordRequestForm, so it expects
// form-encoded `username`/`password` rather than JSON. `username` is the email.
export async function login({ email, password }) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    auth: false,
    body: new URLSearchParams({ username: email, password }),
  });
  const user = userFromToken(data.access_token);
  if (!user) throw new Error('Signed in, but the session token could not be read.');
  return { access_token: data.access_token, user };
}

// POST /auth/register -> { message, userId }. Role is always "citizen" — the
// backend rejects anything else outright.
// `userId` is required by the request schema but the backend generates its own,
// so the value we send is discarded.
export function registerCitizen({ fullName, email, password, phoneNumber, address }) {
  return apiRequest('/auth/register', {
    method: 'POST',
    auth: false,
    body: {
      userId: newId(),
      name: fullName.trim(),
      email,
      password,
      role: 'citizen',
      phone: phoneNumber.trim(),
      address: address.trim(),
    },
  });
}

// ── Forgotten password ────────────────────────────────────────────
// Three calls: ask for a code, check it, use it. None of them need a token --
// the whole point is that the person cannot sign in.

/**
 * POST /auth/forgot-password -> 202, always.
 *
 * The response deliberately does not say whether the address is registered. Do
 * not add a check that would leak it either: "no account with that email" turns
 * this into a way of testing whether somebody is on the citizen register. The
 * screen shows the same wording whatever the answer.
 *
 * @returns {{message: string, expiresInMinutes: number}}
 */
export function requestPasswordReset(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: { email: email.trim() },
  });
}

/**
 * POST /auth/verify-reset-code -> 200, or 400 with a detail that counts down
 * the attempts left on this code.
 *
 * Does not consume the code -- reset still needs it. This exists so somebody
 * typing six digits off their phone finds out they mistyped BEFORE they have
 * also chosen and confirmed a new password.
 *
 * @returns {{verified: boolean, expiresInMinutes: number}}
 */
export function verifyResetCode({ email, code }) {
  return apiRequest('/auth/verify-reset-code', {
    method: 'POST',
    auth: false,
    body: { email: email.trim(), code: code.trim() },
  });
}

/**
 * POST /auth/reset-password -> 200, or 400 if the code has expired, been used,
 * or run out of attempts.
 *
 * The eight-character floor is checked here as well as on the server, so a
 * short password is a sentence under the field rather than a 422 round trip.
 *
 * @returns {{message: string, email: string}}
 */
export const MIN_PASSWORD_LENGTH = 8;

export function resetPassword({ email, code, newPassword }) {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return Promise.reject(
      new Error(`Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`),
    );
  }
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    auth: false,
    body: { email: email.trim(), code: code.trim(), newPassword },
  });
}

function newId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ── Token handling ────────────────────────────────────────────────
// Login returns only the JWT, so the signed-in user's identity has to come out
// of its payload. This is display/routing data only — the backend re-verifies
// the signature on every request, so a tampered payload gains nothing.
function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function userFromToken(token) {
  const claims = decodeJwtPayload(token);
  if (!claims) return null;
  const email = claims.sub || '';
  return {
    userId: claims.userId,
    email,
    role: normalizeRole(claims.role),
    name: email.split('@')[0] || 'User',
  };
}
