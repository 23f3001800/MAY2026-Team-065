# SmartCivicConnect — Application Review

**Reviewer:** Vikas (code reviewer)
**Scope:** `develop` @ `9f28147`
**Date:** 2026-08-21

---

## 1. Verdict

Two sprints delivered and a v2 release cut. Against the original brief, the
application is **feature-complete across all four roles**: 63 API endpoints,
46 frontend routes, 15 database tables, an AI triage layer with two providers,
and a supporting services layer covering SLA tracking, officer routing, email,
PDF generation and notifications. The frontend compiles clean with lint warnings
promoted to errors.

The gap is not features. It is **verification**.

Five automated tests exist for 63 endpoints, and three of those five are written
so that they cannot fail. No CI runs on any pull request. One critical security
defect is open and known. No one has demonstrated the full stack running
end-to-end.

**The application is built. It is not proven.**

---

## 2. What is complete

### 2.1 Backend API — 63 endpoints

`backend/main.py` carries 44 route handlers; three routers add 19 more.

| Area | Count | Endpoints |
|---|---|---|
| **Auth** | 2 | `POST /auth/register`, `POST /auth/login` |
| **Complaints — core** | 6 | create, list, get by id, nearby, report slip, categories |
| **Complaints — lifecycle** | 8 | status, allowed-statuses, assign, severity, category, merge, images, feedback |
| **Complaints — bulk** | 3 | bulk-assign, bulk-status, escalations |
| **Workers** | 5 | create, list, availability, profile get/patch, task feed |
| **Citizens** | 2 | profile, password |
| **Admin** | 7 | analytics, users CRUD, official creation, SLA sweep, route-unassigned |
| **Health** | 2 | `/health`, `/health/ready` |
| **Password reset** | 1 | `PATCH /users/{userId}/reset-password` |
| **Analytics router** | 5 | overview, trends, categories, aging, resolution |
| **Notifications router** | 5 | inbox, unread-count, mark read, read-all, delete |
| **AI router** | 9 | health, categorize, severity, duplicates, triage, analyze-image, describe, assistant/query, per-complaint analyze |

### 2.2 Data model — 15 tables

Polymorphic user hierarchy (`users` to `citizens` / `municipal_officers` /
`field_workers` / `administrators`), plus `complaints`, `locations`,
`categories`, `media_attachments`, `status_histories`, `notifications`,
`feedbacks`, `ai_classification_logs`, `idempotency_keys`,
`password_reset_codes`.

`migrations.py` (386 lines) handles the PostgreSQL enum problem explicitly —
`create_all()` does not pick up new `StatusEnum` members, so it issues the
matching `ALTER TYPE ... ADD VALUE`. That is a real trap, correctly handled.

### 2.3 Complaint lifecycle — 10 states

Three phases, documented in `database.py`:

- **Intake & triage** — `PENDING`, `UNDER_REVIEW`
- **Action & dispatch** — `ASSIGNED`, `IN_PROGRESS`, `ON_HOLD`, `ESCALATED`
- **Closure & validation** — `RESOLVED`, `VERIFIED`, `REOPENED`, `REJECTED`

Transition rules live in `services/lifecycle.py`, and `GET
/complaints/{id}/allowed-statuses` exposes them to the UI rather than making the
frontend reimplement the state machine. Good separation.

### 2.4 Services layer — 9 modules, ~2,600 lines

| Module | Purpose |
|---|---|
| `lifecycle.py` | Who may move a complaint into which status |
| `notifications.py` | Creation, fan-out, inbox queries (572 lines — the largest) |
| `sla.py` | Alerts officers when a complaint overruns its resolution target |
| `routing.py` | Decides which officer owns a complaint |
| `password_reset.py` | Self-service reset by emailed verification code |
| `email.py` | Outbound email |
| `pdf.py` | One-page acknowledgement slip |
| `triage.py` | Glue between the database and the AI engine |
| `cache.py` | In-process cache plus HTTP validators |

### 2.5 AI layer — ~2,450 lines

Two providers (Gemini `gemini-2.5-flash`, Azure OpenAI `gpt-4o-mini`) behind a
common `provider.py` interface, plus `rules.py` — a 445-line deterministic rules
engine.

