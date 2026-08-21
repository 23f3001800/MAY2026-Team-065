"""Analytics API.

Server-side aggregation for the operations dashboards. Before this existed the
only analytics endpoint was ``/admin/analytics`` — administrator-only, and
returning a total plus two breakdowns — so officers had no analytics at all and
every dashboard figure was aggregated in the browser from the full complaint
list. That works at hundreds of complaints and falls over at tens of thousands.

Two rules run through every endpoint here, and they are the whole point:

1. **Never invent a number.** Where a figure cannot be computed from stored
   data, the response carries ``null`` and the caller renders "insufficient
   data". Average resolution time is null until ``resolvedAt`` is populated;
   a previous-period comparison is omitted entirely when no prior window exists.

2. **Officer- and admin-readable.** Triage and dispatch decisions belong to
   officials, and both roles need the same operational picture. Citizens and
   field workers are refused — their own views are already scoped to them.
"""

from __future__ import annotations

import functools
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Float, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from database import StatusEnum, TERMINAL_STATUSES
from dependencies import get_current_user, get_db, require_roles
from services import cache as cache_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Officials only. Mirrors services/lifecycle._OFFICIALS.
_ALLOWED = ("officer", "municipal_officer", "administrator")

# Statuses that mean the work is done, for a resolution rate. VERIFIED implies
# it was resolved first, so counting both avoids under-reporting a team that
# gets its work confirmed.
_RESOLVED_STATES = (StatusEnum.RESOLVED.name, StatusEnum.VERIFIED.name)

_TERMINAL_NAMES = {s.name for s in TERMINAL_STATUSES}


def cached(name: str):
    """Reuse an analytics answer for a few seconds across callers.

    Every endpoint here runs several aggregates over the whole complaints table.
    An officer dashboard calls five of them on load, every officer opens it at
    the start of a shift, and for a given date range they all get the same
    numbers -- so the aggregation runs once and the rest read the result.

    Applied *below* the route decorator, so FastAPI still sees the original
    signature (``functools.wraps`` sets ``__wrapped__``, which ``inspect``
    follows) and dependency injection is unaffected.

    The key includes the caller's id and role. Analytics is officer-and-admin
    wide today and does not vary by person, but a cache whose key omits the
    caller is one scoping change away from showing one officer another's
    figures, and that failure would be silent.

    ``db`` is excluded from the key -- it is a per-request session object with
    no stable identity, and including it would make every key unique, which is
    a cache that never hits and always allocates.

    Nothing here is cached for longer than ANALYTICS_CACHE_SECONDS (30s by
    default, 0 to disable). Figures that lag reality by half a minute are fine
    on a dashboard; that is also why no complaint, status or inbox goes through
    this, where the same lag would look like a lost update.
    """

    def decorate(func):
        @functools.wraps(func)
        async def wrapper(**kwargs):
            user = kwargs.get("current_user")
            key = cache_service.key_for(
                "analytics:" + name,
                userId=getattr(user, "userId", None),
                role=getattr(user, "role", None),
                **{k: v for k, v in kwargs.items() if k not in ("db", "current_user")},
            )
            return await cache_service.analytics_cache.get_or_set(
                key,
                cache_service.analytics_ttl_seconds(),
                lambda: func(**kwargs),
            )

        return wrapper

    return decorate


def _status_name(value) -> str:
    return str(getattr(value, "name", value))


def _window(from_: Optional[date], to: Optional[date]) -> Tuple[datetime, datetime]:
    """Resolve a date range to naive UTC datetimes covering whole days.

    The database stores naive UTC (see the ``replace(tzinfo=None)`` calls
    throughout main.py), so comparisons must be naive too or PostgreSQL raises
    on mixed awareness. ``to`` is inclusive of its whole day, which is what a
    user picking "1st to 11th" means.
    """
    end = datetime.combine(to or datetime.now(timezone.utc).date(), datetime.max.time())
    start = datetime.combine(from_ or (end.date() - timedelta(days=29)), datetime.min.time())
    return start, end


def _in_window(stmt, start: datetime, end: datetime):
    return stmt.where(
        models.ComplaintModel.createdAt >= start,
        models.ComplaintModel.createdAt <= end,
    )


async def _counts_by(db: AsyncSession, column, start: datetime, end: datetime) -> Dict[str, int]:
    stmt = _in_window(
        select(column, func.count(models.ComplaintModel.complaintId)).group_by(column),
        start,
        end,
    )
    rows = (await db.execute(stmt)).all()
    return {_status_name(row[0]): row[1] for row in rows if row[0] is not None}


