# SmartCivicConnect — Frontend

React frontend for a civic complaint & resolution portal. Citizens report issues
(potholes, garbage, water leakage, streetlights); officers assign them to field
workers; admins oversee everything.

**This directory is the frontend only.** The FastAPI backend is in
[`../backend`](../backend), which now exposes 21 routes across auth, complaints,
workers, notifications, and admin. Every route in the app renders real data —
there are no more mocked dashboards and no more `<Placeholder />` screens. See
[Backend integration](#backend-integration) for what each screen calls and the
handful of things the backend still can't do.

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
production build.

**It only gets you as far as the layout now.** The fabricated token is not a
real JWT, so every data call behind it returns 401 and the client will bounce
you back to `/login`. Use it to look at chrome and navigation; use a real
seeded account (`admin@city.gov` / `admin123`, see `backend/seed.py`) to
exercise anything that loads data.

---

## Project structure

```
src/
├── App.js                  # all routes + auth guard
├── config.js               # API_BASE_URL, ROLES
├── index.css               # Tailwind directives + custom utilities
│
├── api/
│   ├── client.js           # authenticated fetch, error + 401 handling
│   ├── session.js          # localStorage token/user helpers
│   ├── mappers.js          # wire format <-> UI shapes, category table, user shape
│   ├── auth.js             # login / register
│   ├── complaints.js       # create, list, detail, assign, status, feedback
│   ├── workers.js          # field worker list + availability + create
│   ├── admin.js            # analytics, user search, officer creation, suspend, reset password
│   ├── notifications.js    # citizen inbox
│   └── devPreview.js       # DEV ONLY — fake login per role
│
├── hooks/
│   └── useAsync.js         # load / error / refetch for page data
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
│   ├── TrackComplaints.jsx  Feedback.jsx  AIAssistant.jsx
│   ├── shared/              # Profile, Settings, RoleActivity, ComplaintQueue —
│   │                        # reused across two or more roles
│   ├── officer/             # Dashboard, Complaints, Workers, Analytics
│   ├── worker/              # Dashboard, Tasks, Map, History, Profile
│   └── admin/               # Dashboard, Users, Complaints, Departments,
│                            # Categories, Analytics, Reports, Settings
│
├── components/
│   ├── AuthBackground.jsx AuthCard.jsx BrandPane.jsx formControls.jsx icons.jsx
│   ├── dashboard/          # Sidebar, Topbar, StatCard/Tile, badges, PhotoTile,
│   │                       # AsyncStates (Loading/Error/Empty), UnavailableNote, icons
│   ├── officer/             # officerNav.js + ComplaintDrawer.jsx (shared with admin)
│   ├── worker/              # workerNav.js + TaskDrawer.jsx
│   └── admin/                # adminNav.js, Modal.jsx, Create*Modal.jsx, ResetPasswordModal.jsx,
│                            # AdminStatCard, BarList, LineChart
│
└── data/
    └── filters.js          # filter vocabulary for the list screens (no mock data left)
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
`/track`, `/nearby`, `/notifications`, `/feedback`, `/ai-assistant`,
`/profile`, `/settings`

**Officer** — `/officer/dashboard`, `/officer/complaints`, `/officer/workers`,
`/officer/analytics`, `/officer/notifications`, `/officer/profile`,
`/officer/settings`

**Worker** — `/worker/dashboard`, `/worker/tasks`, `/worker/map`,
`/worker/history`, `/worker/notifications`, `/worker/profile`,
`/worker/settings`

**Admin** — `/admin/dashboard`, `/admin/users`, `/admin/complaints`,
`/admin/departments`, `/admin/categories`, `/admin/analytics`,
`/admin/reports`, `/admin/settings`

Every one of the above reads real data from the backend or, where the backend
genuinely has nothing to offer (AI Assistant, officer/worker "notifications",
profile editing), says so plainly instead of inventing content — see
[Gaps the UI has to work around](#gaps-the-ui-has-to-work-around).

---

## Backend integration

### Wired up

Every call goes through [src/api/client.js](src/api/client.js), which attaches
the bearer token, normalises errors, and turns a 401 into a session clear plus a
redirect to `/login?expired=1`.

| UI | Endpoint |
|---|---|
| Login | `POST /auth/login` — **form-urlencoded**, `username` is the email |
| Register | `POST /auth/register` |
| Report Issue | `POST /complaints/` then `POST /complaints/{id}/image` |
| My Complaints, Track Complaints | `GET /complaints/` |
| Complaint Details | `GET /complaints/{id}` |
| Feedback (per-complaint and the standalone page) | `POST /complaints/{id}/feedback` |
| Notifications (citizen) | `GET /notifications/me` |
| Nearby Issues | `GET /complaints/nearby?latitude&longitude&radius_km` |
| Citizen Dashboard | `GET /complaints/` (stats, recent list, category split all computed client-side) |
| Officer/Admin Complaint Queue (shared `ComplaintQueue`) | `GET /complaints/`, `GET /workers/` |
| Officer/Admin actions | `PATCH /complaints/{id}/assign`, `/status`, `/category` |
| Officer Dashboard | `GET /complaints/`, `GET /workers/` |
| Officer Field Workers | `GET /workers/` |
| Officer Analytics | `GET /complaints/` (breakdowns computed client-side — `/admin/analytics` is admin-only) |
| Worker Dashboard, Tasks, History, Map | `GET /complaints/worker/tasks` |
| Worker status updates | `PATCH /complaints/{id}/status` |
| Worker Profile / availability | `PATCH /workers/me/availability` |
| Admin Dashboard | `GET /admin/analytics`, `GET /complaints/`, `GET /admin/users` |
| Admin Users | `GET /admin/users`, `POST /admin/users/official`, `POST /workers/`, `PATCH /admin/users/{id}`, `PATCH /users/{id}/reset-password` |
| Admin Departments, Categories, Reports | `GET /complaints/`, `GET /admin/users`, `GET /workers/` (all rolled up client-side — neither entity exists on the backend) |
| Admin Settings (self password change) | `PATCH /users/{id}/reset-password`, called with the admin's own `userId` |
| Officer/Worker "Notifications" | Not a real feed — see [Gaps](#gaps-the-ui-has-to-work-around) |

Wire-format translation lives in [src/api/mappers.js](src/api/mappers.js) — no
page ever sees a `SCREAMING_CASE` enum or a raw `categoryId`.

Session is stored in `localStorage` under `token` and `user`. No refresh-token
handling.

#### Contract quirks worth knowing

- Routes are at the **root**, not under `/api`. Collection endpoints need the
  **trailing slash** (`/complaints/`, `/workers/`).
- Login returns only `{ access_token, token_type }` — **no user object**. The
  signed-in user's identity is decoded from the JWT payload (`sub`, `userId`,
  `role`). That is display/routing data only; the backend re-verifies the
  signature on every request.
- `UserRegister` requires a `userId` even though the endpoint generates its own
  UUID and discards what you send. Omitting it is a 422.
- Backend roles are SQLAlchemy polymorphic identities — `citizen`, `officer`,
  `field_worker`, `administrator`. Two differ from the UI slugs, so
  `normalizeRole()` in [src/config.js](src/config.js) translates at the boundary.
- **Creating a complaint needs real GPS coordinates.** `location.latitude` and
  `.longitude` are required floats, so Report Issue asks for browser location on
  mount and blocks submit without it.
- **The photo is a second request.** `POST /complaints/` is JSON only. The image
  goes to `/complaints/{id}/image` afterwards, as a field named `file`. They are
  not in one transaction, so the form reports a partial success when the
  complaint saves but the photo does not.
- **Assignment can fail on a string match.** The backend rejects an assignment
  unless the complaint category's `department` is a substring of the worker's
  `skillSet`. A worker skilled in `"Plumbing"` cannot take a
  `"Water & Plumbing"` complaint. The drawer pre-checks this so the officer sees
  a reason rather than a 400.
- **`POST /workers/` stores the password in plaintext.** `main.py`'s
  `create_field_worker` sets `passwordHash=worker.password` directly instead of
  hashing it — every field worker account created through this endpoint
  (including from Admin Users → Add Field Worker) gets a **500 on login**
  (`passlib.exc.UnknownHashError`), because passlib can't identify a plaintext
  string as a hash. Confirmed live against a running backend. This is a
  backend fix, not a frontend one — flagged here since it makes a feature this
  UI now exposes silently unusable until it's patched.
- **`SystemOfficialCreate` only implements `role: "municipal_officer"`.** The
  schema also accepts `"field_worker"`, but `create_system_official` has no
  branch for it — `new_user` stays `None` and the call 500s. The Admin Users
  page only ever sends `"municipal_officer"` to this endpoint and creates field
  workers through `POST /workers/` instead, which is the endpoint actually
  built for it.
- **Suspend and skill/department edits mostly don't persist.**
  `PATCH /admin/users/{id}` accepts `isActive`, `skills`, and `department`, and
  always returns `{"message": "User updated successfully"}`, but `UserModel`
  has no `isActive` column and `FieldWorkerModel` has neither `department` nor
  a `skills` column (only `skillSet`) — those writes just set a plain Python
  attribute that's never persisted. Only an officer's `department` is a real
  mapped column and actually saves. The Admin Users "Suspend" toggle calls the
  real endpoint and gets a real 200, but does not claim the account is
  actually locked out.
- **`ComplaintResponse` never returns `fieldWorkerId` or `officerId`.** There is
  no way to resolve "which worker is this assigned to" from any list or detail
  endpoint. The Officer Dashboard's old mock data showed a "Worker" column;
  that's gone now rather than showing an invented name.

### Gaps the UI has to work around

These are missing backend capability, not translation problems:

| Missing | Consequence in the UI |
|---|---|
| No `IN_PROGRESS` / `CLOSED` in `StatusEnum` | `toApiStatus()` returns null for them; they are display-only and can never be sent |
| No `GET /categories` | `CATEGORIES` in `mappers.js` is a hardcoded mirror of `backend/seed.py` — **edit both together**. Admin Categories/Departments read from this same mirror |
| No status-history endpoint | Complaint details and Track Complaints show only reported/current-status, not the path in between |
| No media read endpoint | Uploaded photos cannot be displayed back; `PhotoTile` stays a styled placeholder |
| No feedback read endpoint | A rating cannot be shown after reload; the Feedback page tracks "already rated" for the current session only |
| No mark-notification-read endpoint | Read state is client-side and resets on reload |
| No AI classification or duplicate detection | Those panels/pages say "not available" instead of showing invented confidence scores |
| No title field on a complaint | List views derive one from the first sentence of the description |
| `/complaints/nearby` returns no distance | Distance is computed client-side with a haversine from the returned coordinates |
| `GET /notifications/me` is citizen-only (403s officer/worker) | Their "Notifications" nav item goes to `RoleActivity` — the same complaint list re-sorted by last update, explicitly labelled as not a real feed |
| `GET /admin/analytics` is admin-only (403s officer) | Officer Analytics recomputes the same status/severity/category breakdown client-side from `GET /complaints/` |
| No Department entity | Admin Departments derives a department list from the category mirror and rolls up real counts from complaints/users/workers — not a managed list |
| No report-generation endpoint | Admin Reports filters `GET /complaints/` client-side and exports CSV in the browser |
| No self-service profile or password endpoint for non-admins | Profile page is read-only (decoded from the JWT); only Admin Settings has a working password change, because `PATCH /users/{id}/reset-password` only checks the caller is an administrator, not that the target is someone else |
| `POST /workers/` doesn't hash the password | See "Contract quirks" above — accounts it creates can't log in yet |

### Still mocked

Nothing. All four dashboards (citizen, officer, worker, admin) and every
sidebar route now read live data or explicitly say a capability doesn't exist
on the backend yet — no screen fabricates numbers.

### Open questions for the backend

- `StatusEnum` needs `IN_PROGRESS` and `CLOSED` for the lifecycle in the spec.
- Read endpoints for status history, media attachments and feedback — all three
  are stored but none can be fetched.
- `GET /categories`, so the frontend stops mirroring the seed file.
- `UserRegister.userId` is required but discarded; worth removing.
- Whether `skillSet` should become a structured list rather than a free-text
  string that assignment does a substring match against.
- **`POST /workers/` needs to hash the password** (`security.get_password_hash`,
  same as `register_user` and `create_system_official` already do) — currently
  a backend bug, not a frontend gap.
- **`create_system_official` needs a `field_worker` branch**, or the schema
  should stop advertising a role it can't create.
- **`ComplaintResponse` needs `fieldWorkerId`/`officerId`** if "who is this
  assigned to" is ever meant to show up in a list view.
- `PATCH /admin/users/{id}`'s `isActive`/`skills` writes need real columns to
  land on, or the schema should stop accepting fields it can't persist.

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
- `npm test` is available (CRA + Testing Library are installed) but no component
  tests have been written yet.
- **Verification status:** compile-checked (`CI=true npm run build`, which
  promotes lint warnings to errors) and the wire-format translation in
  `mappers.js` is covered by 41 assertions run against payloads shaped from
  `backend/schemas.py`. Every endpoint every page depends on has since been
  exercised end to end against a live backend (Postgres seeded, real accounts
  created per role, real login/complaint/assign/resolve/feedback/reset-password
  round trips) — see the "Contract quirks" and "Gaps" sections above for the
  two real backend bugs that turned up in the process. Full in-browser
  click-through has not been done in this environment (headless Chromium via
  Playwright needs Node 20+; this box has Node 18), so a manual pass through
  each screen is still worth doing before shipping.

### If you are running this on Windows + WSL

The repo sits on a WSL path. Run npm from inside WSL, not from Windows:

```bash
wsl -d Ubuntu -- bash -lc "cd ~/MAY2026-Team-065/frontend && npm install"
```

Windows-side npm fails with `ERR_INVALID_URL` because it cannot use the
`\\wsl.localhost\...` UNC path as a working directory. Files copied in from
Windows also leave `*:Zone.Identifier` stubs behind; those are gitignored.