The design decision worth recording: **without `GEMINI_API_KEY` the rules engine
handles triage on its own**. The AI is an enhancement, not a hard dependency, so
the app degrades rather than breaks when a key is absent or a provider is down.

Capabilities: category classification, severity scoring, duplicate detection,
image analysis, description generation, and a grounded assistant.

### 2.6 Frontend — 46 routes, 27 pages, 47 components, ~17,000 lines

Build verified: `npm ci && CI=true npm run build` exits 0.

| Role | Routes | Pages |
|---|---|---|
| **Public** | 3 | Home (landing), Login, Register |
| **Citizen** | 11 | dashboard, report, my-complaints, complaint detail, track, nearby, notifications, AI assistant, feedback, profile, settings |
| **Officer** | 10 | dashboard, complaints queue, complaint view, escalations, verification, workers, analytics, notifications, profile, settings |
| **Admin** | 11 | dashboard, users, complaints, complaint detail, departments, categories, analytics, reports, notifications, profile, settings |
| **Field Worker** | 9 | dashboard, tasks, task detail, map, history, performance, notifications, profile, settings |

Thirteen API client modules under `src/api/` — including `client.js` (shared
fetch/error handling), `session.js`, `mappers.js` and `geocode.js`.

### 2.7 QA artifacts

- `qa_docs/` — Test Plan, Test Strategy, API Testing Checklist, Regression
  Checklist, Code Review Checklist
- `testing/postman/` — Postman collection, OpenAPI JSON, Swagger YAML
- `testing/reports/` — Newman and pytest HTML reports
- `testing/test_cases/API_Test_Cases.xlsx`
- `backend/openapi.yaml` generated by `generate_openapi.py`

### 2.8 Documentation

Root `README.md`, `CONTRIBUTING.md` (six-branch workflow), `backend/readme.md`,
`frontend/README.md`, `testing/pytest/README.md`.

---

## 3. Delivery history