async def _totals(db: AsyncSession, start: datetime, end: datetime) -> Tuple[int, int, int]:
    """(total, resolved, open) inside the window."""
    total = (await db.execute(
        _in_window(select(func.count(models.ComplaintModel.complaintId)), start, end)
    )).scalar_one()

    resolved = (await db.execute(
        _in_window(
            select(func.count(models.ComplaintModel.complaintId))
            .where(models.ComplaintModel.status.in_(_RESOLVED_STATES)),
            start,
            end,
        )
    )).scalar_one()

    closed = (await db.execute(
        _in_window(
            select(func.count(models.ComplaintModel.complaintId))
            .where(models.ComplaintModel.status.in_(tuple(_TERMINAL_NAMES))),
            start,
            end,
        )
    )).scalar_one()

    return total, resolved, total - closed


@router.get("/overview", summary="Headline operations figures")
@cached("overview")
async def overview(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    require_roles(current_user, _ALLOWED, "view analytics")
    start, end = _window(from_, to)

    total, resolved, open_count = await _totals(db, start, end)

    # Average turnaround, in hours, from resolvedAt. Null rather than zero when
    # nothing in the window has been resolved, or when resolvedAt was never
    # populated -- a zero would read as "instant", which is a lie.
    avg_hours = None
    resolved_rows = (await db.execute(
        _in_window(
            select(models.ComplaintModel.createdAt, models.ComplaintModel.resolvedAt)
            .where(models.ComplaintModel.resolvedAt.is_not(None)),
            start,
            end,
        )
    )).all()
    if resolved_rows:
        deltas = [
            (r.resolvedAt - r.createdAt).total_seconds() / 3600
            for r in resolved_rows
            if r.resolvedAt and r.createdAt and r.resolvedAt >= r.createdAt
        ]
        if deltas:
            avg_hours = round(sum(deltas) / len(deltas), 1)

    payload = {
        "period": {"from": start.date().isoformat(), "to": end.date().isoformat()},
        "total": total,
        "open": open_count,
        "resolved": resolved,
        # A rate over zero complaints is undefined, not 0% -- "we resolve
        # nothing" is a very different statement from "nothing was reported".
        "resolutionRatePct": round((resolved / total) * 100, 1) if total else None,
        "avgResolutionHours": avg_hours,
        "resolutionSampleSize": len(resolved_rows),
    }

    # Previous window of equal length, omitted entirely when it holds nothing --
    # a comparison against an empty period is noise, not insight.
    span = end - start
    prev_start, prev_end = start - span, start - timedelta(microseconds=1)
    prev_total, prev_resolved, _ = await _totals(db, prev_start, prev_end)
    if prev_total:
        payload["previous"] = {
            "from": prev_start.date().isoformat(),
            "to": prev_end.date().isoformat(),
            "total": prev_total,
            "resolved": prev_resolved,
        }

    return payload


@router.get("/trends", summary="Complaint volume over time")
@cached("trends")
async def trends(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    require_roles(current_user, _ALLOWED, "view analytics")
    start, end = _window(from_, to)

    created_rows = (await db.execute(
        _in_window(
            select(func.date(models.ComplaintModel.createdAt).label("d"),
                   func.count(models.ComplaintModel.complaintId))
            .group_by("d"),
            start,
            end,
        )
    )).all()

    # Resolutions are bucketed by resolvedAt, not createdAt -- "how many did we
    # close that day" is a different question from "how many arrived".
    resolved_rows = (await db.execute(
        select(func.date(models.ComplaintModel.resolvedAt).label("d"),
               func.count(models.ComplaintModel.complaintId))
        .where(models.ComplaintModel.resolvedAt.is_not(None),
               models.ComplaintModel.resolvedAt >= start,
               models.ComplaintModel.resolvedAt <= end)
        .group_by("d")
    )).all()

    def _key(value) -> str:
        return value.isoformat() if hasattr(value, "isoformat") else str(value)[:10]

    created = {_key(r[0]): r[1] for r in created_rows}
    closed = {_key(r[0]): r[1] for r in resolved_rows}

    # Emit every day in the window, zeros included. A series that silently skips
    # quiet days compresses the x-axis and makes the trend look steadier than it
    # was.
    points: List[dict] = []
    cursor = start.date()
    while cursor <= end.date():
        key = cursor.isoformat()
        points.append({"date": key, "created": created.get(key, 0), "resolved": closed.get(key, 0)})
        cursor += timedelta(days=1)

    return {"period": {"from": start.date().isoformat(), "to": end.date().isoformat()},
            "points": points}


@router.get("/categories", summary="Complaint volume by category")
@cached("categories")
async def categories(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    require_roles(current_user, _ALLOWED, "view analytics")
    start, end = _window(from_, to)

    counts = dict(
        (row[0], row[1])
        for row in (await db.execute(
            _in_window(
                select(models.ComplaintModel.categoryId,
                       func.count(models.ComplaintModel.complaintId))
                .group_by(models.ComplaintModel.categoryId),
                start,
                end,
            )
        )).all()
    )

    # Start from every configured category so ones with nothing reported still
    # appear with a zero. "Nothing came in under Streetlight this month" is a
    # finding; a list built only from counts hides it.
    all_categories = (await db.execute(select(models.CategoryModel))).scalars().all()
    total = sum(counts.values())

    return {
        "period": {"from": start.date().isoformat(), "to": end.date().isoformat()},
        "total": total,
        "categories": [
            {
                "categoryId": c.categoryId,
                "name": c.name,
                "department": c.department,
                "count": counts.get(c.categoryId, 0),
            }
            for c in sorted(all_categories, key=lambda c: counts.get(c.categoryId, 0), reverse=True)
        ],
    }


@router.get("/aging", summary="How long open complaints have been waiting")
@cached("aging")
async def aging(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    require_roles(current_user, _ALLOWED, "view analytics")

    # Open complaints only, and deliberately NOT date-filtered: a complaint from
    # eight months ago that is still open is exactly what this endpoint exists
    # to surface, and a window would hide it.
    rows = (await db.execute(
        select(models.ComplaintModel.createdAt)
        .where(models.ComplaintModel.status.not_in(tuple(_TERMINAL_NAMES)))
    )).all()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    buckets = {"0-2 days": 0, "3-7 days": 0, "8-30 days": 0, "30+ days": 0}
    oldest = None

    for row in rows:
        created = row[0]
        if not created:
            continue
        days = (now - created).days
        oldest = days if oldest is None or days > oldest else oldest
        if days <= 2:
            buckets["0-2 days"] += 1
        elif days <= 7:
            buckets["3-7 days"] += 1
        elif days <= 30:
            buckets["8-30 days"] += 1
        else:
            buckets["30+ days"] += 1

    return {
        "openTotal": len(rows),
        "buckets": [{"label": k, "count": v} for k, v in buckets.items()],
        "oldestOpenDays": oldest,
    }


@router.get("/resolution", summary="Resolution performance by department and worker")
@cached("resolution")
async def resolution(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    require_roles(current_user, _ALLOWED, "view analytics")
    start, end = _window(from_, to)

    # Hours between creation and first resolution, computed in Python rather
    # than SQL: date arithmetic differs between PostgreSQL and SQLite, and this
    # runs over one window's worth of rows, not the whole table.
    rows = (await db.execute(
        _in_window(
            select(
                models.ComplaintModel.createdAt,
                models.ComplaintModel.resolvedAt,
                models.ComplaintModel.fieldWorkerId,
                models.CategoryModel.department,
            ).join(models.CategoryModel,
                   models.ComplaintModel.categoryId == models.CategoryModel.categoryId)
            .where(models.ComplaintModel.resolvedAt.is_not(None)),
            start,
            end,
        )
    )).all()

    by_department: Dict[str, List[float]] = {}
    by_worker: Dict[str, List[float]] = {}

    for created, resolved_at, worker_id, department in rows:
        if not created or not resolved_at or resolved_at < created:
            continue
        hours = (resolved_at - created).total_seconds() / 3600
        by_department.setdefault(department or "Unassigned", []).append(hours)
        if worker_id:
            by_worker.setdefault(worker_id, []).append(hours)

    def _summarise(bucket: Dict[str, List[float]], key_name: str) -> List[dict]:
        out = []
        for key, hours in bucket.items():
            ordered = sorted(hours)
            mid = len(ordered) // 2
            median = ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2
            out.append({
                key_name: key,
                "resolved": len(ordered),
                "avgHours": round(sum(ordered) / len(ordered), 1),
                # Median alongside mean: one complaint that sat for a year drags
                # an average somewhere no individual complaint actually is.
                "medianHours": round(median, 1),
            })
        return sorted(out, key=lambda r: r["resolved"], reverse=True)

    # Resolve worker ids to names so the caller does not need a second request.
    names: Dict[str, str] = {}
    if by_worker:
        worker_rows = (await db.execute(
            select(models.FieldWorkerModel.userId, models.FieldWorkerModel.name)
            .where(models.FieldWorkerModel.userId.in_(tuple(by_worker.keys())))
        )).all()
        names = {r[0]: r[1] for r in worker_rows}

    workers = _summarise(by_worker, "fieldWorkerId")
    for row in workers:
        row["name"] = names.get(row["fieldWorkerId"], "Unknown")

    return {
        "period": {"from": start.date().isoformat(), "to": end.date().isoformat()},
        "sampleSize": len(rows),
        "departments": _summarise(by_department, "department"),
        "workers": workers,
    }
