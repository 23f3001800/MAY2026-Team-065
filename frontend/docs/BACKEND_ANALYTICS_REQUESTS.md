# Analytics endpoints the frontend needs

The redesign spec asks for an operations dashboard and an analytics page. This
lists what the backend would have to expose for those to show **server-verified**
figures rather than browser-derived ones.

## What exists today

`GET /admin/analytics` — the only analytics endpoint. Administrator-only.

```jsonc
{
  "overview":          { "totalComplaints": 247 },
  "breakdownByStatus":   { "PENDING": 41, "ASSIGNED": 28, ... },
  "breakdownBySeverity": { "LOW": 96, "MEDIUM": 88, ... }
}
```

Three figures, no time dimension, no categories, no durations, no geography.

**Two consequences:**

1. **Officers cannot use it at all** — `main.py:311` rejects any role that is not
   `administrator`, so the officer dashboard has no analytics source.
2. Everything else on the dashboard is aggregated in the browser from
   `GET /complaints/`. That is real data, but it is not a server aggregate, so
   the UI labels those figures **Derived** rather than **Verified**.

## Blocked right now

These two are not "nice to have" — they are the figures a spec-compliant
dashboard is *supposed* to show, and the frontend currently renders
"Insufficient verified data" for both rather than estimating them.

### 1. Average resolution time

**Blocker:** there is no resolution timestamp. `updatedAt` moves on *any* edit —
a recategorisation, a remark, a reassignment — so using it as a proxy produces a
confident, plausible, wrong number.

**Cheapest fix:** add `resolvedAt` to `ComplaintModel`, set when status first
enters `RESOLVED`, and return it on `ComplaintResponse`. The frontend can then
derive the mean without another endpoint.

`GET /complaints/{id}/history` already holds the truth, but computing a
city-wide mean from it needs one request per complaint.

### 2. Period-over-period comparison

Every metric tile in the spec wants "meaningful comparison where verified data
exists". Nothing stores a historical snapshot, and recomputing a past period
from current records cannot see complaints merged or deleted since — so the
comparison would drift from what was actually true then.

**Cheapest fix:** accept `?from=&to=` on an analytics endpoint and let the
frontend request two windows.

## Proposed endpoints

Roughly in value order. Each replaces browser aggregation the frontend is
already doing, which means each one upgrades a tile from **Derived** to
**Verified** without any UI change.

### `GET /analytics/overview?from=&to=`

Officer- and admin-readable. The officer dashboard's four tiles.

```jsonc
{
  "period": { "from": "2026-08-01", "to": "2026-08-11" },
  "total": 247,
  "open": 69,
  "resolved": 178,
  "resolutionRatePct": 72.1,
  "avgResolutionHours": 41.5,     // null if unknowable — do not estimate
  "previous": { "total": 220, "resolved": 150 }  // omit if no prior window
}
```

### `GET /analytics/trends?from=&to=&interval=day`

```jsonc
{ "points": [ { "date": "2026-08-01", "created": 12, "resolved": 9 }, ... ] }
```

Include zero days explicitly — a gap-filled series distorts the line shape.

### `GET /analytics/categories?from=&to=`

```jsonc
{ "total": 247, "categories": [ { "categoryId": "CAT-ROA-01", "name": "…", "count": 64 } ] }
```

Returning `total` alongside lets the UI render "64 of 247" without a second call.

### `GET /analytics/aging`

Open complaints only. A complaint closed months ago is not "180 days old".

```jsonc
{ "buckets": [ { "label": "0-2 days", "count": 18 }, ... ], "oldestOpenDays": 63 }
```

### `GET /analytics/resolution?from=&to=`

Per-department or per-worker performance — currently not derivable at all,
because `ComplaintResponse` carries no assignee.

## One smaller gap

**`ComplaintResponse` does not expose the assignee — but the columns exist.**

`ComplaintModel` already has `officerId` and `fieldWorkerId`
(`backend/models.py:106-107`). They are simply absent from the response schema,
so the frontend cannot show who a complaint is with, and no per-worker
performance view is possible.

This is therefore a two-line change to `schemas.ComplaintResponse`, not a
migration:

```python
officerId: Optional[str] = None
fieldWorkerId: Optional[str] = None
```

That alone unblocks the "Assigned to" column in the officer queue and a
per-worker resolution view.

## Verified as already done

Checked against `backend/main.py` on 2026-08-11, correcting an earlier note in
this file:

**`POST /complaints/` does run AI triage on create** (`main.py:222`), gated on
`auto_triage_on_create` and wrapped so a triage failure cannot stop a citizen
filing. New complaints are stored already prioritised, and `apply_triage` also
auto-links duplicates above `duplicate_autolink_threshold`. The frontend's
"Run triage now" button is therefore a re-run, not the only way to populate
the AI fields.

## What the frontend will not do

Per the spec's data-integrity rules, and worth stating so nobody "fixes" these
by filling them in:

- No metric is hardcoded or sampled.
- No missing value is estimated, interpolated, or back-filled.
- No AI-generated number is displayed. The assistant may interpret figures, but
  every number on screen is counted from records.
- Where data does not exist, the UI says "Insufficient verified data" and shows
  nothing else.
