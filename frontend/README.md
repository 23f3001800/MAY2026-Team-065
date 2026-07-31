# SmartCivicConnect — Frontend

React frontend for a civic complaint & resolution portal. Citizens report issues
(potholes, garbage, water leakage, streetlights); officers assign them to field
workers; admins oversee everything.

**This directory is the frontend only.** The FastAPI backend is in
[`../backend`](../backend) and is still early — only `/auth/register` and
`/auth/login` exist today. See [Backend integration](#backend-integration) for
what is wired up and what is still mocked.

---

## Tech stack

| | |
|---|---|
| Framework | React 19 (Create React App / `react-scripts` 5) |
| Routing | React Router v7 (`BrowserRouter`) |
| Styling | Tailwind CSS 3 + a few custom utilities in `src/index.css` |
| Icons | Inline SVG components (no icon library) |
| State | Local component state + `localStorage` for the session |
| HTTP | `fetch` (no axios) |

Fonts: Plus Jakarta Sans (body) and Outfit (display), loaded from Google Fonts.

---

## Quick start

```bash
npm install
npm start          # http://localhost:3000
```

Production build:

```bash
npm run build      # outputs to build/
```

### Environment

One optional variable. Create `.env.local` in the project root if your backend
isn't on the default host:

```
REACT_APP_API_URL=http://localhost:8000
```

Default is `http://localhost:8000` (see [src/config.js](src/config.js)). Note
there is **no `/api` prefix** — the FastAPI routes are mounted at the root.
CRA only exposes vars prefixed with `REACT_APP_`, and you must restart
`npm start` after changing it.

---

## Working without the backend (dev preview)

You don't need a running API to look at the UI. On the login page in
development, there are **preview buttons** for each role — click one and it
fabricates a session and drops you straight into that role's dashboard.

| Button | Lands on |
|---|---|
| Citizen | `/dashboard` |
| Officer | `/officer/dashboard` |
| Field Worker | `/worker/dashboard` |
| Admin | `/admin/dashboard` |

This lives in [src/api/devPreview.js](src/api/devPreview.js) and is gated on
`process.env.NODE_ENV === 'development'`, so the buttons never render in a
production build. **Delete that file once real login works.**

---

## Project structure

```
src/
├── App.js                  # all routes + auth guard
├── config.js               # API_BASE_URL, ROLES
├── index.css               # Tailwind directives + custom utilities
│
├── api/
│   ├── auth.js             # login / register + localStorage session helpers
│   ├── complaints.js       # POST /complaints (multipart, provisional)
│   └── devPreview.js       # DEV ONLY — fake login per role
│
├── layouts/                # one shell per role (sidebar + topbar + <Outlet/>)
│   ├── CitizenLayout.jsx
│   ├── OfficerLayout.jsx
│   ├── WorkerLayout.jsx
│   └── AdminLayout.jsx
│
├── pages/
│   ├── Login.jsx  Register.jsx
│   ├── CitizenDashboard.jsx  ReportIssue.jsx  MyComplaints.jsx
│   ├── ComplaintDetails.jsx  Notifications.jsx  NearbyIssues.jsx
│   ├── Placeholder.jsx     # stub for routes not built yet
│   ├── officer/            # OfficerDashboard.jsx  OfficerComplaints.jsx
│   ├── worker/  admin/
│
├── components/
│   ├── AuthBackground.jsx AuthCard.jsx BrandPane.jsx formControls.jsx icons.jsx
│   ├── dashboard/          # Sidebar, Topbar, StatCard, badges, PhotoTile, icons
│   ├── officer/            # officerNav.js + ComplaintDrawer.jsx
│   ├── admin/  worker/     # role-specific nav configs + widgets
│
└── data/                   # mock data — swap for real API calls
    ├── mockDashboard.js  mockComplaints.js  mockComplaintDetails.js
    ├── mockNotifications.js  mockNearby.js
    ├── mockAdmin.js  mockOfficer.js  mockOfficerQueue.js  mockWorker.js
```

### Conventions

- `.jsx` = renders UI. `.js` = logic / data / config.
- Nav items per role are plain arrays (`adminNav.js`, `officerNav.js`,
  `workerNav.js`) — add a link there, add the route in `App.js`.
- Auth screens are dark themed; everything behind login is a dark sidebar with
  a light content area.
- Tailwind theme extensions (brand colors, animations, shadows) are in
  [tailwind.config.js](tailwind.config.js). Prefer those tokens over raw hex.

---

## Routes

Everything except `/login` and `/register` is behind `RequireAuth`, which
redirects to `/login` when there is no session. Each role's area also passes an
`allow` list, so a signed-in user who wanders into another role's section is
bounced to their own home rather than shown it. Any unknown path sends you to
your role's home (or `/login` if signed out).

> This is a **UX guard, not a security boundary** — it only reads the role out
> of `localStorage`. The backend must enforce authorization on every endpoint.

**Public** — `/login`, `/register` (self-register is citizen-only)

**Citizen** — `/dashboard`, `/report`, `/my-complaints`, `/complaints/:id`,
`/nearby`, `/notifications`, `/track`*, `/ai-assistant`*, `/feedback`*,
`/profile`*, `/settings`*

**Officer** — `/officer/dashboard`, `/officer/complaints`, `/officer/workers`*,
`/officer/analytics`*, `/officer/notifications`*, `/officer/profile`*,
`/officer/settings`*

**Worker** — `/worker/dashboard`, `/worker/tasks`*, `/worker/map`*,
`/worker/history`*, `/worker/notifications`*, `/worker/profile`*,
`/worker/settings`*

**Admin** — `/admin/dashboard`, `/admin/users`*, `/admin/complaints`*,
`/admin/departments`*, `/admin/categories`*, `/admin/analytics`*,
`/admin/reports`*, `/admin/settings`*

`*` = renders `<Placeholder />`, not built yet.

---

## Backend integration

### Wired up

| Call | Endpoint | Notes |
|---|---|---|
| `login()` | `POST /auth/login` | **form-urlencoded**, not JSON — `username` (the email) + `password` |
| `registerCitizen()` | `POST /auth/register` | JSON: `userId, name, email, password, role:'citizen', phone, address` |
| `createComplaint()` | `POST /complaints` | `multipart/form-data`, `Authorization: Bearer <token>` — **endpoint does not exist yet** |

Errors: a non-2xx response uses `data.detail` as the message. FastAPI returns
that as a string for `HTTPException` but as an array of per-field objects for
422 validation errors, so `readError()` handles both. A `fetch` rejection is
reported as "Cannot reach the server."

Session is stored in `localStorage` under `token` and `user`. No refresh-token
handling and no 401 auto-logout yet.

#### Contract quirks worth knowing

These bit us once already — see [src/api/auth.js](src/api/auth.js):

- Routes are at the **root**, not under `/api`.
- Login returns only `{ access_token, token_type }` — **no user object**. The
  signed-in user's identity is decoded from the JWT payload (`sub`, `userId`,
  `role`) client-side. That is display/routing data only; the backend
  re-verifies the signature on every request.
