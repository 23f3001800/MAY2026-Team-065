// Thin wrapper around raja's auth endpoints. Keeps fetch/JSON/error handling
// out of the page components so the UI stays focused on presentation.
import { API_BASE_URL, normalizeRole } from '../config';

async function send(path, { body, contentType }) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
  } catch (networkErr) {
    // fetch only rejects on network failure (server down, CORS, offline).
    throw new Error('Cannot reach the server. Is the backend running?');
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (e.g. an HTML error page) — leave data empty.
  }

  if (!response.ok) {
    throw new Error(readError(data) || `Request failed (${response.status})`);
  }
  return data;
}

// FastAPI returns `detail` as a string for HTTPException, but as an array of
// per-field objects for 422 validation errors.
function readError(data) {
  const { detail } = data || {};
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).filter(Boolean).join(', ');
  return null;
}

// The login endpoint uses FastAPI's OAuth2PasswordRequestForm, so it expects
// form-encoded `username`/`password` rather than JSON. `username` is the email.
export async function login({ email, password }) {
  const form = new URLSearchParams({ username: email, password });
  const data = await send('/auth/login', {
    body: form.toString(),
    contentType: 'application/x-www-form-urlencoded',
  });
  const user = userFromToken(data.access_token);
  if (!user) throw new Error('Signed in, but the session token could not be read.');
  return { access_token: data.access_token, user };
}

// POST /auth/register -> { message, userId }. Role is always "citizen".
// `userId` is required by the request schema but the backend generates its own,
// so the value we send is discarded.
export function registerCitizen({ fullName, email, password, phoneNumber, address }) {
  return send('/auth/register', {
    contentType: 'application/json',
    body: JSON.stringify({
      userId: newId(),
      name: fullName.trim(),
      email,
      password,
      role: 'citizen',
      phone: phoneNumber.trim(),
      address: address.trim(),
    }),
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

// ── Session helpers (localStorage-backed) ─────────────────────────
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function saveSession({ access_token, user }) {
  localStorage.setItem(TOKEN_KEY, access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getCurrentUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Landing route for a user based on their role.
export function homePathForRole(role) {
  switch (normalizeRole(role)) {
    case 'admin': return '/admin/dashboard';
    case 'municipal_officer': return '/officer/dashboard';
    case 'field_worker': return '/worker/dashboard';
    default: return '/dashboard';
  }
}
