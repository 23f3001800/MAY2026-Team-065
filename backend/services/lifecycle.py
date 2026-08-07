"""Complaint lifecycle rules: who may move a complaint into which status.

Extracted from the route so the same rules can be reused by the merge endpoint,
the auto-reopen path and the SLA sweep, and so the permission matrix is
readable in one place instead of being spread through an if/elif chain.

The matrix mirrors the three-phase lifecycle:

    Intake & triage      PENDING -> UNDER_REVIEW
    Action & dispatch    ASSIGNED -> IN_PROGRESS -> ON_HOLD / ESCALATED
    Closure & validation RESOLVED -> VERIFIED / REOPENED / REJECTED
"""

from __future__ import annotations

import logging
from typing import Iterable, Optional

from fastapi import HTTPException, status as http_status

import models
from database import StatusEnum

logger = logging.getLogger(__name__)

# Role groups used by the matrix below.
_OFFICIALS = {"administrator", "officer", "municipal_officer"}


def status_name(value) -> str:
    """Normalise a StatusEnum, plain string, or None to its label."""
    return str(getattr(value, "name", value))


def is_official(user: models.UserModel) -> bool:
    return (user.role or "").lower() in _OFFICIALS


def _is_assigned_worker(user: models.UserModel, complaint: models.ComplaintModel) -> bool:
    return (
        (user.role or "").lower() == "field_worker"
        and complaint.fieldWorkerId == user.userId
    )


def _is_owner(user: models.UserModel, complaint: models.ComplaintModel) -> bool:
    return (user.role or "").lower() == "citizen" and complaint.citizenId == user.userId


# Statuses the citizen who filed the complaint may set (officials may too).
# Verification and reopening are deliberately the citizen's call: they are the
# only party who can confirm the problem is actually gone.
CITIZEN_SETTABLE = {StatusEnum.VERIFIED.name, StatusEnum.REOPENED.name}

# Statuses the assigned field worker may set (officials may too). These are all
# reports about work the worker is personally doing.
WORKER_SETTABLE = {
    StatusEnum.IN_PROGRESS.name,
    StatusEnum.ON_HOLD.name,
    StatusEnum.RESOLVED.name,
    StatusEnum.ESCALATED.name,
}

# Everything else -- triage and dispatch decisions -- is officials only.
OFFICIAL_ONLY = {
    StatusEnum.PENDING.name,
    StatusEnum.UNDER_REVIEW.name,
    StatusEnum.ASSIGNED.name,
    StatusEnum.REJECTED.name,
}


def assert_can_set_status(
    user: models.UserModel,
    complaint: models.ComplaintModel,
    target_status,
) -> None:
    """Raise 403 unless this user may move this complaint to ``target_status``."""
    target = status_name(target_status)
    official = is_official(user)

    if target in CITIZEN_SETTABLE:
        if not (_is_owner(user, complaint) or official):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only the citizen who filed this complaint, or an official, "
                    f"can set it to {target}."
                ),
            )
        return

    if target in WORKER_SETTABLE:
        if not (_is_assigned_worker(user, complaint) or official):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only the assigned field worker, or an official, can set this "
                    f"complaint to {target}."
                ),
            )
        return

    # OFFICIAL_ONLY, plus anything not explicitly classified: fail closed.
    if not official:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=f"Only administrators or municipal officers can set a complaint to {target}.",
        )


def assert_can_view_complaint(
    user: models.UserModel, complaint: models.ComplaintModel
) -> None:
    """Raise 403 unless this user may read this complaint and its sub-resources.

    Readers are: the citizen who filed it, any official, and the field worker
    assigned to it. Other citizens are refused -- complaint text and photos can
    contain addresses and other personal detail.
    """
    if is_official(user):
        return
    if _is_owner(user, complaint):
        return
    if _is_assigned_worker(user, complaint):
        return

    raise HTTPException(
        status_code=http_status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to view this complaint.",
    )


def allowed_statuses_for(
    user: models.UserModel, complaint: models.ComplaintModel
) -> list[str]:
    """List the statuses this user may set on this complaint.

    Used by the UI to render only the transitions a user can actually perform,
    rather than offering all ten and letting most of them 403.
    """
    allowed: list[str] = []
    for member in StatusEnum:
        try:
            assert_can_set_status(user, complaint, member)
        except HTTPException:
            continue
        allowed.append(member.name)
    return allowed