- `UserRegister` requires a `userId` even though the endpoint generates its own
  UUID and discards what you send. Omitting it is a 422.
- Backend roles are SQLAlchemy polymorphic identities — `citizen`, `officer`,
  `field_worker`, `administrator`. Two of those differ from the UI slugs
  (`municipal_officer`, `admin`), so `normalizeRole()` in
  [src/config.js](src/config.js) translates at the API boundary. Keep that
  translation there; the rest of the app should only ever see UI slugs.

### Still mocked

Everything except login and register reads from `src/data/mock*.js`. Each mock
file carries a `TODO(raja-api)` comment naming the endpoint it should become.

- Citizen dashboard stats, recent complaints, category donut
- My Complaints list (filters/search run client-side over the mock array)
- Complaint details — timeline, resolution evidence, feedback
- Notifications feed; read state is local-only and resets on reload
- Nearby issues (the geo-query for duplicate avoidance)
- Officer queue — AI classification, duplicate candidates, worker assignment
- Worker tasks, availability, rating
- Admin stats, complaints-over-time chart, top categories, recent users

Two things are mocked in a way that is easy to mistake for real:

- The **AI Prediction** block on Report Issue. Category and severity come from a
  hardcoded map in `ReportIssue.jsx` and "Confidence: 92%" is a literal string —
  there is no classifier call.
- **Photos.** `PhotoTile` renders a styled placeholder, never an `<img>`. This is
  deliberate: no remote image URLs, so the UI works offline and in a build. Swap
  its body for `<img src={url}>` when the backend serves media.

Officer actions (override, merge, assign, close) mutate local component state
and raise a confirmation banner. Nothing persists across a reload.

### Open questions for the backend

- `POST /complaints` does not exist yet. Once it does: the exact multipart field
  name for the image, and whether `category` is a slug (`pothole`) or a
  `categoryId`.
- `StatusEnum` is currently `PENDING | ASSIGNED | RESOLVED | REJECTED`. The UI
  lifecycle also needs **In Progress** and **Closed** — the officer queue relies
  on `Resolved` → `Closed` to model "evidence verified".
- Endpoints for the list/detail/stats data currently served from `src/data/`.
- Whether AI category/severity prediction is a separate endpoint or comes back
  on the create response, and whether duplicate detection is exposed as a list
  of candidate ids with similarity scores (which is what the UI renders).

---

## Notes

- Report Issue accepts JPG/PNG up to 5MB, supports drag & drop, and uses the
  browser Geolocation API for "Use Current Location" (needs `localhost` or
  HTTPS — it silently fails on plain HTTP origins).
- Object URLs for the image preview are revoked on replace/remove.
- All layouts are responsive; the sidebar collapses to a drawer below `lg`.
- Only citizens can self-register. Officers, workers, and admins are created by
  an admin on the backend.
- The officer complaint drawer closes on `Escape` or an overlay click and is
  marked `role="dialog"` / `aria-modal`, but focus is not trapped inside it yet.
- `npm test` is available (CRA + Testing Library are installed) but **no tests
  have been written yet**, and none of the screens have been verified in a
  browser — they are compile-checked only (`CI=true npm run build`, which
  promotes lint warnings to errors).

### If you are running this on Windows + WSL

The repo sits on a WSL path. Run npm from inside WSL, not from Windows:

```bash
wsl -d Ubuntu -- bash -lc "cd ~/MAY2026-Team-065/frontend && npm install"
```

Windows-side npm fails with `ERR_INVALID_URL` because it cannot use the
`\\wsl.localhost\...` UNC path as a working directory. Files copied in from
Windows also leave `*:Zone.Identifier` stubs behind; those are gitignored.
