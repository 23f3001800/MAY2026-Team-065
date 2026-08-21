# SmartCivicConnect — Application Review

**Reviewer:** Vikas · **Scope:** `develop` @ `9f28147` · **Date:** 2026-08-21

---

## Verdict

The application is **feature-complete across all four roles** — 63 endpoints, 46
frontend routes, 15 tables, an AI triage layer, and a services layer covering
SLA, routing, email, PDF and notifications. Two sprints, 52 merged PRs, v2
released. The frontend compiles clean.

The gap is not features. It is verification.

Five tests cover 63 endpoints, three of which cannot fail. Nothing gates a PR.
One critical security defect is open.

**Built, not proven.**

---

## What is complete

### Backend — 63 endpoints

| Area | # |
|---|---|
| Auth | 2 |
| Complaints — core, lifecycle, bulk | 17 |
| Workers | 5 |
| Citizens | 2 |
| Admin | 7 |
| Health | 2 |
| Password reset | 1 |
| Analytics router | 5 |
| Notifications router | 5 |
| AI router | 9 |

**Data model** — 15 tables. Polymorphic user hierarchy plus complaints,
locations, categories, media, status history, notifications, feedback, AI logs,
idempotency keys, reset codes.

**Lifecycle** — 10 states in three phases: intake (`PENDING`, `UNDER_REVIEW`),
dispatch (`ASSIGNED`, `IN_PROGRESS`, `ON_HOLD`, `ESCALATED`), closure
(`RESOLVED`, `VERIFIED`, `REOPENED`, `REJECTED`). Rules live in
`services/lifecycle.py` and are exposed via `GET /complaints/{id}/allowed-statuses`,
so the UI does not reimplement the state machine.

**Services** — 9 modules, ~2,600 lines: lifecycle, notifications, SLA, routing,
password reset, email, PDF, triage, cache.

**AI** — ~2,450 lines. Gemini and Azure OpenAI behind one `provider.py`
interface, plus a 445-line deterministic rules engine. Without `GEMINI_API_KEY`
the rules engine handles triage alone, so the app degrades rather than breaks.
Covers classification, severity, duplicates, image analysis, and a grounded
assistant.

### Frontend — 46 routes, 27 pages, 47 components, ~17,000 lines

| Role | Routes |
|---|---|
| Public | 3 |
| Citizen | 11 |
| Officer | 10 |
| Admin | 11 |
| Field Worker | 9 |

Thirteen API clients under `src/api/`, including shared `client.js` and
`session.js`.

### QA artifacts

`qa_docs/` (test plan, strategy, checklists), Postman collection, OpenAPI spec,
Newman and pytest HTML reports, `API_Test_Cases.xlsx`.

---

## Verified vs assumed

| Claim | Status |
|---|---|
| Frontend compiles | **Verified** — `CI=true npm run build`, exit 0 |
| 63 endpoints, 15 tables | **Verified** — counted in source |
| AI degrades without a key | **Verified** — `ai/config.py` |
| Authorization is server-side | **Verified** — role re-read from DB, not the token |
| `SECRET_KEY` fallback removed | **False** — `security.py:10` |
| Sprint 2 has test coverage | **False** — 5 tests total |
| Any endpoint returns correct data | **Unverified** — no test asserts a body |
| Full stack runs end-to-end | **Unverified** — never demonstrated |

---

## Risks, ranked

### R1 — CRITICAL · `SECRET_KEY` falls back to a hardcoded value · #23

```python
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-for-dev")
```

The fallback is public in this repo and the token carries `role`, so a forged
administrator JWT validates. It fails silently — no error, no log, the app boots
looking healthy. `database.py` already does this correctly for `DATABASE_URL`.

One line: `os.environ["SECRET_KEY"]`. **Highest-value fix in the codebase.**

### R2 — HIGH · The test suite cannot fail · #54, #55

Five tests for 63 endpoints. Two only check that FastAPI serves its own `/docs`.
The other three assert `status_code in [200, 401, 403]` — so an unauthenticated
caller receiving full admin analytics **passes**. No test registers a user, logs
in, or asserts on any response body.

### R3 — HIGH · Nothing gates a PR · #56

No `.github/workflows/`. All 52 PRs merged with zero automated checks. A PR that
fails to import would merge.

### R4 — MEDIUM · The tracker overstates project health

#24 and #43 were closed as **completed** on 2026-08-13. Both defects are still
in `develop` — the assertion is unchanged and coverage is still five tests.
Anyone planning from the issue list is planning on bad data. Superseded by #54
and #55.

### R5 — MEDIUM · `GET /complaints/?sort=expectedResolution` truncates at 2000 rows · #44

Silent — callers get a partial result with no indication it is partial.

### R6 — MEDIUM · No end-to-end proof

Nothing demonstrates a citizen registering, filing, an officer assigning, and a
worker resolving. Every subsystem is built; the seams between them are untested.
Issue #7 was exactly a seam failure, caught only by reading both sides by hand.
That approach does not scale to 63 endpoints.

---

## Recommendations

1. **Fix #23** — one line, removes the only critical defect
2. **Make the five tests capable of failing** (#54) — ~30 minutes
3. **Add one end-to-end test** through the seams (#55) — worth more than 63 endpoint tests
4. **Add CI** (#56) — `python -c "import main"` and `CI=true npm run build`

Roughly a day of work, and it moves the project from *built* to *demonstrably
working*.

---

## Summary

| Dimension | Assessment |
|---|---|
| Feature completeness | **Strong** |
| Architecture | **Strong** — services layer, lifecycle rules, graceful AI degradation |
| Authorization design | **Strong** — server-side, role from DB |
| Documentation | **Good** |
| Secrets handling | **Critical defect** (R1) |
| Test coverage | **Effectively zero** (R2) |
| CI / automation | **Absent** (R3) |
| Tracker accuracy | **Overstates health** (R4) |
| End-to-end proof | **None** (R6) |

The engineering is better than the process around it. What is missing is the
evidence that it works — and one security fix that takes a single line.
