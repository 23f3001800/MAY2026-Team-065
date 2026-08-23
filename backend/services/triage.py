"""Glue between the database and the AI engine.

Loads the rows the AI layer needs, converts them into its plain dataclasses, and
writes results back onto a complaint. Keeping this separate means ``ai/`` never
imports SQLAlchemy models and stays unit-testable without a database.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import models
from ai.provider import TriageResult
from ai.rules import CategoryRecord, ComplaintRecord

logger = logging.getLogger(__name__)

# Upper bound on rows pulled in for duplicate comparison. Scoring is O(n) over
# this set, and it is filtered by time window and radius before scoring anyway.
_MAX_DUPLICATE_CANDIDATES = 300


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def load_categories(db: AsyncSession) -> List[CategoryRecord]:
    """Load all categories as engine records."""
    result = await db.execute(select(models.CategoryModel))
    return [
        CategoryRecord(
            categoryId=row.categoryId,
            name=row.name,
            department=row.department,
        )
        for row in result.scalars().all()
    ]


async def find_category(db: AsyncSession, categoryId: Optional[str]) -> Optional[CategoryRecord]:
    if not categoryId:
        return None
    row = await db.get(models.CategoryModel, categoryId)
    if not row:
        return None
    return CategoryRecord(
        categoryId=row.categoryId, name=row.name, department=row.department
    )


async def load_duplicate_candidates(
    db: AsyncSession,
    *,
    exclude_complaint_id: Optional[str] = None,
    window_days: int = 30,
) -> List[ComplaintRecord]:
    """Load recent complaints that could plausibly duplicate a new report.

    REJECTED complaints are excluded -- matching a report that was already
    dismissed tells the citizen nothing useful.
    """
    cutoff = _utcnow() - timedelta(days=window_days)

    stmt = (
        select(models.ComplaintModel)
        .options(selectinload(models.ComplaintModel.location))
        .where(
            models.ComplaintModel.createdAt >= cutoff,
            models.ComplaintModel.status != "REJECTED",
        )
        .order_by(models.ComplaintModel.createdAt.desc())
        .limit(_MAX_DUPLICATE_CANDIDATES)
    )

    if exclude_complaint_id:
        stmt = stmt.where(models.ComplaintModel.complaintId != exclude_complaint_id)

    result = await db.execute(stmt)

    records: List[ComplaintRecord] = []
    for complaint in result.scalars().all():
        location = complaint.location
        records.append(
            ComplaintRecord(
                complaintId=complaint.complaintId,
                description=complaint.description,
                status=str(getattr(complaint.status, "name", complaint.status)),
                categoryId=complaint.categoryId,
                latitude=location.latitude if location else None,
                longitude=location.longitude if location else None,
                createdAt=complaint.createdAt,
            )
        )
    return records


def log_classification(
    db: AsyncSession,
    complaint: models.ComplaintModel,
    *,
    field: str,
    ai_value: Optional[str],
    confidence: Optional[float],
    source: Optional[str],
    previous: Optional[str],
    new_value: Optional[str],
) -> models.AIClassificationLogModel:
    """Record what the AI predicted for one field.

    Written at triage time with actorId NULL. Pairing these with the override
    rows below is what makes accuracy measurable.
    """
    entry = models.AIClassificationLogModel(
        logId=f"AIL-{str(uuid.uuid4())[:10].upper()}",
        complaintId=complaint.complaintId,
        field=field,
        aiValue=ai_value,
        aiConfidence=confidence,
        aiSource=source,
        previousValue=previous,
        newValue=new_value,
        actorId=None,
        createdAt=_utcnow(),
    )
    db.add(entry)
    return entry


def log_override(
    db: AsyncSession,
    complaint: models.ComplaintModel,
    *,
    field: str,
    previous: str,
    new_value: str,
    actor: models.UserModel,
    remarks: Optional[str] = None,
) -> models.AIClassificationLogModel:
    """Record a human correcting an AI prediction.

    ``aiValue`` is carried over from the complaint's stored triage result, so a
    single row answers "what did the AI say, and what did the officer change it
    to" without a join.
    """
    ai_value = complaint.aiSeverity if field == "severity" else complaint.aiSuggestedCategoryId

    entry = models.AIClassificationLogModel(
        logId=f"AIL-{str(uuid.uuid4())[:10].upper()}",
        complaintId=complaint.complaintId,
        field=field,
        aiValue=ai_value,
        aiConfidence=complaint.aiConfidence,
        aiSource=complaint.aiSource,
        previousValue=previous,
        newValue=new_value,
        actorId=actor.userId,
        remarks=remarks,
        createdAt=_utcnow(),
    )
    db.add(entry)
    logger.info(
        "ai override: complaint=%s field=%s ai=%s %s->%s by=%s",
        complaint.complaintId, field, ai_value, previous, new_value, actor.userId,
    )
    return entry


def apply_triage(
    complaint: models.ComplaintModel,
    triage: TriageResult,
    *,
    db: Optional[AsyncSession] = None,
    autolink_threshold: float = 0.75,
) -> None:
    """Write AI results onto a complaint.

    Advisory fields only. ``categoryId`` is never overwritten -- the citizen (or
    an officer) owns that choice, and silently re-routing a complaint behind
    their back would make the audit trail lie. ``severity`` *is* updated, because
    it is an internal prioritisation signal no user sets directly, and under-
    triaging a hazard is the costlier mistake.

    ``autolink_threshold`` is deliberately stricter than the threshold used to
    *display* duplicate candidates. Showing a weak match costs an officer a
    glance; recording one makes a second citizen's report look like it was
    silently swallowed. When no candidate clears the bar the link is left unset,
    even though the candidate list still shows them.
    """
    best_category = triage.category.best
    previous_severity = str(getattr(complaint.severity, "name", complaint.severity) or "")

    complaint.aiSuggestedCategoryId = best_category.categoryId if best_category else None
    complaint.aiConfidence = best_category.confidence if best_category else None
    complaint.aiSeverity = triage.severity.severity
    complaint.aiSummary = triage.summary[:2000] if triage.summary else None
    complaint.aiSource = triage.source
    complaint.aiAnalyzedAt = _utcnow()

    # Only link a duplicate we are confident about.
    duplicate = triage.duplicates.best
    if duplicate and duplicate.similarity >= autolink_threshold:
        complaint.duplicateOfComplaintId = duplicate.complaintId
    else:
        complaint.duplicateOfComplaintId = None
        if duplicate:
            logger.info(
                "duplicate candidate %s for %s scored %.2f, below the %.2f auto-link "
                "threshold; surfacing it without linking",
                duplicate.complaintId, complaint.complaintId,
                duplicate.similarity, autolink_threshold,
            )

    complaint.severity = triage.severity.severity

    # Record what the AI decided, so a later officer override can be compared
    # against it when measuring accuracy.
    if db is not None:
        log_classification(
            db, complaint,
            field="severity",
            ai_value=triage.severity.severity,
            confidence=triage.severity.confidence,
            source=triage.severity.source,
            previous=previous_severity,
            new_value=triage.severity.severity,
        )
        if best_category:
            log_classification(
                db, complaint,
                field="category",
                ai_value=best_category.categoryId,
                confidence=best_category.confidence,
                source=triage.category.source,
                previous=complaint.categoryId,
                # Advisory only: categoryId is not changed, so the "new" value
                # is whatever the human already chose.
                new_value=complaint.categoryId,
            )


async def find_photo_duplicates(
    db: AsyncSession,
    digests: Sequence[str],
    *,
    exclude_complaint_id: str,
    window_days: int = 30,
) -> Optional[dict]:
    """Has one of these exact photos already been attached to another complaint?

    Text-and-location matching runs when a complaint is FILED, which is before
    any photo exists -- so an identical picture attached afterwards was never
    compared against anything. That is the gap this closes, and it is the case
    people actually hit: the same photo, sent twice.

    Exact bytes only. A re-compressed, cropped or re-photographed version of the
    same scene will not match; catching those needs a perceptual hash, which
    needs an image decoder, which this project does not depend on. Saying "no
    duplicate" here therefore means "not the same file", never "not the same
    problem" -- which is why the result is advisory and nothing is auto-linked
    from it.

    REJECTED complaints are excluded: matching a report that was already
    dismissed tells nobody anything useful.
    """
    digests = [d for d in digests if d]
    if not digests:
        return None

    cutoff = _utcnow() - timedelta(days=window_days)

    stmt = (
        select(models.MediaAttachmentModel, models.ComplaintModel)
        .join(
            models.ComplaintModel,
            models.ComplaintModel.complaintId == models.MediaAttachmentModel.complaintId,
        )
        .where(
            models.MediaAttachmentModel.sha256.in_(list(digests)),
            models.MediaAttachmentModel.complaintId != exclude_complaint_id,
            models.ComplaintModel.status != "REJECTED",
            models.ComplaintModel.createdAt >= cutoff,
        )
        .order_by(models.ComplaintModel.createdAt.asc())
        .limit(1)
    )

    row = (await db.execute(stmt)).first()
    if row is None:
        return None

    media, complaint = row
    return {
        "complaintId": complaint.complaintId,
        # Byte-identical, so there is nothing probabilistic to report. Stated as
        # 1.0 rather than omitted so a client can sort text and photo matches on
        # the same key.
        "similarity": 1.0,
        "matchedOn": "photo",
        "reason": (
            "the same photo file is already attached to " + complaint.complaintId
        ),
        "status": str(getattr(complaint.status, "name", complaint.status)),
        "description": (complaint.description or "")[:200],
        "filedAt": complaint.createdAt.isoformat() if complaint.createdAt else None,
    }
