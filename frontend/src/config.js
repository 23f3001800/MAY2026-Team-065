// Central place for app-wide constants.
// Override the API base at build time with REACT_APP_API_URL if the backend
// runs somewhere other than raja's local FastAPI server.
// No `/api` prefix — the FastAPI routes are mounted at the root (`/auth/...`).
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:8000';

// The four user types in SmartCivicConnect, keyed by the role slug the UI uses.
// Only `citizen` may self-register; the other roles are provisioned by an admin.
export const ROLES = {
  citizen: { label: 'Citizen', color: 'primary' },
  municipal_officer: { label: 'Municipal Officer', color: 'secondary' },
  field_worker: { label: 'Field Worker', color: 'amber' },
  admin: { label: 'Admin', color: 'purple' },
};

// The backend stores roles as SQLAlchemy polymorphic identities, which do not
// all match the UI slugs above. Normalise at the API boundary so the rest of
// the app only ever deals with the keys in ROLES.
const BACKEND_ROLE_ALIASES = {
  officer: 'municipal_officer',
  administrator: 'admin',
};

export function normalizeRole(role) {
  if (!role) return null;
  const slug = String(role).toLowerCase();
  return BACKEND_ROLE_ALIASES[slug] || slug;
}