52 pull requests merged. Two releases (`v1` at PR #28, `v2` at PR #46).

Broad arc: auth contract, complaints CRUD, authorization, AI triage,
notifications, analytics, lifecycle expansion, user management, evidence
verification, public pages redesign, health checks and department routing.

---

## 4. Verified vs assumed

Everything below was checked directly against `develop` for this report.

| Claim | Status |
|---|---|
| Frontend compiles | **Verified** — `CI=true npm run build`, exit 0 |
| 63 endpoints exist | **Verified** — decorator count in `main.py` + routers |
| 15 tables defined | **Verified** — `models.py` |
| AI degrades without a key | **Verified** — `ai/config.py`, rules engine is the fallback |
| Authorization on every endpoint | **Verified in Sprint 1** — `get_current_user` re-reads role from DB, not from the token |
| `SECRET_KEY` fallback removed | **False** — still present, `security.py:10` |
| Sprint 2 endpoints have test coverage | **False** — see R2 |
| Any endpoint returns correct data | **Unverified** — no test asserts on a response body |
| Full stack runs end-to-end | **Unverified** — never demonstrated |

---

## 5. Open risks, ranked

### R1 — CRITICAL: `SECRET_KEY` falls back to a hardcoded value (#23, open)

```python
# backend/security.py:10
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-for-dev")
```

The fallback string is public in this repository. Any deployment that starts
without `SECRET_KEY` set signs its JWTs with a key an attacker already has —
and the token payload carries `role`. Forging an `administrator` token is
trivial, and `get_current_user` would accept it because the signature validates.

It fails silently. There is no startup error, no log line — the app boots and
looks healthy.

`database.py` already models the correct pattern: it raises `RuntimeError` when
`DATABASE_URL` is missing. `SECRET_KEY` deserves the same treatment, and it is a
one-line change:

```python
SECRET_KEY = os.environ["SECRET_KEY"]
```

**This is the single highest-value fix in the codebase.**

### R2 — HIGH: the test suite cannot detect a failure

Five test functions for 63 endpoints. Their actual content:

| Test | What it asserts |
|---|---|
| `test_swagger_available` | `/docs` returns 200 |
| `test_openapi_available` | `/openapi.json` returns 200 |
| `test_admin_analytics_requires_auth` | status in `[200, 401, 403]` |
| `test_get_complaints_requires_auth` | status in `[200, 401, 403]` |
| `test_get_workers_requires_auth` | status in `[200, 401, 403]` |

The first two test that FastAPI serves its own documentation — they exercise no
application code and would pass against an empty app.

The other three are worse than useless. **A `200` means the endpoint served
admin analytics to an unauthenticated caller — a total auth bypass — and the
test passes.** A test that accepts both the correct and the catastrophic outcome
provides no signal while creating the appearance of coverage.

No test registers a user, logs in, files a complaint, or asserts on any response
body. Zero of the 63 endpoints have their behaviour verified.

### R3 — HIGH: nothing gates a pull request

`.github/workflows/` does not exist. 52 PRs have merged into `develop` with no
automated check of any kind. A PR that fails to import would merge.

The one gate that exists — `CI=true npm run build` catching lint errors — is
only ever run by hand, and only when someone remembers.

### R4 — MEDIUM: two issues closed as "completed" without the defect being fixed

- **#24** — "auth tests accept HTTP 200, so they cannot detect an auth bypass" —
  closed COMPLETED 2026-08-13. The assertion is still `in [200,401,403]`.
- **#43** — "Sprint 2's 34 new endpoints have no automated test coverage" —
  closed COMPLETED 2026-08-13. Coverage is still five tests.

Both defects are present in `develop` today. This matters more than either
individual bug: **the issue tracker currently overstates the health of the
project.** Anyone reading it would conclude test coverage was addressed. It was
not.

### R5 — MEDIUM: `GET /complaints/?sort=expectedResolution` truncates at 2000 rows (#44, open)

Silent truncation. Callers receive a partial result set with no indication it is
partial.

### R6 — MEDIUM: the full stack has never been run end-to-end

No screenshot, no terminal capture, no passing integration test demonstrates a
citizen registering, logging in, filing a complaint, an officer assigning it,
and a worker resolving it. Every subsystem is built; the seams between them are
untested.

This is the exact failure mode of issue #7, where two independently-approved
halves of the auth feature could not talk to each other. That was caught only
because someone read both sides by hand. The same class of defect across 63
endpoints would not be caught at all.

---

## 6. Recommendations

In priority order:

1. **Fix #23.** One line. Removes the only critical security defect.
2. **Rewrite the five tests so they can fail.** `assert r.status_code == 401`
   with no token, not `in [200,401,403]`. Thirty minutes of work that converts a
   decorative suite into a real one.
3. **Add one end-to-end integration test** — register, login, file complaint,
   assign, resolve. One test covering the seams is worth more than fifty
   endpoint tests.
4. **Add CI.** Two jobs: `python -c "import main"` and `CI=true npm run build`.
   No database, no secrets. Would have caught real defects across 52 PRs.
5. **Reopen #24 and #43**, or file replacements. The tracker should reflect
   reality.
6. **Fix #44.**

Items 1 to 4 are roughly a day of work and would move the project from "built"
to "demonstrably working".

---

## 7. Reproducing this review

```bash
# endpoint count
grep -cE '^@app\.(get|post|patch|put|delete)' backend/main.py        # 44
grep -rc '@router\.' backend/routers/                                # +19

# frontend build
cd frontend && npm ci && CI=true npm run build                       # exit 0

# test inventory
grep -rn "def test_" testing/pytest/                                 # 5

# CI check
ls .github/workflows/                                                # absent

# the critical defect
grep -n SECRET_KEY backend/security.py                               # line 10
```

---

## 8. Summary

| Dimension | Assessment |
|---|---|
| Feature completeness | **Strong** — all four roles, full lifecycle, AI, analytics |
| Architecture | **Strong** — services layer, lifecycle rules, provider abstraction, graceful AI degradation |
| Authorization design | **Strong** — server-side, role re-read from DB |
| Documentation | **Good** — README, CONTRIBUTING, QA docs, OpenAPI |
| Secrets handling | **Critical defect** — R1 |
| Test coverage | **Effectively zero** — R2 |
| CI / automation | **Absent** — R3 |
| Tracker accuracy | **Overstates health** — R4 |
| End-to-end proof | **None** — R6 |

The engineering is better than the process around it. What has been built is
substantial and well-structured. What is missing is the evidence that it works,
and one security fix that takes a single line.
