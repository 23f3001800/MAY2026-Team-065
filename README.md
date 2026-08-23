# SmartCivicConnect

A civic complaint portal. Citizens report local issues — potholes, garbage, water
leaks, broken streetlights — and municipal officers triage them, assign field
workers, and verify the fix before closing.

Built by **Team 065 (DevSync)**.

## Roles

| Role | Can do |
|---|---|
| **Citizen** | File complaints with photo and location, track status, verify or reopen the fix, rate it |
| **Municipal Officer** | Triage the queue, re-categorise, set severity, assign workers, merge duplicates |
| **Field Worker** | See assigned tasks, report progress, upload completion evidence |
| **Administrator** | Provision officers and workers, analytics, user management, password resets |

Only citizens self-register. Every other role is created by an administrator, who
can have the sign-in details emailed to them.

## Stack

FastAPI · SQLAlchemy 2 (async) · PostgreSQL · JWT — backend
React (CRA) · React Router · Tailwind · Leaflet — frontend
A deterministic rules engine for triage, with Gemini and OpenRouter optional on top.

## Run it

Needs Python 3.11+, Node 18+, and a local PostgreSQL.

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # edit it — see Configuration
createdb complaint_db
python seed.py                # categories + default admin, whose credentials it prints
uvicorn main:app --reload --port 8000

# frontend
cd frontend
npm ci && npm start
```

Backend on `:8000` (docs at `/docs`), frontend on `:3000`; point elsewhere with
`REACT_APP_API_URL`. The seeded admin password is development-only — change it.

## Configuration

All in `backend/.env`, documented in `.env.example`.

**Required** — the app refuses to start without these, deliberately:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@localhost:5432/complaint_db` |
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |

**Optional** — each has a working default; unset, the app just does less:

| Variable | What it turns on |
|---|---|
| `GEMINI_API_KEY`, `OPENROUTER_API_KEY` | LLM refinement. Without them the rules engine still triages everything |
| `SMTP_HOST` and friends | Outbound email. Without it, messages are logged instead of sent |
| `SLA_*_HOURS` | Resolution targets per severity — 4h / 24h / 3d / 7d |
| `AI_DUPLICATE_*` | Duplicate radius, time window, score thresholds |

## Worth knowing

- **Ten statuses**, three phases: intake → dispatch → closure. A move needs a
  legal transition (else 409) *and* the right role (else 403);
  `GET /complaints/{id}/allowed-statuses` says what a given user may do now.
- **Verifying and reopening belong to the citizen** — only they can confirm the
  problem is actually gone.
- **Routing** gives a new complaint to the officer in its department carrying the
  fewest open ones. A department with no officer leaves it unowned rather than
  handing it to someone who cannot act on it.
- **AI only ever raises severity**, never lowers it, and is skipped when the rules
  engine is already confident.
- **Duplicates** score text, distance and recency, plus an exact photo match.
  Nothing merges automatically below a high threshold.

## API conventions

Routes are at the **root** — `/auth/login`, not `/api/auth/login`.

`POST /auth/login` is OAuth2 password flow: **form-encoded** `username` (the
email) and `password`, returning a bearer token for every other call. Roles are
re-read per request, so a role change applies at once — the frontend's guards are
cosmetic, authorization is server-side.

`GET /health` is liveness; `GET /health/ready` checks the database and reports AI,
email and background jobs. Both unauthenticated, neither leaks configuration.

## Layout

```
backend/     main.py (routes), models, schemas, security
  ai/        triage engines — rules (default), gemini, openrouter
  routers/   analytics, notifications, AI endpoints
  services/  lifecycle, SLA, routing, email, cache, duplicates
frontend/    src/api (HTTP clients), src/pages, src/components
testing/     pytest suite, Postman collection, reports
qa_docs/     test plan, strategy, review checklists
```

## Tests

```bash
cd testing/pytest && pytest -v
```

Integration tests — they need a **live server**, so start the backend first.
`testing/postman/` has the equivalent collection.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Short version: six branches, no new ones,
work only on your own, PR into `develop`. Never push to `develop` or `main`.
