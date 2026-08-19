"""Notification creation, fan-out and inbox queries.

Centralised here rather than inlined into routes so that every event produces a
consistently shaped notification, and so the fan-out rules (who hears about a
new complaint, who hears about an escalation) live in one auditable place.

Two conventions worth knowing:

* Notifications are **persisted only** -- this is an in-app inbox, not an email
  or push gateway. Adding a transport later means subscribing to these records,
  not changing the call sites.
* Creation never commits. Callers commit as part of their own transaction, so a
  failed status update can't leave behind a notification claiming it succeeded.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import models

logger = logging.getLogger(__name__)

# --- Notification types -------------------------------------------------
TYPE_NEW_COMPLAINT = "NEW_COMPLAINT"
TYPE_STATUS_UPDATE = "STATUS_UPDATE"
TYPE_ASSIGNMENT = "ASSIGNMENT"
TYPE_RESOLUTION = "RESOLUTION"
TYPE_FEEDBACK = "FEEDBACK"
TYPE_ESCALATION = "ESCALATION"
TYPE_DUPLICATE = "DUPLICATE_FLAGGED"
TYPE_RECATEGORIZED = "RECATEGORIZED"
# Emitted once per complaint that overruns its resolution target. The type is
# also what the SLA sweep deduplicates on, so it must not be reused elsewhere.
TYPE_SLA_BREACH = "SLA_BREACH"

# --- Priorities ---------------------------------------------------------
PRIORITY_LOW = "LOW"
PRIORITY_NORMAL = "NORMAL"
PRIORITY_HIGH = "HIGH"
PRIORITY_URGENT = "URGENT"

# Severity drives priority so an officer's inbox sorts by real-world urgency.
_SEVERITY_PRIORITY = {
    "LOW": PRIORITY_LOW,
    "MEDIUM": PRIORITY_NORMAL,
    "HIGH": PRIORITY_HIGH,
    "CRITICAL": PRIORITY_URGENT,
}


def _utcnow() -> datetime:
    """Naive UTC, matching the DateTime columns used across the schema."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _severity_name(complaint: models.ComplaintModel) -> str:
    return str(getattr(complaint.severity, "name", complaint.severity) or "LOW")


def _status_name(status) -> str:
    return str(getattr(status, "name", status))


def priority_for_severity(severity: str) -> str:
    return _SEVERITY_PRIORITY.get((severity or "").upper(), PRIORITY_NORMAL)


def build_notification(
    *,
    recipientId: str,
    complaintId: str,
    message: str,
    type: str,
    priority: str = PRIORITY_NORMAL,
) -> models.NotificationModel:
    """Construct a notification row. Does not add it to a session."""
    return models.NotificationModel(
        notificationId=f"NOTIF-{str(uuid.uuid4())[:8].upper()}",
        message=message,
        type=type,
        sentAt=_utcnow(),
        isRead=False,
        complaintId=complaintId,
        recipientId=recipientId,
        priority=priority,
    )


def add_notification(
    db: AsyncSession,
    *,
    recipientId: Optional[str],
    complaintId: str,
    message: str,
    type: str,
    priority: str = PRIORITY_NORMAL,
) -> Optional[models.NotificationModel]:
    """Queue a notification on the caller's transaction.

    Returns None when there is no recipient (e.g. an unassigned complaint), which
    is a normal outcome rather than an error.
    """
    if not recipientId:
        return None

    notification = build_notification(
        recipientId=recipientId,
        complaintId=complaintId,
        message=message,
        type=type,
        priority=priority,
    )
    db.add(notification)
    logger.info(
        "notification queued: type=%s recipient=%s complaint=%s priority=%s",
        type, recipientId, complaintId, priority,
    )
    return notification


async def _officers_for_department(
    db: AsyncSession, department: Optional[str]
) -> List[models.MunicipalOfficerModel]:
    """Officers who own a department, falling back to all officers.

    A complaint that reaches nobody is worse than one that reaches too many, so
    an unmatched department broadcasts rather than going silent.
    """
    if department:
        result = await db.execute(
            select(models.MunicipalOfficerModel).where(
                models.MunicipalOfficerModel.department == department
            )
        )
        officers = list(result.scalars().all())
        if officers:
            return officers

        logger.info(
            "no officer owns department '%s'; notifying all officers", department
        )

    result = await db.execute(select(models.MunicipalOfficerModel))
    return list(result.scalars().all())


# --- Event fan-out ------------------------------------------------------


