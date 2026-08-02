// Session storage, kept separate from auth.js so the HTTP client can read the
// token and clear an expired session without importing auth.js (which imports
// the client -- that would be a cycle).
import { normalizeRole } from '../config';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function saveSession({ access_token, user }) {
  localStorage.setItem(TOKEN_KEY, access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
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
