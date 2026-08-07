# Backend AI — what the frontend needs next

Written from the frontend side after wiring every `/ai/*` and `/notifications/*`
endpoint currently on `develop`. Everything below is a **request, not a defect**
— the existing AI work is solid and degrades cleanly without a model key, which
is exactly right.

Ordered by how much each unblocks in the UI.

---

## 1. Persist triage on complaint creation — **highest impact**

`POST /complaints/` does not run triage. It hardcodes `severity="LOW"` and
leaves every `ai*` column null, so a freshly filed complaint arrives in the
officer queue with no AI signal at all. The officer has to press "Run triage
now" per complaint, which defeats the point.

**Ask:** run triage inside `create_complaint` (or as a background task straight
after commit) and persist `aiSuggestedCategoryId`, `aiSeverity`, `aiConfidence`,
`aiSummary`, `aiSource`, `aiAnalyzedAt`.

Two notes from the UI side:
- Please keep it **advisory** — do not overwrite the citizen's chosen
  `categoryId`. The officer drawer is built around "AI suggested X, record says
  Y, accept?" and that distinction disappears if triage writes the record.
- If triage is slow, prefer a background task over blocking the response.
  Filing a complaint should stay fast; the queue can pick the fields up later.

## 2. Set `duplicateOfComplaintId` automatically

The column exists and the frontend renders a "Possible Duplicate" panel from it,
but nothing populates it. `/ai/duplicates` already computes candidates at
submission time.

**Ask:** when duplicate confidence is high, write `duplicateOfComplaintId` on
create. Keep the threshold conservative — a false merge is much worse than a
missed one, because the second citizen's report silently disappears.

## 3. A real merge endpoint

Flagging a duplicate is only half of it. There is currently no way for an
officer to *act* on the flag.

**Ask:** `POST /complaints/{id}/merge { intoComplaintId }` that marks the source
merged, links it, and notifies both citizens. The officer queue has a merge
action designed and waiting for this.

## 4. Severity override for officers

`PATCH /complaints/{id}/category` exists; there is no equivalent for severity.
So an officer who disagrees with an AI severity has no way to correct it — the
only path is re-running triage and hoping for a different answer.

**Ask:** `PATCH /complaints/{id}/severity { severity, remarks }`, writing a
status-history row like the category patch does.

## 5. Read endpoints for data you already store

These are the last things the frontend still has to apologise for:

| Endpoint | What it unblocks |
|---|---|
| `GET /complaints/{id}/history` | The real status timeline. Complaint Details currently shows only created/updated with a note explaining why. |
| `GET /complaints/{id}/media` | Showing uploaded photos back. `PhotoTile` renders a placeholder because attachments cannot be read. |
| `GET /complaints/{id}/feedback` | Showing a rating after reload. Right now submitting twice creates two rows and the citizen cannot tell. |

All three are already written to the database. Only the read path is missing.

## 6. `GET /categories`

`CATEGORIES` in `src/api/mappers.js` is a hand-maintained mirror of
`backend/seed.py`. If anyone edits the seed without editing that file, the
frontend starts sending category ids that do not exist.

**Ask:** expose the category table. It is five rows and removes a whole class of
silent breakage.

## 7. Notification triggers beyond status change

`services/notifications.py` fires on status change, which covers the citizen.
Two spec requirements have no trigger yet:

- **Field workers** are not notified when a complaint is assigned to them.
  `PATCH /complaints/{id}/assign` should emit one.
- **Officers** are not alerted when a complaint breaches its expected resolution
  time. This needs an SLA per severity and a periodic sweep.

`NotificationResponse.priority` already exists and the UI can colour-code it —
nothing currently sets it to anything but the default.

## 8. Smaller things

- **`GET /ai/health` shape.** The frontend branches on `available === false`.
  Worth confirming that is the contract, since the assistant page disables its
  whole composer on it.
- **Vision on upload.** `/ai/analyze-image` works standalone but is not called
  by `POST /complaints/{id}/image`. Running it on the attached photo would let
  triage use image evidence, which is a spec requirement ("categorize from its
  text **and image**").
- **Classification logging.** The spec asks for classification results to be
  logged for accuracy review. `aiSource` and `aiConfidence` are stored per
  complaint, but there is no record of what the AI said *before* an officer
  overrode it — which is exactly the signal needed to measure accuracy. A small
  `ai_classification_log` table would cover it.

---

## What the frontend already handles, so you don't need to

- **No model key.** Every AI surface degrades to the rules engine or shows a
  clearly-worded "switched off" state. Nothing errors.
- **`source` is surfaced.** Rules-engine results are labelled differently from
  model results everywhere they appear.
- **Nothing is auto-applied.** All AI output is presented as a suggestion with
  an explicit accept action.
- **Low confidence is called out.** Below 60% the UI warns before an officer
  assigns.
