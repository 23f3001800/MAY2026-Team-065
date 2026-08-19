# 🏙️ Smart Civic Connect — Backend

A **FastAPI**-powered REST API for managing municipal complaints across citizens, field workers, municipal officers, and administrators.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roles & Permissions](#roles--permissions)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [AI Features](#-ai-features)
- [API Specification](#-api-specification)

---

## 🛠️ Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Framework   | FastAPI                             |
| ORM         | SQLAlchemy 2.0 (Async)              |
| Database    | PostgreSQL (via `asyncpg`)          |
| Auth        | JWT (PyJWT) + OAuth2 Password Flow  |
| Validation  | Pydantic v2                         |
| Password    | Passlib (bcrypt)                    |
| Server      | Uvicorn                             |

---

## 📁 Project Structure

```
backend/
├── main.py              # Core API routes (auth, complaints, workers, admin)
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic request/response schemas
├── database.py          # DB engine, session, and enums
├── security.py          # JWT creation & password hashing helpers
├── dependencies.py      # Shared FastAPI dependencies (auth, DB session, role guard)
├── migrations.py        # Additive, idempotent schema migrations (run at startup)
├── seed.py              # Database seeding script
├── generate_openapi.py  # Regenerates openapi.yaml from the live app
├── openapi.yaml         # Generated OpenAPI 3.1 specification
├── ai/                  # AI subsystem
│   ├── config.py        #   environment-driven settings
│   ├── provider.py      #   shared result types
│   ├── text.py          #   dependency-free text & geo helpers
│   ├── rules.py         #   deterministic engine (category, severity, duplicates)
│   ├── gemini.py        #   async Gemini REST client (text + vision)
│   ├── service.py       #   facade; owns the rules/LLM hybrid policy
│   └── assistant.py     #   grounded, role-scoped question answering
├── routers/
│   ├── ai.py            # /ai/* endpoints
│   └── notifications.py # /notifications/* endpoints
├── services/
│   ├── notifications.py # notification creation, fan-out, inbox queries
│   └── triage.py        # DB <-> AI glue, persists triage results
├── requirements.txt     # Python dependencies
└── .env                 # Environment variables (not committed)
```

---

## 👥 Roles & Permissions

| Role                  | Key Capabilities                                                                          |
|-----------------------|-------------------------------------------------------------------------------------------|
| **Citizen**           | Register, submit complaints, upload images, view own complaints, submit feedback, AI triage before filing |
| **Field Worker**      | View assigned tasks, update complaint status, upload images, toggle availability          |
| **Municipal Officer** | Assign field workers to complaints, recategorize complaints, update complaint status, re-run AI triage |
| **Administrator**     | Full access — create officers/workers, manage all users, view analytics, reset passwords   |

All four roles have a notification inbox and access to the role-scoped AI assistant.

---

## 🚀 Getting Started

### 1. Clone & Navigate

```bash
cd backend
```

### 2. Create a Virtual Environment

```bash
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>:<port>/<dbname>
SECRET_KEY=your_super_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Copy `.env.example` for the full list, including the optional AI settings.

**The AI features work with no extra configuration.** Categorisation, severity
scoring and duplicate detection run on a built-in deterministic engine. Setting
`GEMINI_API_KEY` additionally enables image analysis, description write-ups and
the natural-language assistant — see [AI Features](#-ai-features).

### 5. Seed the Database (Optional)

```bash
python seed.py
```

---

## ▶️ Running the Server

```bash
uvicorn main:app --reload
```

The API will be available at: **`http://localhost:8000`**

Interactive docs: **`http://localhost:8000/docs`**

---

## 📡 API Endpoints

### 🔐 Authentication

| Method | Endpoint         | Description                    | Auth Required |
|--------|------------------|--------------------------------|---------------|
| POST   | `/auth/register` | Register a new citizen account | No            |
| POST   | `/auth/login`    | Login and receive a JWT token  | No            |

---

### 📢 Complaints

| Method | Endpoint                             | Description                                        | Roles Allowed                               |
|--------|--------------------------------------|----------------------------------------------------|---------------------------------------------|
| POST   | `/complaints/`                       | Submit a new complaint                             | Citizen                                     |
| GET    | `/complaints/`                       | List complaints (own for citizens, all for admins) | Citizen, Officer, Administrator             |
| GET    | `/complaints/{complaintId}`          | Get full details of a single complaint             | Citizen (own), Officer, Admin               |
| GET    | `/complaints/nearby`                 | Find complaints within a geographic radius         | All authenticated users                     |
| GET    | `/complaints/worker/tasks`           | List complaints assigned to the logged-in worker   | Field Worker                                |
| PATCH  | `/complaints/{complaintId}/status`   | Update complaint status (with history log)         | Officer, Admin, Field Worker (if assigned)  |
| PATCH  | `/complaints/{complaintId}/assign`   | Assign a field worker to a complaint               | Officer, Administrator                      |
| PATCH  | `/complaints/{complaintId}/category` | Recategorize a complaint                           | Officer, Administrator                      |
| PATCH  | `/complaints/{complaintId}/severity` | Override severity (logged for accuracy review)     | Officer, Administrator                      |
| POST   | `/complaints/{complaintId}/merge`    | Merge a duplicate into another complaint           | Officer, Administrator                      |
| POST   | `/complaints/{complaintId}/images`   | Upload one or more photos (runs vision analysis)   | Citizen (owner), Field Worker (assigned)    |
| POST   | `/complaints/{complaintId}/image`    | Upload a single image (**deprecated** — use `/images`) | Citizen (owner), Field Worker (assigned) |
| POST   | `/complaints/{complaintId}/feedback` | Submit rating & feedback for a resolved complaint  | Citizen (owner)                             |
| GET    | `/complaints/{complaintId}/history`  | Status timeline, oldest first                      | Citizen (own), Officer, Admin, assigned Worker |
| GET    | `/complaints/{complaintId}/media`    | Photos attached to a complaint                     | Citizen (own), Officer, Admin, assigned Worker |
| GET    | `/complaints/{complaintId}/feedback` | Feedback submitted for a complaint                 | Citizen (own), Officer, Admin, assigned Worker |
| GET    | `/complaints/{complaintId}/report-slip` | Printable summary of a complaint                | Citizen (own), Officer, Admin, assigned Worker |

### 🗂️ Categories

| Method | Endpoint      | Description                                | Roles Allowed     |
|--------|---------------|--------------------------------------------|-------------------|
| GET    | `/categories` | List all categories and their departments  | All authenticated |

### 🙋 Citizen self-service

| Method | Endpoint                  | Description                                   | Roles Allowed |
|--------|---------------------------|-----------------------------------------------|---------------|
| PATCH  | `/citizens/me/profile`    | Update own name, phone or address (partial)   | Citizen       |
| PATCH  | `/citizens/me/password`   | Change own password (verifies the old one)    | Citizen       |

---

### 👷 Field Workers

| Method | Endpoint                   | Description                                       | Roles Allowed          |
|--------|----------------------------|---------------------------------------------------|------------------------|
| POST   | `/workers/`                | Register a new field worker                       | Administrator          |
| GET    | `/workers/`                | List workers (filter by `skillSet`)               | Officer, Administrator |
| PATCH  | `/workers/me/availability` | Toggle availability (`AVAILABLE`/`UNAVAILABLE`)   | Field Worker           |

---

### 🔔 Notifications

Every authenticated role has an inbox. Notifications carry an explicit
`recipientId`, so field workers and officers receive them too — not just citizens.

| Method | Endpoint                            | Description                                          | Roles Allowed |
|--------|-------------------------------------|------------------------------------------------------|---------------|
| GET    | `/notifications/me`                 | Inbox, newest first (`unreadOnly`, `type`, `skip`, `limit`) | All           |
| GET    | `/notifications/me/unread-count`    | Unread badge count                                   | All           |
| PATCH  | `/notifications/{notificationId}/read` | Mark one read/unread (persists `readAt`)          | Owner         |
| POST   | `/notifications/me/read-all`        | Mark every notification read                         | All           |
| DELETE | `/notifications/{notificationId}`   | Delete one from your inbox                           | Owner         |

**Events that generate notifications**

| Event                              | Who is notified                                              |
|------------------------------------|--------------------------------------------------------------|
| Complaint filed                    | Officers of the matching department (all officers if unmatched) |
| Triage rates it HIGH / CRITICAL    | Officers of the matching department (`ESCALATION`, urgent)   |
| Field worker assigned              | The worker, and the citizen                                  |
| Status changed                     | Citizen, assigned worker, and the owning officer on resolution |
| Complaint recategorised            | Citizen                                                      |
| Feedback submitted                 | Handling officer and field worker (high priority if ≤ 2 stars) |

Whoever performed an action is never notified about their own change. Priority
(`LOW`/`NORMAL`/`HIGH`/`URGENT`) is derived from complaint severity.

---

### 🤖 AI

| Method | Endpoint                              | Description                                             | Roles Allowed          |
|--------|---------------------------------------|---------------------------------------------------------|------------------------|
| GET    | `/ai/health`                          | Which AI features this deployment can serve             | Public                 |
| POST   | `/ai/categorize`                      | Suggest categories for complaint text                   | All authenticated      |
| POST   | `/ai/severity`                        | Predict severity with explainable signals               | All authenticated      |
| POST   | `/ai/duplicates`                      | Find likely duplicate complaints                        | All authenticated      |
| POST   | `/ai/triage`                          | Category + severity + duplicates + summary in one call  | All authenticated      |
| POST   | `/ai/analyze-image`                   | Vision: photo → description, category, severity         | All authenticated      |
| POST   | `/ai/describe`                        | Rewrite a report into an officer-facing paragraph       | All authenticated      |
| POST   | `/ai/assistant/query`                 | Grounded, role-scoped natural-language Q&A              | All authenticated      |
| POST   | `/ai/complaints/{complaintId}/analyze`| Re-run triage on an existing complaint and persist it   | Officer, Administrator |

---

### 🛡️ Admin

| Method | Endpoint                         | Description                                           | Roles Allowed |
|--------|----------------------------------|-------------------------------------------------------|---------------|
| GET    | `/admin/analytics`               | City-wide complaint statistics (by status & severity) | Administrator |
| POST   | `/admin/sla/sweep`               | Run the SLA breach sweep now                          | Administrator |
| POST   | `/admin/users/official`          | Create a Municipal Officer account                    | Administrator |
| GET    | `/admin/users`                   | Search/list all users (filter by name, email, role)   | Administrator |
| PATCH  | `/admin/users/{user_id}`         | Update user account (suspend, edit skills/dept)       | Administrator |
| PATCH  | `/users/{userId}/reset-password` | Reset a user's password                               | Administrator |

---

## 🗄️ Data Models

### Users (Polymorphic Inheritance)

```
UserModel (base)
├── CitizenModel           → address
├── MunicipalOfficerModel  → department, designation
├── FieldWorkerModel       → skillSet, availabilityStatus
└── AdministratorModel     → accessLevel
```

### Core Entities

| Model                  | Description                                      |
|------------------------|--------------------------------------------------|
| `ComplaintModel`       | Core complaint record with status & severity     |
| `LocationModel`        | Latitude, longitude, and address of a complaint  |
| `CategoryModel`        | Category name and responsible department         |
| `StatusHistoryModel`   | Audit log of all complaint status changes        |
| `MediaAttachmentModel` | File uploads (images) linked to a complaint      |
| `FeedbackModel`        | Citizen rating (1–5) + comments after resolution |
| `NotificationModel`    | In-app notification addressed to a `recipientId` |
| `AIClassificationLogModel` | What the AI predicted vs. what a human changed it to |

`ComplaintModel` also carries advisory AI fields — `aiSuggestedCategoryId`,
`aiSeverity`, `aiConfidence`, `aiSummary`, `aiSource`, `aiAnalyzedAt` and
`duplicateOfComplaintId` — so a triage decision stays auditable after the fact.

### Enums

| Enum           | Values                              |
|----------------|-------------------------------------|
| `SeverityEnum` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |

---

## 🔄 Complaint Lifecycle

Ten statuses across three phases.

**1. Intake & triage**

| Status | Meaning |
|---|---|
| `PENDING` | Submitted, untouched by staff |
| `UNDER_REVIEW` | An officer is validating it and choosing a department |

**2. Action & dispatch**

| Status | Meaning |
|---|---|
| `ASSIGNED` | Delegated to a field worker, not started |
| `IN_PROGRESS` | The worker is on site and working |
| `ON_HOLD` | Paused — waiting on materials, weather, another department |
| `ESCALATED` | Bigger or more dangerous than expected; needs specialists |

**3. Closure & validation**

| Status | Meaning |
|---|---|
| `RESOLVED` | The worker says the job is done |
| `VERIFIED` | Confirmed fixed and permanently closed |
| `REOPENED` | The fix did not hold — back into the queue |
| `REJECTED` | Invalid, a prank, out of jurisdiction, or merged away |

### Who may set what

Permission depends on the **target status**, not just the role — the full matrix
is in [`services/lifecycle.py`](services/lifecycle.py).

| Role | May set |
|---|---|
| Citizen (own complaint) | `VERIFIED`, `REOPENED` |
| Assigned field worker | `IN_PROGRESS`, `ON_HOLD`, `RESOLVED`, `ESCALATED` |
| Officer / Administrator | all ten |

Verification is deliberately the citizen's call: they are the only party who can
confirm the problem is actually gone.

### Automatic transitions

- **Auto-reopen.** Feedback at or below `REOPEN_ON_RATING` (default 2 stars) on a
  `RESOLVED` complaint flips it to `REOPENED`, logs the reason, and tells the
  officer and worker. Set to `0` to disable.
- **Merge.** Merging a duplicate closes the source as `REJECTED`, links it via
  `duplicateOfComplaintId`, and notifies **both** citizens — so the person whose
  report was merged is never left wondering where it went.

### Feedback rules

One rating per resolution cycle. A second submission returns `409`; but if the
complaint is reopened and fixed again, the citizen can rate the new attempt.

### ⚠️ Adding a status

`StatusEnum` is a real PostgreSQL enum type. `create_all()` creates it once and
never revisits it, so adding a member in Python is **not** enough — add it to
`_ENUM_VALUES` in [`migrations.py`](migrations.py) too, which issues
`ALTER TYPE ... ADD VALUE` in the right position. Also add wording to
`_STATUS_RULES` in [`services/notifications.py`](services/notifications.py),
or the status falls back to generic phrasing.

---

## ⏱️ SLA Monitoring

Each severity has a resolution target. A complaint still open past its target is
"breached", and the owning officers are alerted **once** — deduplicated against
the notifications table, so restarts do not re-alert.

| Severity | Default target |
|---|---|
| `CRITICAL` | 4 hours |
| `HIGH` | 24 hours |
| `MEDIUM` | 72 hours |
| `LOW` | 168 hours (1 week) |

A background task sweeps every `SLA_SWEEP_MINUTES` (default 15). Running several
API instances means several sweepers, so in that case set `SLA_ENABLED=false` and
drive `POST /admin/sla/sweep` from cron instead.

### Schema migrations

`Base.metadata.create_all()` creates missing tables but never alters existing
ones, so columns added later would be invisible to an already-deployed database.
`migrations.py` closes that gap at startup with additive, idempotent steps
(`ADD COLUMN IF NOT EXISTS` plus `WHERE ... IS NULL` backfills). It is safe to
run on every boot and handles PostgreSQL and SQLite. It is not a replacement for
Alembic — a destructive or type-changing migration still needs a real tool.

---

## 🤖 AI Features

### How it works

The AI layer is a **hybrid**. A deterministic engine is the authority for triage,
and Gemini refines it when configured:

| Feature                | Engine                                          | Needs an API key? |
|------------------------|-------------------------------------------------|-------------------|
| Categorisation         | Rules engine, re-ranked by Gemini when unsure   | No                |
| Severity prediction    | Rules engine; Gemini may only *raise* it        | No                |
| Duplicate detection    | Rules engine only (text similarity + geo + time)| No                |
| Image analysis         | Gemini vision                                   | **Yes**           |
| Description write-ups  | Gemini                                          | **Yes**           |
| Assistant (grounded)   | Gemini over role-scoped DB records              | **Yes**           |

Every AI response carries a `source` field (`rules`, `gemini`, `gemini-vision`)
so clients and officers can tell which engine produced a result.

Check what a deployment can serve with `GET /ai/health`.

### The deterministic engine

Runs offline, costs nothing, and returns identical output for identical input.

- **Categorisation** scores each category from the database against a civic-issue
  lexicon plus the category's own wording, then normalises scores into relative
  confidence. Categories are read from the database, so adding a category row
  needs no code change.
- **Severity** combines urgency vocabulary, hazard vocabulary and the matched
  category's baseline risk. Results are explainable: every response lists the
  `signals` that drove it.
- **Duplicate detection** requires agreement on *what* and *where* — IDF-weighted
  cosine similarity plus bigram overlap, multiplied by geographic proximity, with
  a same-category bonus. Candidates outside the radius or time window are dropped
  before scoring.

### Design decisions

- **Gemini can raise severity but never lower it.** Silently downgrading a hazard
  the lexicon caught is the more dangerous failure direction for a public-safety
  system, so the rules result is a floor.
- **AI never overwrites `categoryId`.** The citizen or officer owns that choice;
  the model's opinion is recorded separately in `aiSuggestedCategoryId`.
  `severity` *is* updated, because it is an internal prioritisation signal no
  user sets directly.
- **Everything degrades softly.** An unconfigured key, a safety block or an
  upstream error falls back to the rules engine. Triage failure during complaint
  submission is caught and logged — it can never stop a citizen filing a report.
- **The assistant has no vector store, deliberately.** Its questions are about
  live rows ("where is my complaint", "what is assigned to me"), which SQL
  answers better than embeddings over stale snapshots. Retrieval is scoped by
  role **inside the query**, so a prompt injected into a complaint description
  cannot widen what the model can read — those rows are never fetched.
- **Two duplicate thresholds, not one.** `AI_DUPLICATE_THRESHOLD` (0.55) decides
  what is *shown* as a possible duplicate; `AI_DUPLICATE_AUTOLINK_THRESHOLD`
  (0.75) decides what is actually *linked*. Showing a weak match costs an officer
  a glance; recording one makes a second citizen's report look swallowed.
- **Every prediction and override is logged** to `ai_classification_logs`. The
  complaint row holds only current values, so once an officer corrects a severity
  the AI's original call would otherwise be lost — and that comparison is exactly
  what measures accuracy.
- **Photos feed triage.** Uploading to `/complaints/{id}/images` runs vision
  analysis on the first photo and may raise severity, so triage uses image
  evidence and not just the citizen's text. Best-effort: an upload never fails
  because the model was unavailable.
- **Vision prompts steer away from PII.** Street photos routinely contain
  bystanders and number plates; the system prompt forbids describing people or
  registration numbers, which is both the right privacy posture and fewer
  provider safety blocks.

### Configuration

All optional — see `.env.example`. The important ones:

```env
AI_PROVIDER=auto              # auto | rules | gemini
GEMINI_API_KEY=               # unset → deterministic engine only
GEMINI_MODEL=gemini-2.5-flash # or gemini-3.5-flash-lite for lower cost
AI_AUTO_TRIAGE=true           # run triage when a complaint is filed
```

Set `AI_PROVIDER=rules` in CI to guarantee no outbound calls.

---

## 📄 API Specification

`openapi.yaml` is generated from the running app. Regenerate it after changing
any endpoint:

```bash
python generate_openapi.py                       # → backend/openapi.yaml
python generate_openapi.py <path/to/swagger.yaml>  # → any other destination
```

---

## 📝 Notes

- Uploaded images are stored in the `uploads/` directory and served statically at `/uploads/<filename>`.
- JWT tokens must be passed as a `Bearer` token in the `Authorization` header for all protected routes.
- Field worker assignment includes **skill validation** — the worker's `skillSet` must match the complaint category's `department`.
- Complaint lifecycle events automatically trigger **in-app notifications** to every stakeholder — see [Notifications](#-notifications).
- Filing a complaint with an unknown `categoryId` returns a `404` rather than surfacing a database integrity error.
