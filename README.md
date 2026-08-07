# SmartCivicConnect

A civic complaint and resolution portal. Citizens report local issues — potholes,
garbage, water leakage, broken streetlights — and municipal officers triage them,
assign field workers, and verify the fix before closing.

Built by **Team 065 (DevSync)**.

## Roles

| Role | Can do |
|---|---|
| **Citizen** | File complaints with a photo and location, track status, browse nearby issues, rate the resolution |
| **Municipal Officer** | Review the complaint queue, re-categorise, assign field workers, verify evidence and close |
| **Field Worker** | See assigned tasks, update status, set availability |
| **Administrator** | Provision officers and workers, city-wide analytics, user management, password resets |

Only citizens can self-register. Every other role is provisioned by an administrator.

## Stack

- **Backend** — FastAPI, SQLAlchemy 2 (async), PostgreSQL via `asyncpg`, JWT auth (PyJWT + passlib/bcrypt)
- **Frontend** — React (Create React App), React Router, Tailwind CSS
- **Testing** — pytest suite and a Postman collection under `testing/`

## Layout

```
backend/         FastAPI app — main.py (routes), models.py, schemas.py, security.py, seed.py
frontend/        React app — src/api (HTTP clients), src/pages, src/components, src/layouts
testing/         pytest suite, Postman collection, test reports
qa_docs/         Test plan, strategy, and review checklists
CONTRIBUTING.md  Branching rules — read before pushing
```

## Running it

You need Python 3.11+, Node 18+, and a local PostgreSQL.

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env          # then edit it — DATABASE_URL and SECRET_KEY are required
createdb complaint_db

python seed.py                # creates categories and the default admin
uvicorn main:app --reload --port 8000
```

API at `http://localhost:8000`, interactive docs at `/docs`.

The app refuses to start without `DATABASE_URL`, by design — a missing database
should fail loudly at boot rather than at the first request.

### Frontend

```bash
cd frontend
npm ci
npm start
```

Runs on `http://localhost:3000` and expects the backend at `http://localhost:8000`.
Override with `REACT_APP_API_URL` if yours is elsewhere.

### Default admin

`seed.py` creates `admin@city.gov` / `admin123`. Development only — change it
before this is exposed to anything.

## API notes

Routes are mounted at the **root**, with no `/api` prefix — `/auth/login`, not
`/api/auth/login`.

`POST /auth/login` follows the OAuth2 password flow: send **form-encoded**
`username` and `password`, where `username` is the user's email. It returns a
bearer token; send it as `Authorization: Bearer <token>` on every other endpoint.

Every endpoint verifies the token and re-reads the user's role from the database,
so a role change takes effect immediately. The frontend's route guards are a
convenience for the UI only — authorization is enforced server-side.

## Tests

```bash
cd testing/pytest
pytest -v
```

These are integration tests: they run against a **live server**, so start the
backend first. `testing/postman/` has the equivalent collection.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Short version: six branches, no new
ones, work only on your own, and open a PR into `develop` — never push to `develop`
or `main` directly.

## Status

Under active development. The API and the UI are both largely built out; the two
are still being reconciled endpoint by endpoint, so expect rough edges where they
meet. Open issues track what's outstanding.
