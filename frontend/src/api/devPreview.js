// DEV-ONLY preview shortcut. Lets you enter any role's dashboard without a
// real backend login (no console commands needed). It fabricates a fake
// session and stores it exactly like a real login would.
//
// TODO(raja-api): DELETE this file once real login works. It is only ever
// imported behind an `isDevPreviewEnabled()` check, so it never ships in a
// production build (`npm run build`), but remove it to be safe.
import { saveSession, homePathForRole } from './auth';

// Only true during local development (`npm start`). In a production build
// process.env.NODE_ENV === 'production', so the buttons never render.
export function isDevPreviewEnabled() {
  return process.env.NODE_ENV === 'development';
}

// A believable mock user per role, so dashboards have a name to greet.
const MOCK_USERS = {
  citizen: { userId: 1, name: 'Aarav Sharma', email: 'aarav@example.com', role: 'citizen' },
  municipal_officer: { userId: 2, name: 'Priya Menon', email: 'priya@civicconnect.org', role: 'municipal_officer' },
  field_worker: { userId: 3, name: 'Ravi Kumar', email: 'ravi@civicconnect.org', role: 'field_worker' },
  admin: { userId: 4, name: 'Neha Gupta', email: 'neha@civicconnect.org', role: 'admin' },
};

// Roles shown as preview buttons, in display order.
export const PREVIEW_ROLES = [
  { role: 'citizen', label: 'Citizen' },
  { role: 'municipal_officer', label: 'Officer' },
  { role: 'field_worker', label: 'Field Worker' },
  { role: 'admin', label: 'Admin' },
];

// Save a fake session for the given role and return where to land.
export function startPreview(role) {
  const user = MOCK_USERS[role];
  saveSession({ access_token: `dev-preview-${role}`, user });
  return homePathForRole(role);
}
