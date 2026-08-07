"""Glue between the database and the AI engine.

Loads the rows the AI layer needs, converts them into its plain dataclasses, and
writes results back onto a complaint. Keeping this separate means ``ai/`` never
imports SQLAlchemy models and stays unit-testable without a database.
"""

from __future__ import annotations

import logging
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


def apply_triage(complaint: models.ComplaintModel, triage: TriageResult) -> None:
    """Write AI results onto a complaint.

    Advisory fields only. ``categoryId`` is never overwritten -- the citizen (or
    an officer) owns that choice, and silently re-routing a complaint behind
    their back would make the audit trail lie. ``severity`` *is* updated, because
    it is an internal prioritisation signal no user sets directly, and under-
    triaging a hazard is the costlier mistake.
    """
    best_category = triage.category.best

    complaint.aiSuggestedCategoryId = best_category.categoryId if best_category else None
    complaint.aiConfidence = best_category.confidence if best_category else None
    complaint.aiSeverity = triage.severity.severity
    complaint.aiSummary = triage.summary[:2000] if triage.summary else None
    complaint.aiSource = triage.source
    complaint.aiAnalyzedAt = _utcnow()

    duplicate = triage.duplicates.best
    complaint.duplicateOfComplaintId = duplicate.complaintId if duplicate else None

    complaint.severity = triage.severity.severity
