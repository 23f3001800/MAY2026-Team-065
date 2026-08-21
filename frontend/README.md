# SmartCivicConnect — Frontend

React single-page app for a civic complaint and resolution portal. Citizens
report street-level problems (potholes, garbage, water leakage, streetlights);
municipal officers triage, dispatch and sign off on the work; field workers do
it and file evidence; administrators run the city-wide view.

**This directory is the frontend only.** The FastAPI backend lives in
[`../backend`](../backend) and exposes ~50 paths across auth, complaints,
categories, workers, citizens, notifications, analytics, AI and admin. Every
screen in this app reads live data — there are no mocked dashboards. Where the
backend genuinely cannot answer something, the UI says so rather than inventing
a number.

---

## Contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment](#environment)
- [Project structure](#project-structure)
- [Routing and access control](#routing-and-access-control)
- [The API layer](#the-api-layer)
- [Endpoint map](#endpoint-map)
- [Feature subsystems](#feature-subsystems)
- [Design system](#design-system)
- [Code conventions](#code-conventions)
- [Known constraints](#known-constraints)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Tech stack

| | |
|---|---|
| Framework | React 19 (Create React App / `react-scripts` 5) |
| Routing | React Router v7 (`BrowserRouter`) |
| Styling | Tailwind CSS 3 + design tokens in `src/index.css` |
| Maps | Leaflet 1.9 (plain, not `react-leaflet`) + OpenStreetMap tiles |
| Icons | Inline SVG components — no icon library |
| Charts | Hand-rolled SVG primitives in `src/components/charts` |
| State | Local component state; `localStorage` for the session |
| Offline | IndexedDB, for the field-worker evidence upload queue |
| HTTP | `fetch` — no axios, no query library |
| Tests | CRA + Testing Library (installed; no component tests written yet) |

Fonts are Public Sans (body), Archivo (display) and IBM Plex Mono, loaded from
Google Fonts.

There is no TypeScript, no state-management library and no component library.
That is deliberate: the app is a few dozen screens over one REST API, and each
of those would be more machinery than it currently earns.

---

## Quick start

```bash
npm install
npm start          # http://localhost:3000
```

The backend must be running separately on `http://localhost:8000` (see
[`../backend`](../backend)) or the first request fails with *"Cannot reach the
server. Is the backend running?"*.

Production build:

```bash
npm run build              # outputs to build/
CI=true npm run build      # same, but lint warnings become errors — run this before pushing
```

Tests:

```bash
npm test
```

### Running on Windows + WSL

The repo lives on a WSL path. Run npm **from inside WSL**, not from Windows —
Windows-side npm fails with `ERR_INVALID_URL` because it cannot use a
`\\wsl.localhost\...` UNC path as a working directory.

```bash
wsl -d Ubuntu-24.04
cd ~/civic_service_portal/MAY2026-Team-065/frontend
npm install && CI=true npm run build
```

Node 20 is installed under nvm inside WSL and is not on the default login PATH.
If you get `node: command not found`, prepend it:

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

Files copied in from Windows leave `*Zone.Identifier` stubs behind. Those are
gitignored.

---

## Environment

One optional variable. Create `.env.local` in this directory if the backend is
not on the default host:

```
REACT_APP_API_URL=http://localhost:8000
```

- Default is `http://localhost:8000` — see [src/config.js](src/config.js).
- **No `/api` prefix.** FastAPI routes are mounted at the root (`/auth/login`,
  `/complaints/`, …).
- CRA only exposes variables prefixed `REACT_APP_`, and the value is baked in at
  build time — restart `npm start` after changing it.

Nothing else is configurable by environment. No API keys ship in the bundle: the
only third-party call (reverse geocoding) uses a keyless service, precisely so
there is no credential to leak.

---

## Project structure

```
src/
├── App.js                    # every route + the auth guard
├── config.js                 # API_BASE_URL, ROLES, normalizeRole()
├── index.css                 # Tailwind directives, CSS custom properties, utilities
│
├── api/                      # one module per backend area; nothing else calls fetch
│   ├── client.js             # apiRequest(): bearer token, error shapes, 401 handling
│   ├── session.js            # localStorage token/user, homePathForRole, complaintPath
│   ├── mappers.js            # wire format <-> UI shapes; status/severity vocabulary
│   ├── auth.js               # login, register, JWT payload decode
│   ├── complaints.js         # CRUD, assign, status, media, history, feedback, escalations
│   ├── categories.js         # GET /categories (+ static fallback)
│   ├── workers.js            # roster, availability, own profile
│   ├── citizens.js           # self-service profile and password
│   ├── notifications.js      # inbox, unread count, read/read-all, delete
│   ├── analytics.js          # server-side aggregates
│   ├── admin.js              # users, officials, reset password, SLA sweep
│   ├── ai.js                 # categorize, severity, duplicates, triage, vision, assistant
│   └── geocode.js            # OpenStreetMap Nominatim — the one non-backend call
│
├── hooks/
│   ├── useAsync.js           # load / error / refetch for page data
│   ├── useCategories.js      # categories fetched once, shared via a module-level promise
│   └── useCountUp.js         # animated counters, honouring prefers-reduced-motion
│
├── layouts/                  # one shell per role: sidebar + topbar + <Outlet/>
│   └── CitizenLayout · OfficerLayout · WorkerLayout · AdminLayout
│
├── pages/
│   ├── Home.jsx  Login.jsx  Register.jsx          # public
│   ├── CitizenDashboard.jsx  ReportIssue.jsx  Complaints.jsx
│   ├── ComplaintDetails.jsx  Notifications.jsx  Feedback.jsx  AIAssistant.jsx
│   ├── shared/               # ComplaintQueue (officer + admin), Profile
│   ├── officer/              # Dashboard, Complaints, ComplaintView, Verification,
│   │                         # Escalations, Workers
│   ├── worker/               # Dashboard, Tasks, TaskDetail, Performance, Profile
│   └── admin/                # Dashboard, Users, Complaints, Reports
│
├── components/
│   ├── auth/                 # AuthShell, AuthScene, controls — the signed-out screens
│   ├── public/               # CivicMark, JourneyStrip — landing page pieces
│   ├── dashboard/            # Sidebar, Topbar, NotificationBell, badges, StatCard/Tile,
│   │                         # AsyncStates, Skeleton, Toast, PhotoGrid, EvidencePanel,
│   │                         # FeedbackPanel, ConfidenceBadge, SlaBadge, ReportSlipModal
│   ├── charts/               # bar / line / donut primitives, one shared palette
│   ├── metrics/              # MetricCard, OperationsBrief, Provenance
│   ├── map/                  # ComplaintMap, ComplaintHeatMap, pin.js
│   ├── ai/                   # AssistantWidget (floating, all roles)
│   ├── officer/              # officerNav, ComplaintDrawer, AiVerificationPanel
│   ├── worker/               # workerNav, PendingUploads
│   ├── admin/                # adminNav, Modal, Create*/Edit*/ResetPassword modals,
│   │                         # SkillPicker, SlaSweepPanel, formFields
│   └── icons.jsx             # shared inline SVG icon set
│
├── lib/                      # pure logic, no React
│   ├── complaintMetrics.js   # every derived operations metric, in one place
│   ├── duration.js           # turnaround formatting
│   ├── evidence.js           # splitting photos into before / after
│   ├── imageDiff.js          # dHash similarity between two photos
│   ├── resolutionReport.js   # honest average resolution time, from history
│   ├── skills.js             # worker skill vocabulary, derived from categories
│   └── uploadQueue.js        # IndexedDB-backed retrying evidence upload
│
└── data/filters.js           # filter vocabulary for the list screens
```

`docs/` holds two longer references:
[API_INTEGRATION.md](docs/API_INTEGRATION.md) (what the frontend calls and what
it gets back) and [BACKEND_REQUESTS.md](docs/BACKEND_REQUESTS.md) (what the
frontend still needs from the API).

---

## Routing and access control

Everything except `/`, `/login` and `/register` sits behind `RequireAuth` in
[src/App.js](src/App.js). It redirects signed-out visitors to `/login`, and
sends a signed-in user who wanders into another role's area back to their own
home. Unknown paths go to the role's home, or `/` when signed out.

> This is a **UX guard, not a security boundary.** It reads the role out of
> `localStorage`. The backend re-verifies the JWT and authorizes every endpoint;
> nothing here is load-bearing for security.

Roles: `citizen`, `municipal_officer`, `field_worker`, `admin`. Only citizens
can self-register — the other three are provisioned by an administrator.

| Role | Home | Routes |
|---|---|---|
| Public | `/` | `/` (landing; a signed-in visitor is sent to their dashboard), `/login`, `/register` |
| Citizen | `/dashboard` | `/dashboard`, `/report`, `/complaints`, `/complaints/:id`, `/notifications`, `/feedback`, `/ai-assistant`, `/profile` |
| Officer | `/officer/dashboard` | `/officer/dashboard`, `/officer/complaints`, `/officer/complaints/:id`, `/officer/verification`, `/officer/escalations`, `/officer/workers`, `/officer/notifications`, `/officer/profile` |
| Worker | `/worker/dashboard` | `/worker/dashboard`, `/worker/tasks`, `/worker/tasks/:id`, `/worker/performance`, `/worker/notifications`, `/worker/profile` |
| Admin | `/admin/dashboard` | `/admin/dashboard`, `/admin/users`, `/admin/complaints`, `/admin/complaints/:id`, `/admin/reports`, `/admin/notifications`, `/admin/profile` |

Several older paths are kept as redirects rather than 404s, because they were
linked from elsewhere: `/my-complaints`, `/track` and `/nearby` all fold into
`/complaints`; `/settings` into `/profile`; `/worker/map` and `/worker/history`
into `/worker/tasks`; `/officer/analytics`, `/admin/analytics`,
`/admin/departments` and `/admin/categories` into their dashboards.

**The same complaint detail screen is mounted under three prefixes** so it
renders inside the right layout and passes the right guard. Never link to a bare
`/complaints/:id` from an officer or admin surface — use
`complaintPath(role, id)` from [src/api/session.js](src/api/session.js).

Sidebar contents are plain arrays: `Sidebar.jsx` (citizen), `officerNav.js`,
`workerNav.js`, `adminNav.js`. Adding a screen means adding a nav entry there
and a route in `App.js`.

---

## The API layer

Pages never call `fetch` directly. Everything goes through
[src/api/client.js](src/api/client.js), which:

- attaches `Authorization: Bearer <token>` unless `auth: false`;
- picks the encoding from the body type — `FormData` (no `Content-Type`, so the
  browser sets its own multipart boundary), `URLSearchParams`
  (form-urlencoded), anything else JSON;
- appends `params` as a query string, skipping `null` / `undefined` / `''`;
- normalises FastAPI's two error shapes — `detail` as a string for
  `HTTPException`, and as an array of per-field objects for 422 — into one
  message;
- turns a network failure into *"Cannot reach the server"* rather than a raw
  `TypeError`;
- on **401**, clears the session and hard-redirects to `/login?expired=1`, then
  throws `SessionExpiredError`. Pages generally do not catch it; the redirect
  has already happened. A full page load is used rather than a router navigate
  because a 401 can fire from outside a Router context, and a reload guarantees
  no stale authenticated state survives.

### Session

`localStorage`, under `token` and `user`. There is no refresh token.

Login returns only `{ access_token, token_type }` — **no user object** — so the
signed-in identity is decoded from the JWT payload (`sub`, `userId`, `role`) in
[src/api/auth.js](src/api/auth.js). That is display and routing data only; the
backend re-verifies the signature on every request, so a tampered payload buys
nothing.

### Mappers

[src/api/mappers.js](src/api/mappers.js) is the only place that knows the wire
format. No page ever sees a `SCREAMING_CASE` enum or a raw `categoryId`.

The complaint lifecycle runs to ten states across three phases:

```
intake & triage        New · Under Review · Assigned
action & dispatch      In Progress · On Hold · Escalated
closure & validation   Resolved · Verified · Reopened · Rejected
```

All ten round-trip — none are display-only. `TERMINAL_STATUSES` is
`['Verified', 'Rejected']`. `statusesSettableBy(role)` mirrors the backend's
`services/lifecycle.py`: citizens may set **Verified** or **Reopened**; workers
may set **In Progress / On Hold / Resolved / Escalated**; officers and admins
may set anything. Offering an option the backend will 403 on is worse than
hiding it — the user picks it, waits, and gets a permission error for something
they were shown.

---

## Endpoint map

Base URL from `REACT_APP_API_URL`. Collection endpoints need the **trailing
slash** (`/complaints/`, `/workers/`).

### Auth

| Call | Endpoint |
|---|---|
| Sign in | `POST /auth/login` — **form-urlencoded**, `username` is the email |
| Register (citizen only) | `POST /auth/register` |

### Complaints

| Call | Endpoint |
|---|---|
| File a complaint | `POST /complaints/` then `POST /complaints/{id}/image` |
| List (citizen sees own; officer/admin see all) | `GET /complaints/` — `sort`, `order`, `aiConfidenceMin/Max`, `limit`, `offset` |
| One complaint | `GET /complaints/{id}` |
| Audit trail | `GET /complaints/{id}/history` |
| Photos | `GET /complaints/{id}/media`, `POST /complaints/{id}/images` |
| Nearby | `GET /complaints/nearby?latitude&longitude&radius_km` |
| Worker's own tasks | `GET /complaints/worker/tasks` — `sort=distance&lat&lng` for nearest-first |
| Assign / bulk assign | `PATCH /complaints/{id}/assign`, `POST /complaints/bulk-assign` |
| Status, category, severity | `PATCH /complaints/{id}/status` · `/category` · `/severity` |
| Merge a duplicate | `PATCH /complaints/{id}/merge` |
| Overdue list | `GET /complaints/escalations` |
| Acknowledgement slip | `GET /complaints/{id}/report-slip` |
| Feedback | `GET` and `POST /complaints/{id}/feedback` |

### Reference data, people, notifications

| Call | Endpoint |
|---|---|
| Categories | `GET /categories` |
| Worker roster | `GET /workers/?skillSet=` |
| Create a worker | `POST /workers/` |
| Worker's own profile / availability | `GET`, `PATCH /workers/me/profile`; `PATCH /workers/me/availability` |
| Citizen's own profile / password | `PATCH /citizens/me/profile`, `PATCH /citizens/me/password` |
| Inbox | `GET /notifications/me`, `GET /notifications/me/unread-count` |
| Read state | `PATCH /notifications/{id}/read`, `POST /notifications/me/read-all`, `DELETE /notifications/{id}` |

### Analytics and admin

| Call | Endpoint |
|---|---|
| Server-side aggregates | `GET /analytics/overview`, `/trends`, `/categories`, `/aging`, `/resolution` |
| Admin summary | `GET /admin/analytics` |
| User management | `GET /admin/users`, `POST /admin/users/official`, `PATCH` / `DELETE /admin/users/{id}` |
| Reset a password | `PATCH /users/{id}/reset-password` |
| SLA breach sweep | `POST /admin/sla/sweep` |

### AI

| Call | Endpoint |
|---|---|
| Availability probe | `GET /ai/health` |
| Classify / rate / describe | `POST /ai/categorize`, `/ai/severity`, `/ai/describe` |
| Duplicate detection | `POST /ai/duplicates` |
| Full triage | `POST /ai/triage`, `POST /ai/complaints/{id}/analyze` |
| Vision | `POST /ai/analyze-image` |
| Assistant | `POST /ai/assistant/query` |

---

## Feature subsystems

### Filing a complaint

`POST /complaints/` requires real latitude/longitude **and** a non-null address,
so [ReportIssue](src/pages/ReportIssue.jsx) asks for browser geolocation on
mount and blocks submit until it has both. Photos are a **second, separate
request** against the new complaint id, so they can fail after the complaint
itself is safely saved — the form reports that partial success honestly rather
than claiming everything worked.

Geolocation needs a secure origin. It works on `localhost` and over HTTPS, and
silently fails on a plain-HTTP origin.

### Reverse geocoding

[src/api/geocode.js](src/api/geocode.js) calls OpenStreetMap Nominatim directly
— the backend has no geocoding endpoint, and every alternative would mean
shipping an API key in a public bundle. Two rules for callers: Nominatim's usage
policy is roughly one request per second, so never call it on a timer or per
keystroke; and every failure resolves to `null` instead of throwing, with the
address field left editable so a citizen can always type it themselves. It
deliberately bypasses `client.js` — attaching our bearer token to a third-party
host would leak the session.

### AI

Advisory everywhere, never automatic. On the report form the model drafts a
description, suggests a category and severity, and warns about likely
duplicates; nothing it produces is submitted unless the citizen accepts it.
Officer surfaces show an AI confidence badge and can triage a low-confidence
queue. [AssistantWidget](src/components/ai/AssistantWidget.jsx) floats on every
authenticated screen for all four roles — the backend scopes answers to the
caller's own data, so the frontend sends the question and nothing else. Answers
carry `citations` (the complaint ids the answer was grounded in) and a `source`,
both surfaced on purpose: an answer you can trace beats a confident-sounding one
you cannot.

Natural-language answers need a model key configured server-side. Without one
the endpoint reports itself unavailable and the UI treats that as a normal
state, not an error.

### Evidence and verification

Photos are split into *before* and *after* by
[src/lib/evidence.js](src/lib/evidence.js). This deliberately does **not** key
off the transition into `RESOLVED`: the worker screen uploads photos first and
moves the status second — so that a failed upload is recoverable — which filed
every completion photo under "before" when the split worked that way.

[AiVerificationPanel](src/components/officer/AiVerificationPanel.jsx) re-runs
vision on the completion photo and compares what the model sees *now* against
what the complaint said the problem was. A raw before/after similarity score
cannot answer "is it fixed?", because both ends are ambiguous — very similar
means nothing changed *or* a small fix shot from the same angle; very different
means the problem is gone *or* it is a photo of somewhere else. The dHash number
from [src/lib/imageDiff.js](src/lib/imageDiff.js) is shown as a supporting
signal only.

### Offline evidence uploads

[src/lib/uploadQueue.js](src/lib/uploadQueue.js) keeps a failed upload instead of
discarding it, and retries when the connection returns. It uses **IndexedDB**,
not `localStorage`, because photos are Blobs. Uploads carry an idempotency key
so a retry cannot double-file.
[PendingUploads](src/components/worker/PendingUploads.jsx) renders what has not
reached the server yet, and nothing at all when the queue is empty — silence
must not look identical to success.

### Maps

Plain Leaflet, not `react-leaflet`: one dependency instead of two, and no
coupling to a wrapper's React-version support. Markers are `divIcon`s built from
our own markup rather than Leaflet's default PNG, which sidesteps the
broken-marker-path problem under bundlers and lets a pin carry severity by
colour. `ComplaintHeatMap` is the density view for officers and admins.

### Notifications

One [NotificationBell](src/components/dashboard/NotificationBell.jsx) in the top
bar serves all four roles — `/notifications/me` resolves the recipient from an
explicit `recipientId`, so officers, workers and admins receive notifications
too. Read state is written through (`PATCH .../read`, `POST .../read-all`),
applied optimistically and rolled back if the write fails.

### SLA and escalation

[OfficerEscalations](src/pages/officer/OfficerEscalations.jsx) reads
`GET /complaints/escalations`, a server aggregate using the same severity
targets as the sweep: **4h Critical, 24h High, 72h Medium, 168h Low**. It is
deliberately not date-filtered — an eight-month-old complaint that is still open
is exactly what the page exists to surface.

[SlaSweepPanel](src/components/admin/SlaSweepPanel.jsx) triggers
`POST /admin/sla/sweep`. **Nothing schedules this.** Breaches are only found
when an admin presses the button, and the panel says so, so nobody assumes
officers are being alerted automatically.

### Provenance

[Provenance](src/components/metrics/Provenance.jsx) labels every figure as one
of three things, and they are not interchangeable:

| Level | Meaning |
|---|---|
| **verified** | Counted from records the backend returned. Reproducible. |
| **derived** | Aggregated in the browser from the full record set — still real and still reproducible, but not a server-side aggregate. |
| **ai** | A model's interpretation. Never presented as a number of its own. |

The whole trust argument of the product rests on a reader being able to tell a
counted fact from a machine's opinion. Keep using it.

### Reports

[AdminReports](src/pages/admin/AdminReports.jsx) filters the complaint list and
exports CSV in the browser.
[src/lib/resolutionReport.js](src/lib/resolutionReport.js) computes average
resolution time by walking `GET /complaints/{id}/history` per complaint and
reading the actual transition into `RESOLVED` — one request per resolved
complaint, which is why it is an on-demand report and not a dashboard tile.
[ReportSlipModal](src/components/dashboard/ReportSlipModal.jsx) renders the
citizen's acknowledgement slip; every nested block is rendered defensively,
because `aiAssessment` comes back all-null on complaints that predate triage.

---

## Design system

Two visual modes:

- **Signed out** — `components/auth/*` and the landing page. Warm paper ground,
  civic navy, strong left-aligned type. Built to read like a well-made public
  notice rather than a startup splash: what is being asked of a visitor here is
  to trust a municipal service with a report about their street.
- **Signed in** — dark sidebar, light content area, one shell per role.

Colours, spacing, shadows and animations live in
[tailwind.config.js](tailwind.config.js), backed by CSS custom properties in
[src/index.css](src/index.css). **Reach for the semantic tokens, not raw hex or
`slate-*`:**

| Token | For |
|---|---|
| `surface`, `surface-sunken`, `surface-raised`, `surface-inset` | backgrounds |
| `line`, `line-strong` | borders and rules |
| `ink`, `ink-body`, `ink-muted`, `ink-faint` | text |
| `civic-*` | the primary navy anchor |
| `teal-*`, `caution-*`, `danger-*` | status and severity |

The shadow scale deliberately **overrides** Tailwind's defaults, so redefining
`shadow-sm` lifts every existing card at once. Each step is two layers — a tight
contact shadow plus a soft ambient one — which is what stops a card looking like
a flat outlined box.

Motion is short and small; a long slide reads as lag. `useCountUp` and the
shimmer skeletons honour `prefers-reduced-motion`.

Charts use one categorical palette, ordered so adjacent series stay
distinguishable in greyscale. Every value is labelled — a bar you cannot read
the number off is decoration, and this is an operations tool. Empty is an
explicit state, never an empty box.

---

## Code conventions

- **`.jsx` renders UI. `.js` is logic, data or config.** `src/lib/*` is pure and
  imports no React.
- **Only `src/api/*` talks to the network.** A page that needs data calls an api
  module through `useAsync`.
- **Derived metrics belong in
  [src/lib/complaintMetrics.js](src/lib/complaintMetrics.js)**, not in a
  component, so "resolution rate" has exactly one definition in the app and can
  be read and checked without opening a page.
- **Never invent a figure.** If the backend cannot answer, render the
  unavailable state
  ([UnavailableNote](src/components/dashboard/UnavailableNote.jsx)) or label the
  number's provenance.
- **Four async states, always:** loading, error, empty, content — see
  [AsyncStates.jsx](src/components/dashboard/AsyncStates.jsx) and
  [Skeleton.jsx](src/components/dashboard/Skeleton.jsx).
- Header comments explain *why* a screen is shaped the way it is, including what
  it used to be and why that failed. Keep the habit; it is most of the design
  rationale this repo has.

---

## Known constraints

Things that are true of the current backend and shape the UI. Check here before
"fixing" one of them in the frontend.

| Constraint | Consequence |
|---|---|
| Login returns no user object | Identity is decoded from the JWT payload |
| `UserRegister` requires a `userId` the backend then discards | Sent anyway — omitting it is a 422 |
| Backend roles are SQLAlchemy polymorphic identities (`officer`, `administrator`) | `normalizeRole()` translates at the API boundary |
| Assignment matches the category's **department as a substring of the worker's `skillSet`** | A worker skilled in "Plumbing" cannot take a "Water & Plumbing" complaint. [SkillPicker](src/components/admin/SkillPicker.jsx) and [src/lib/skills.js](src/lib/skills.js) offer only spellings derived from real categories, and the assignment drawer pre-checks the match so the officer sees a reason instead of a 400 |
| `POST /complaints/` is JSON only | The photo is a second request; partial success is a real outcome the form has to report |
| `/complaints/nearby` returns no distance | Computed client-side with a haversine |
| `GET /complaints/` has no filter or search parameters | Filtering, search and sorting in the queue are client-side |
| No geocoding endpoint | Nominatim: keyless, third-party, best-effort |
| No image-comparison endpoint | dHash in the browser, presented as a signal and not a verdict |
| Nothing schedules the SLA sweep | Manual trigger, and the panel says so |
| No refresh token | A 401 ends the session; `/login?expired=1` explains why |

`CATEGORIES` in `mappers.js` is now a **fallback only** — `useCategories`
fetches the real list from `GET /categories`. Keep it roughly in step with
`backend/seed.py` so the fallback stays sane, but it is no longer the source of
truth.

---

## Verification

- `CI=true npm run build` compiles clean — lint warnings are promoted to errors,
  so this is the gate to run before pushing.
- `npm test` is wired up (CRA + Testing Library) but no component tests have been
  written yet. Adding some for `src/lib/*` is the cheapest first win: it is pure,
  and it is where the arithmetic lives.
- Full in-browser click-through of every screen has not been automated. A manual
  pass per role is still worth doing before shipping.

---

## Troubleshooting

**"Cannot reach the server. Is the backend running?"** — `fetch` only rejects on
network failure: the backend is down, CORS is blocking, or `REACT_APP_API_URL`
points somewhere wrong.

**Signed out immediately after signing in** — a 401 anywhere clears the session
and redirects. Check that a token is actually being issued, and that clock skew
between client and server has not expired it on arrival.

**A 422 on register** — most often the discarded-but-required `userId`, or a
field the backend validates more strictly than the form does. The message is
already flattened to `field: message` by `readError()`.

**Assignment rejected with no obvious reason** — the department / `skillSet`
substring match. Compare the exact strings.

**Location never resolves** — geolocation needs `localhost` or HTTPS. On a plain
HTTP origin it fails silently.

**`ERR_INVALID_URL` from npm** — you are running Windows-side npm against the WSL
UNC path. Run it inside WSL instead; see [Quick start](#quick-start).

**Blank map or missing pins** — check that `leaflet/dist/leaflet.css` is still
imported by the map component. Pins are `divIcon`s, so a missing default marker
PNG is not the cause.