async def notify_new_complaint(
    db: AsyncSession, complaint: models.ComplaintModel
) -> List[models.NotificationModel]:
    """Tell the responsible officers that a complaint needs triage."""
    department = complaint.category.department if complaint.category else None
    officers = await _officers_for_department(db, department)

    severity = _severity_name(complaint)
    category_name = complaint.category.name if complaint.category else "Uncategorised"
    location = complaint.location.address if complaint.location else "an unspecified location"

    created: List[models.NotificationModel] = []
    for officer in officers:
        notification = add_notification(
            db,
            recipientId=officer.userId,
            complaintId=complaint.complaintId,
            message=(
                f"New {severity} complaint ({complaint.complaintId}) filed: "
                f"{category_name} at {location}."
            ),
            type=TYPE_NEW_COMPLAINT,
            priority=priority_for_severity(severity),
        )
        if notification:
            created.append(notification)

    return created


# How each lifecycle status is presented, as (type, priority, citizen wording).
#
# A table rather than an if/elif chain: adding a member to StatusEnum becomes a
# one-line change here, and the wording stays reviewable by non-developers.
_STATUS_RULES = {
    "PENDING":      (TYPE_STATUS_UPDATE, PRIORITY_NORMAL, "is awaiting review"),
    "UNDER_REVIEW": (TYPE_STATUS_UPDATE, PRIORITY_NORMAL, "is being reviewed by an officer"),
    "ASSIGNED":     (TYPE_ASSIGNMENT,    PRIORITY_NORMAL, "has been assigned to a field worker"),
    "IN_PROGRESS":  (TYPE_STATUS_UPDATE, PRIORITY_NORMAL, "is being worked on right now"),
    "ON_HOLD":      (TYPE_STATUS_UPDATE, PRIORITY_NORMAL, "has been put on hold"),
    # Escalation means the job turned out bigger or more dangerous than expected,
    # so it outranks a routine update in everyone's inbox.
    "ESCALATED":    (TYPE_ESCALATION,    PRIORITY_HIGH,   "has been escalated for specialist attention"),
    "RESOLVED":     (TYPE_RESOLUTION,    PRIORITY_NORMAL, "has been marked resolved"),
    "VERIFIED":     (TYPE_RESOLUTION,    PRIORITY_LOW,    "has been verified and closed"),
    # Reopening means the fix did not hold; the team needs to see it.
    "REOPENED":     (TYPE_STATUS_UPDATE, PRIORITY_HIGH,   "has been reopened"),
    "REJECTED":     (TYPE_STATUS_UPDATE, PRIORITY_NORMAL, "has been rejected"),
}

# Statuses the owning officer is told about: outcomes and problems, not routine
# progress reports from the worker.
_OFFICER_INTEREST = {"RESOLVED", "VERIFIED", "REOPENED", "ESCALATED", "ON_HOLD"}


def notify_status_change(
    db: AsyncSession,
    complaint: models.ComplaintModel,
    new_status,
    *,
    remarks: Optional[str] = None,
    actor: Optional[models.UserModel] = None,
) -> List[models.NotificationModel]:
    """Fan a status change out to everyone with a stake in the complaint.

    Recipients: the citizen who filed it, the assigned field worker, and -- for
    outcomes rather than routine progress -- the owning officer. Whoever
    performed the change is never notified about their own action.
    """
    status_name = _status_name(new_status)
    created: List[models.NotificationModel] = []

    detail = f" Remarks: {remarks}" if remarks else ""

    # Look up how this status should be presented. Unknown statuses still get a
    # notification with neutral wording rather than being silently dropped.
    notif_type, priority, phrasing = _STATUS_RULES.get(
        status_name,
        (TYPE_STATUS_UPDATE, PRIORITY_NORMAL, f"is now marked as {status_name}"),
    )

    actor_id = actor.userId if actor else None

    # 1. The citizen who filed it. Skipped when they made the change themselves
    #    -- under the expanded lifecycle a citizen can set VERIFIED / REOPENED.
    if complaint.citizenId != actor_id:
        citizen_note = add_notification(
            db,
            recipientId=complaint.citizenId,
            complaintId=complaint.complaintId,
            message=f"Your complaint ({complaint.complaintId}) {phrasing}.{detail}",
            type=notif_type,
            priority=priority,
        )
        if citizen_note:
            created.append(citizen_note)

    # 2. The assigned field worker, if somebody else moved it.
    if complaint.fieldWorkerId and complaint.fieldWorkerId != actor_id:
        worker_note = add_notification(
            db,
            recipientId=complaint.fieldWorkerId,
            complaintId=complaint.complaintId,
            message=f"Complaint {complaint.complaintId} assigned to you {phrasing}.{detail}",
            type=notif_type,
            priority=priority,
        )
        if worker_note:
            created.append(worker_note)

    # 3. The owning officer -- only for outcomes and problems. They do not need
    #    a ping every time a worker toggles IN_PROGRESS.
    if (
        status_name in _OFFICER_INTEREST
        and complaint.officerId
        and complaint.officerId != actor_id
    ):
        officer_note = add_notification(
            db,
            recipientId=complaint.officerId,
            complaintId=complaint.complaintId,
            message=f"Complaint {complaint.complaintId} {phrasing}.{detail}",
            type=notif_type,
            priority=priority,
        )
        if officer_note:
            created.append(officer_note)

    return created


