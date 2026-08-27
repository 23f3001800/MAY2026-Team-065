# Deploying SmartCivicConnect

Frontend on **Cloudflare Pages**, backend in a **container**, database on **managed
Postgres**. Cloudflare cannot host the backend: Workers run V8 isolates and their
Python runtime is Pyodide-based, which will not load `asyncpg`, `bcrypt` or
`pydantic-core`. Put the API on Render, Railway or Fly and keep Cloudflare in
front for DNS and TLS.

## 1. Database — Supabase

The app needs a **Postgres connection string**, which is not the same thing as
the Supabase URL and publishable key. Those two are for `supabase-js` talking to
PostgREST; this backend opens a real Postgres connection with `asyncpg` and never
uses them. Nothing in this repository reads a `NEXT_PUBLIC_*` variable.

Get the right one from **Project Settings → Database → Connection string → URI**.
It contains the database password you set when the project was created — if that
has been lost, reset it on the same page.

Then change the driver prefix, or SQLAlchemy will load `psycopg2` and fail:

```
postgresql://…            ->  postgresql+asyncpg://…
```

### Which host to use

**Use the Session pooler, not the direct connection.** Supabase's direct host
(`db.<ref>.supabase.co`) publishes an AAAA record and no A record — it is
IPv6-only. Render, Railway and most free tiers dial out over IPv4, so a direct
connection fails there with a name-resolution or timeout error that looks like a
firewall problem and is not.

```
postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Note the username is `postgres.<project-ref>`, not `postgres`.

**Avoid the transaction pooler on port 6543.** It is pgBouncer in transaction
mode, which does not keep prepared statements between queries — `asyncpg` uses
them for everything and fails with *"prepared statement already exists"* under
load rather than immediately. If you must use 6543, disable the cache:

```
DATABASE_URL=postgresql+asyncpg://…:6543/postgres?prepared_statement_cache_size=0
```

Tables are created on first boot — `create_all` plus `migrations.py` — so there
is no separate migration step.

## 2. Backend

Deploy `backend/` using its `Dockerfile`. On Render: New → Web Service → Docker,
root directory `backend`.

**Attach a disk mounted at `/data`.** Complaint photos are written to the
filesystem, and without a volume every photo vanishes on the next deploy. 1 GB is
plenty to start.

Environment:

| Variable | Value |
|---|---|
| `DATABASE_URL` | from step 1, with `+asyncpg` |
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ALLOWED_ORIGINS` | your Pages URL, e.g. `https://smartcivic.pages.dev` |
| `UPLOAD_DIR` | `/data/uploads` (already the image default) |
| `SLA_ENABLED` | `false` if you run more than one instance — see step 4 |

Optional, and everything still works without them: `GEMINI_API_KEY`,
`OPENROUTER_API_KEY`, `SMTP_*`. See `backend/.env.example`.

Then seed once, from the platform's shell:

```bash
python seed.py
```

It prints the administrator's credentials. **Change that password immediately** —
the account has full access and the default is in the repository's history.

Check `GET /health/ready`. It reports the database, AI, email and background
jobs, and answers 503 if the database is unreachable.

## 3. Frontend

Cloudflare Pages → Connect to Git.

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Output directory | `build` |
| Environment variable | `REACT_APP_API_URL` = your API URL |

`REACT_APP_API_URL` is read at **build** time, not runtime, so it must be set
before the build and a change to it needs a rebuild, not a restart.

`public/_redirects` sends every path to `index.html`. Without it, Pages looks for
a real file and returns 404 on any deep link — refreshing `/complaints/CMP-1234`
would break while navigating there from the home page worked.

## 4. Scheduled work

The SLA sweeper runs inside the API process. With one instance, leave it alone.
With more than one they race, so set `SLA_ENABLED=false` and drive it externally
with a Cloudflare Cron Trigger or the platform's scheduler:

```
POST /admin/sla/sweep      (administrator token)
```

## Before anyone else gets the URL

- [ ] Seeded admin password changed
- [ ] `SECRET_KEY` is a generated value, not copied from an example
- [ ] `ALLOWED_ORIGINS` is your Pages domain — not `*`
- [ ] A disk is mounted at `/data`; upload a photo, redeploy, check it is still there

## Known limits

**Uploads are on a disk, not object storage.** That is fine for one instance. Two
instances will each see only their own uploads, and Cloudflare Containers or any
serverless platform will lose them entirely. Moving to R2 or S3 is the fix and is
a code change, not configuration.

**The in-process cache is per instance.** Analytics answers are cached for 30
seconds locally, so two instances can briefly disagree. Harmless on a dashboard;
it is why nothing about a complaint's own state is cached.

**No CI runs the tests before deploy.** `testing/pytest` needs a live server, so
it cannot run as a build step as written.
