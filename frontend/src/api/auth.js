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
