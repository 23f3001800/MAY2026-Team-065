"""SLA tracking: alert officers when a complaint overruns its resolution target.

Each severity gets a target resolution time. A complaint that is still open past
that target is "breached", and the officers who own the department are notified
once -- not once per sweep.

The sweep runs as an asyncio task started on application startup. That is
deliberate: it needs no scheduler, no extra process and no new dependency. The
trade-off is that running several API instances means several sweepers, so the
dedup below is done against the database rather than in memory, and the loop can
be turned off entirely with SLA_ENABLED=false when an external cron drives
POST /admin/sla/sweep instead.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import models
from database import AsyncSessionLocal, OPEN_STATUSES
from services import notifications as notification_service

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("invalid %s=%r, using default %d", name, raw, default)
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def sla_hours() -> Dict[str, int]:
    """Target resolution time per severity, in hours.

    Defaults follow the shape of the severity ladder: a life-safety issue is a
    same-shift job, routine maintenance gets a week.
    """
    return {
        "CRITICAL": _env_int("SLA_CRITICAL_HOURS", 4),
        "HIGH": _env_int("SLA_HIGH_HOURS", 24),
        "MEDIUM": _env_int("SLA_MEDIUM_HOURS", 72),
        "LOW": _env_int("SLA_LOW_HOURS", 168),
    }


def sweep_interval_seconds() -> int:
    return max(60, _env_int("SLA_SWEEP_MINUTES", 15) * 60)


def is_enabled() -> bool:
    return _env_bool("SLA_ENABLED", True)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def deadline_for(complaint: models.ComplaintModel, hours: Dict[str, int]) -> Optional[datetime]:
    """When this complaint should have been resolved by."""
    if not complaint.createdAt:
        return None
    severity = str(getattr(complaint.severity, "name", complaint.severity) or "LOW")
    return complaint.createdAt + timedelta(hours=hours.get(severity, hours["LOW"]))


async def find_breached(db: AsyncSession) -> List[models.ComplaintModel]:
    """Return open complaints past their SLA deadline that have not been alerted.

    Dedup is done against the notifications table rather than in memory so a
    restart -- or a second API instance -- does not re-alert the same complaint.
    """
    hours = sla_hours()
    now = _utcnow()

    # Only statuses that represent live work; VERIFIED/REJECTED/RESOLVED are done.
    open_names = [s.name for s in OPEN_STATUSES]

    result = await db.execute(
        select(models.ComplaintModel)
        .where(models.ComplaintModel.status.in_(open_names))
        .options(
            selectinload(models.ComplaintModel.category),
            selectinload(models.ComplaintModel.location),
        )
    )
    candidates = result.scalars().all()

    overdue = [
        complaint
        for complaint in candidates
        if (deadline := deadline_for(complaint, hours)) is not None and deadline < now
    ]
    if not overdue:
        return []

    # One query for every complaint already alerted, rather than one per complaint.
    alerted_result = await db.execute(
        select(models.NotificationModel.complaintId).where(
            models.NotificationModel.type == notification_service.TYPE_SLA_BREACH,
            models.NotificationModel.complaintId.in_([c.complaintId for c in overdue]),
        )
    )
    already_alerted = {row[0] for row in alerted_result.all()}

    return [c for c in overdue if c.complaintId not in already_alerted]


async def run_sweep(db: AsyncSession) -> Dict[str, int]:
    """Find breached complaints, notify their officers, and commit.

    Returns counts so the manual endpoint and the logs can report what happened.
    """
    breached = await find_breached(db)
    if not breached:
        return {"breached": 0, "notified": 0}

    hours = sla_hours()
    notified = 0

    for complaint in breached:
        deadline = deadline_for(complaint, hours)
        overdue_hours = int((_utcnow() - deadline).total_seconds() // 3600) if deadline else 0
        severity = str(getattr(complaint.severity, "name", complaint.severity) or "LOW")

        notes = await notification_service.notify_sla_breach(
            db,
            complaint,
            severity=severity,
            overdue_hours=overdue_hours,
            target_hours=hours.get(severity, hours["LOW"]),
        )
        notified += len(notes)

    await db.commit()
    logger.info("SLA sweep: %d breached, %d notification(s) sent", len(breached), notified)
    return {"breached": len(breached), "notified": notified}


async def sweep_loop(stop_event: asyncio.Event) -> None:
    """Background loop; exits promptly when the app shuts down.

    Each iteration opens its own session so a failure cannot poison a
    long-lived one, and any exception is logged and swallowed -- a broken sweep
    must never take the API down with it.
    """
    interval = sweep_interval_seconds()
    logger.info("SLA sweeper started (every %d minute(s))", interval // 60)

    while not stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                await run_sweep(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("SLA sweep failed; will retry next interval")

        try:
            # Waiting on the event (rather than sleeping) means shutdown is
            # immediate instead of up to `interval` seconds late.
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue

    logger.info("SLA sweeper stopped")