def notify_assignment(
    db: AsyncSession,
    complaint: models.ComplaintModel,
    *,
    worker: models.FieldWorkerModel,
    assigned_by: Optional[models.UserModel] = None,
) -> List[models.NotificationModel]:
    """Tell the field worker they have a new task, and the citizen that work started."""
    severity = _severity_name(complaint)
    category_name = complaint.category.name if complaint.category else "Uncategorised"
    location = complaint.location.address if complaint.location else "an unspecified location"
    assigner = f" by {assigned_by.name}" if assigned_by else ""

    created: List[models.NotificationModel] = []

    worker_note = add_notification(
        db,
        recipientId=worker.userId,
        complaintId=complaint.complaintId,
        message=(
            f"New task assigned{assigner}: {complaint.complaintId} ({severity}) - "
            f"{category_name} at {location}."
        ),
        type=TYPE_ASSIGNMENT,
        # A worker's task queue is their whole job, so assignments ride the
        # complaint's own urgency.
        priority=priority_for_severity(severity),
    )
    if worker_note:
        created.append(worker_note)

    citizen_note = add_notification(
        db,
        recipientId=complaint.citizenId,
        complaintId=complaint.complaintId,
        message=(
            f"Your complaint ({complaint.complaintId}) has been assigned to a "
            f"field worker and is now in progress."
        ),
        type=TYPE_ASSIGNMENT,
        priority=PRIORITY_NORMAL,
    )
    if citizen_note:
        created.append(citizen_note)

    return created


async def notify_escalation(
    db: AsyncSession, complaint: models.ComplaintModel, *, severity: str, reason: str
) -> List[models.NotificationModel]:
    """Alert officers when triage rates a complaint HIGH or CRITICAL."""
    department = complaint.category.department if complaint.category else None
    officers = await _officers_for_department(db, department)

    created: List[models.NotificationModel] = []
    for officer in officers:
        notification = add_notification(
            db,
            recipientId=officer.userId,
            complaintId=complaint.complaintId,
            message=(
                f"{severity} priority: complaint {complaint.complaintId} needs urgent "
                f"attention. {reason}"
            ),
            type=TYPE_ESCALATION,
            priority=priority_for_severity(severity),
        )
        if notification:
            created.append(notification)

    return created


async def notify_sla_breach(
    db: AsyncSession,
    complaint: models.ComplaintModel,
    *,
    severity: str,
    overdue_hours: int,
    target_hours: int,
) -> List[models.NotificationModel]:
    """Alert the owning department that a complaint has overrun its SLA.

    Sent to the officer assigned to the complaint if there is one, otherwise to
    every officer in the responsible department -- an overdue complaint with no
    owner is precisely the case that needs escalating.
    """
    if complaint.officerId:
        recipients = [complaint.officerId]
    else:
        department = complaint.category.department if complaint.category else None
        officers = await _officers_for_department(db, department)
        recipients = [officer.userId for officer in officers]

    created: List[models.NotificationModel] = []
    for recipient_id in recipients:
        note = add_notification(
            db,
            recipientId=recipient_id,
            complaintId=complaint.complaintId,
            message=(
                f"SLA breached: complaint {complaint.complaintId} ({severity}) is "
                f"{overdue_hours}h past its {target_hours}h resolution target and "
                f"is still open."
            ),
            type=TYPE_SLA_BREACH,
            priority=priority_for_severity(severity),
        )
        if note:
            created.append(note)

    return created


def notify_feedback(
    db: AsyncSession, complaint: models.ComplaintModel, *, rating: int, comments: Optional[str]
) -> List[models.NotificationModel]:
    """Route citizen feedback to the officer and worker who handled the complaint."""
    detail = f' "{comments}"' if comments else ""
    # Poor ratings are the ones worth interrupting someone for.
    priority = PRIORITY_HIGH if rating <= 2 else PRIORITY_LOW

    created: List[models.NotificationModel] = []
    for recipient_id in {complaint.officerId, complaint.fieldWorkerId}:
        notification = add_notification(
            db,
            recipientId=recipient_id,
            complaintId=complaint.complaintId,
            message=(
                f"Citizen rated complaint {complaint.complaintId} {rating}/5.{detail}"
            ),
            type=TYPE_FEEDBACK,
            priority=priority,
        )
        if notification:
            created.append(notification)

    return created


