# Backend requests from the frontend

Everything the frontend needs that the API does not yet provide, in one place.
Replaces the separate AI and analytics request docs.

**Verified against `backend/` on 2026-08-11.** Each item was checked against the
source before being listed — several earlier asks turned out to be already
implemented and have been moved to [Already done](#already-done) rather than
left in as noise.

Ordered by how much each unblocks in the UI.

---

## 1. Analytics endpoints — highest impact

`GET /admin/analytics` is the only analytics endpoint. It is
**administrator-only** (`main.py:311`), so an officer has no server-side
analytics at all, and it returns three figures:

```jsonc
{ "overview": { "totalComplaints": 247 },
  "breakdownByStatus": { … }, "breakdownBySeverity": { … } }
```

No time dimension, no categories, no durations, no geography. Everything else on
the dashboards is aggregated in the browser from `GET /complaints/` and labelled
**Derived** rather than **Verified** to keep the difference visible.

Each endpoint below upgrades a tile from Derived to Verified with **no UI
change** — the frontend already renders these shapes.

### `GET /analytics/overview?from=&to=`

Officer- and admin-readable.

```jsonc
{
  "period": { "from": "2026-08-01", "to": "2026-08-11" },
  "total": 247, "open": 69, "resolved": 178,
  "resolutionRatePct": 72.1,
  "avgResolutionHours": 41.5,                   // null if unknowable — never estimate
  "previous": { "total": 220, "resolved": 150 } // omit if no prior window exists
}
```

### `GET /analytics/trends?from=&to=&interval=day`

```jsonc
{ "points": [ { "date": "2026-08-01", "created": 12, "resolved": 9 } ] }
```

Include zero days explicitly — a gap-filled series distorts the line shape.

### `GET /analytics/categories?from=&to=`

```jsonc
{ "total": 247, "categories": [ { "categoryId": "CAT-ROA-01", "name": "…", "count": 64 } ] }
```

Return **every** category including zero counts. "Nothing reported under
Streetlight" is a finding; a list built only from counts hides it.

### `GET /analytics/aging`

Open complaints only — a complaint closed months ago is not "180 days old".

```jsonc
{ "buckets": [ { "label": "0-2 days", "count": 18 } ], "oldestOpenDays": 63 }
```

### `GET /analytics/resolution?from=&to=`

Per-department and per-worker performance. Not derivable today at all, because
`ComplaintResponse` carries no assignee — see item 3.

---

## 2. `resolvedAt` on a complaint

**This is why the dashboards say "insufficient verified data" for average
resolution time.** The only timestamp available is `updatedAt`, which moves on
*any* edit — a recategorisation, a remark, a reassignment. A mean derived from
it is wrong, not imprecise: a complaint recategorised months after being fixed
reports a months-long resolution.

**Ask:** add `resolvedAt` to `ComplaintModel`, set on the first transition into
`RESOLVED`, and return it on `ComplaintResponse`.

`GET /complaints/{id}/history` already holds the truth, and the frontend uses it
for the worker's own performance page — but a city-wide mean would need one
request per complaint, which is why it is not on any dashboard.

---

## 3. Expose the people on `ComplaintResponse` — cheapest win here

`ComplaintModel` already has `citizenId`, `officerId` and `fieldWorkerId`
(`models.py:106-107`). They are simply absent from the response schema.

**Ask:** three lines in `schemas.ComplaintResponse`:

```python
citizenId: Optional[str] = None
officerId: Optional[str] = None
fieldWorkerId: Optional[str] = None
```

No migration. This unblocks three things at once:

- an **"Assigned to"** column in the officer queue, which today cannot show who
  a complaint is with;
- **per-worker performance** for officers and admins;
- **reliable before/after photo splitting**. The frontend currently infers which
  photos are the citizen's by assuming the earliest uploader is the reporter
  (`lib/evidence.js`). With `citizenId` it becomes a fact rather than an
  inference.

---

## 4. `POST /ai/compare-images` for evidence verification

Officers verify a fix by comparing the citizen's photo with the worker's
completion photo. No endpoint compares two images: `/ai/duplicates` compares
text and location, `/ai/analyze-image` takes one image.

The frontend works around this by re-running `/ai/analyze-image` on the
completion photo and comparing what the model reports against the complaint's
category. A raw similarity score cannot answer the question on its own:

| Similarity | Could mean | Could **also** mean |
|---|---|---|
| Very high | nothing changed | same angle, small fix |
| Very low | the problem is gone | a photo of somewhere else |

**Ask:** an endpoint returning a structured verdict rather than a distance:

```jsonc
{ "sameScene": true, "problemStillPresent": false,
  "confidence": 0.81, "observations": ["road surface now level"], "source": "gemini" }
```

### Related: CORS on `/uploads`

The in-browser fallback comparison needs `crossOrigin="anonymous"` to read
pixels. `CORSMiddleware` is registered on the app so it should already cover the
mount, but it has not been verified against a running server — if the canvas
taints, the frontend degrades to "cannot be compared in the browser" and the AI
check still works.

---

## 5. Period filters on the complaint list

`GET /complaints/` takes no query parameters, so every dashboard fetches the
whole record set and filters client-side. Fine at hundreds of complaints,
not at tens of thousands.

**Ask:** `?from=&to=&status=&categoryId=&limit=&offset=`.

---

## 6. User management CRUD — the admin screen is mostly read-only

Admin > User Management can create accounts and reset passwords. It cannot
meaningfully **update** or **delete** one, and each gap is a specific defect
rather than a missing feature.

### 6a. `PATCH /admin/users/{id}` writes a worker's skills to the wrong attribute

`main.py` sets `field_worker.skills` and `field_worker.department`, but
`FieldWorkerModel` (`models.py:45`) has neither — the column is **`skillSet`**,
and there is no department column at all. SQLAlchemy accepts the assignment as
an ordinary Python attribute, the commit saves nothing, and the endpoint still
returns `{"message": "User updated successfully"}`.

That last part is the real problem: it reports success. The frontend cannot
tell a saved change from a discarded one, so the skills field in Edit User is
locked rather than lying about what it did.

```python
if update_data.skills is not None:
    field_worker.skillSet = ", ".join(update_data.skills)   # not .skills
# drop the field_worker.department branch entirely, or add the column
```

### 6b. `isActive` has nowhere to be stored

`UserModel` has no `isActive` column, so Suspend/Reactivate is accepted and
persists nothing, and nothing blocks a suspended user from signing in. Needs a
column plus a check in the login path — the column alone would be worse than
nothing, because the UI would then correctly show a suspension that does not
actually suspend.

### 6c. Name, email and phone cannot be updated at all

`UserUpdate` carries only `isActive`, `role`, `department`, `skills`. A
mistyped email currently means deleting and recreating the account — except
that deletion is not possible either (6d). Adding `name`, `email` and `phone`
to `UserUpdate` and the handler would close this; `email` needs the same
uniqueness check `POST /admin/users/official` already does.

### 6d. There is no delete endpoint

No `DELETE /admin/users/{id}` exists. Given complaints reference `citizenId`,
`officerId` and `fieldWorkerId`, a hard delete would orphan records — so the
right shape is almost certainly a soft delete built on 6b rather than a real
`DELETE`.

### 6e. `POST /admin/users/official` only builds an officer

`SystemOfficialCreate` accepts `role`, but the handler only constructs a
`MunicipalOfficerModel`. Any other role leaves `new_user` as `None` and
`db.add(None)` raises a 500. The frontend works around this by sending field
workers to `POST /workers/` instead, which is fine — but the endpoint should
either handle the other roles or reject them with a 400 rather than a 500.

---

## Already done

Checked against the source; earlier versions of these docs asked for work that
has since landed. Listed so nobody implements them twice.

| Previously requested | Status |
|---|---|
| Run AI triage on complaint creation | **Done** — `main.py:222`, gated on `auto_triage_on_create`, wrapped so a triage failure cannot block filing |
| Populate `duplicateOfComplaintId` automatically | **Done** — `apply_triage` auto-links above `duplicate_autolink_threshold` |
| A real merge endpoint | **Done** — `POST /complaints/{id}/merge` |
| Notification read state | **Done** — `PATCH /{id}/read`, `POST /me/read-all`, `GET /me/unread-count` |
| `GET /categories` | **Done** |
| Status history and media read endpoints | **Done** — `/history`, `/media` |
| `IN_PROGRESS` / `CLOSED` in `StatusEnum` | **Done** — the lifecycle is now ten states |

---

## What the frontend will not do

Stated so nobody "fixes" these by filling them in:

- No metric is hardcoded, sampled or seeded.
- No missing value is estimated, interpolated or back-filled.
- No AI-generated number is displayed. The assistant may interpret figures, but
  every number on screen is counted from records.
- Where data does not exist, the UI says **"Insufficient verified data"** and
  shows nothing else.
- AI output is always labelled as a recommendation and never changes a record on
  its own.