def notify_merge(
    db: AsyncSession,
    *,
    source: models.ComplaintModel,
    target: models.ComplaintModel,
    actor: Optional[models.UserModel] = None,
    remarks: Optional[str] = None,
) -> List[models.NotificationModel]:
    """Tell both citizens what happened when two reports are merged.

    The citizen whose report was merged away is the one who most needs this --
    without it their complaint simply appears to have been rejected, which is
    the failure mode the frontend specifically warned about.
    """
    created: List[models.NotificationModel] = []
    detail = f" ({remarks})" if remarks else ""

    # The person whose report was closed: point them at the surviving one.
    source_note = add_notification(
        db,
        recipientId=source.citizenId,
        complaintId=source.complaintId,
        message=(
            f"Your complaint ({source.complaintId}) reports the same issue as "
            f"{target.complaintId}, so the two have been merged. Track progress "
            f"on {target.complaintId}.{detail}"
        ),
        type=TYPE_DUPLICATE,
        priority=PRIORITY_NORMAL,
    )
    if source_note:
        created.append(source_note)

    # The surviving report's owner, unless it is the same person.
    if target.citizenId and target.citizenId != source.citizenId:
        target_note = add_notification(
            db,
            recipientId=target.citizenId,
            complaintId=target.complaintId,
            message=(
                f"Another resident reported the same issue as your complaint "
                f"({target.complaintId}). The reports have been merged."
            ),
            type=TYPE_DUPLICATE,
            priority=PRIORITY_LOW,
        )
        if target_note:
            created.append(target_note)

    return created


def notify_recategorized(
    db: AsyncSession,
    complaint: models.ComplaintModel,
    *,
    old_category: str,
    new_category: str,
) -> List[models.NotificationModel]:
    """Tell the citizen their complaint was routed to a different department."""
    created: List[models.NotificationModel] = []
    note = add_notification(
        db,
        recipientId=complaint.citizenId,
        complaintId=complaint.complaintId,
        message=(
            f"Your complaint ({complaint.complaintId}) was recategorised from "
            f"'{old_category}' to '{new_category}' and routed to the right team."
        ),
        type=TYPE_RECATEGORIZED,
        priority=PRIORITY_LOW,
    )
    if note:
        created.append(note)
    return created


# --- Inbox queries ------------------------------------------------------


async def list_for_user(
    db: AsyncSession,
    userId: str,
    *,
    unread_only: bool = False,
    type_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Sequence[models.NotificationModel]:
    """Return a user's notifications, newest first."""
    stmt = (
        select(models.NotificationModel)
        .where(models.NotificationModel.recipientId == userId)
        .order_by(models.NotificationModel.sentAt.desc())
    )

    if unread_only:
        stmt = stmt.where(models.NotificationModel.isRead.is_(False))
    if type_filter:
        stmt = stmt.where(models.NotificationModel.type == type_filter)

    result = await db.execute(stmt.offset(skip).limit(limit))
    return result.scalars().all()


async def unread_count(db: AsyncSession, userId: str) -> int:
    result = await db.execute(
        select(func.count(models.NotificationModel.notificationId)).where(
            models.NotificationModel.recipientId == userId,
            models.NotificationModel.isRead.is_(False),
        )
    )
    return result.scalar_one() or 0


async def get_for_user(
    db: AsyncSession, notificationId: str, userId: str
) -> Optional[models.NotificationModel]:
    """Fetch a notification only if it belongs to this user.

    Ownership is part of the query, so a wrong ID and someone else's ID are
    indistinguishable to the caller -- no probing for valid IDs.
    """
    result = await db.execute(
        select(models.NotificationModel).where(
            models.NotificationModel.notificationId == notificationId,
            models.NotificationModel.recipientId == userId,
        )
    )
    return result.scalar_one_or_none()


async def mark_all_read(db: AsyncSession, userId: str) -> int:
    """Mark every unread notification for a user as read. Returns how many changed."""
    result = await db.execute(
        update(models.NotificationModel)
        .where(
            models.NotificationModel.recipientId == userId,
            models.NotificationModel.isRead.is_(False),
        )
        .values(isRead=True, readAt=_utcnow())
    )
    return result.rowcount or 0
