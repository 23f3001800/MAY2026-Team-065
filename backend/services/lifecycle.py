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


# --- Which moves are legal at all -------------------------------------------
# The role matrix above answers "may THIS PERSON set that status". It does not
# answer "does that move make sense from where the complaint currently is", and
# without the second question the first one is not much of a guard:
#
#   * a complaint could go PENDING -> RESOLVED, closing work no worker was ever
#     dispatched to do, with no assignment and no evidence in between;
#   * a citizen could mark their own newly filed complaint VERIFIED, because the
#     role check only asks whether they own it;
#   * a VERIFIED complaint could be dragged back to IN_PROGRESS, quietly
#     restarting something the citizen was told was finished.
#
# All three were reachable through the ordinary status endpoint. The graph below
# closes them by naming, for each status, the states a complaint may move to.
#
# It is permissive on purpose within a phase -- a worker who fixes something
# without first toggling IN_PROGRESS is doing their job, not breaking a rule --
# and strict at the boundaries, where the phases actually mean something.
_TRANSITIONS = {
    # Intake. A complaint can be triaged, dispatched straight away, escalated
    # on sight, or rejected as spam. It cannot be resolved: nobody has been
    # anywhere near the problem yet.
    StatusEnum.PENDING.name: {
        StatusEnum.UNDER_REVIEW.name,
        StatusEnum.ASSIGNED.name,
        StatusEnum.ESCALATED.name,
        StatusEnum.REJECTED.name,
    },
    StatusEnum.UNDER_REVIEW.name: {
        StatusEnum.PENDING.name,
        StatusEnum.ASSIGNED.name,
        StatusEnum.ESCALATED.name,
        StatusEnum.REJECTED.name,
    },
    # Dispatched. From here the work is real and RESOLVED becomes reachable.
    StatusEnum.ASSIGNED.name: {
        StatusEnum.IN_PROGRESS.name,
        StatusEnum.ON_HOLD.name,
        StatusEnum.ESCALATED.name,
        StatusEnum.RESOLVED.name,
        StatusEnum.UNDER_REVIEW.name,
        StatusEnum.REJECTED.name,
    },
    StatusEnum.IN_PROGRESS.name: {
        StatusEnum.ON_HOLD.name,
        StatusEnum.ESCALATED.name,
        StatusEnum.RESOLVED.name,
        StatusEnum.ASSIGNED.name,
    },
    StatusEnum.ON_HOLD.name: {
        StatusEnum.IN_PROGRESS.name,
        StatusEnum.ASSIGNED.name,
        StatusEnum.ESCALATED.name,
        StatusEnum.RESOLVED.name,
        StatusEnum.REJECTED.name,
    },
    StatusEnum.ESCALATED.name: {
        StatusEnum.ASSIGNED.name,
        StatusEnum.IN_PROGRESS.name,
        StatusEnum.ON_HOLD.name,
        StatusEnum.RESOLVED.name,
        StatusEnum.REJECTED.name,
    },
    # Closure. The citizen either accepts the fix or says it did not hold.
    # Nothing else: an officer who wants to keep working on it reopens it first,
    # which leaves a trace the citizen can see.
    StatusEnum.RESOLVED.name: {
        StatusEnum.VERIFIED.name,
        StatusEnum.REOPENED.name,
    },
    StatusEnum.REOPENED.name: {
        StatusEnum.UNDER_REVIEW.name,
        StatusEnum.ASSIGNED.name,
        StatusEnum.IN_PROGRESS.name,
        StatusEnum.ON_HOLD.name,
        StatusEnum.ESCALATED.name,
        StatusEnum.RESOLVED.name,
        StatusEnum.REJECTED.name,
    },
    # VERIFIED is the end of the line, with one exception: the same problem
    # coming back. That is a genuine event -- a pothole refilled badly reopens
    # within the month -- and forcing the citizen to file a fresh complaint
    # would break the link to the work that failed.
    StatusEnum.VERIFIED.name: {
        StatusEnum.REOPENED.name,
    },
    # REJECTED reopens only into triage, and only for an official (REOPENED is
    # citizen-settable, UNDER_REVIEW is not). That way a citizen cannot overturn
    # a rejection themselves, but an officer can undo a mistaken one.
    StatusEnum.REJECTED.name: {
        StatusEnum.UNDER_REVIEW.name,
    },
}


def allowed_transitions(current_status) -> set:
    """The statuses a complaint in ``current_status`` may move to."""
    return set(_TRANSITIONS.get(status_name(current_status), set()))


def assert_transition_allowed(complaint: models.ComplaintModel, target_status) -> None:
    """Raise 409 unless this move is legal from the complaint's current status.

    409 rather than 400: the request is well formed and would have been fine a
    moment ago -- it conflicts with the state the complaint is in now. That is
    also the honest answer when two officers act on the same complaint at once,
    which is the common way this fires in practice.
    """
    current = status_name(complaint.status)
    target = status_name(target_status)

    # Setting a status to what it already is changes nothing. Treated as
    # allowed so a retried request is not an error; the caller skips the
    # notification fan-out separately.
    if current == target:
        return

    permitted = _TRANSITIONS.get(current)
    if permitted is None:
        # An unmapped status is a bug, not a licence. Fail closed and say so.
        logger.error("no transition rules defined for status %r", current)
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This complaint is in a state that cannot be changed.",
        )

    if target not in permitted:
        readable = ", ".join(sorted(permitted)) if permitted else "nothing"
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=(
                "A complaint that is " + current.lower().replace("_", " ")
                + " cannot be moved to " + target.lower().replace("_", " ")
                + ". Valid next steps: " + readable.lower().replace("_", " ") + "."
            ),
        )


def assert_can_set_status(
    user: models.UserModel,
    complaint: models.ComplaintModel,
    target_status,
) -> None:
    """Raise unless this user may move this complaint to ``target_status``.

    Two independent questions, both of which have to pass: is the move legal
    from where the complaint is (409), and is this person allowed to make it
    (403). The transition is checked first because it is the same answer for
    everybody -- telling an officer they lack permission for a move nobody can
    make would send them looking for the wrong fix.
    """
    target = status_name(target_status)
    official = is_official(user)

    assert_transition_allowed(complaint, target)

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

    The complaint's current status is excluded. Setting a status to what it
    already is IS accepted -- that is what makes a retried request safe -- but
    offering it as a choice is noise: "mark this pending complaint as pending"
    is not an action anybody wants to take.
    """
    current = status_name(complaint.status)
    allowed: list[str] = []
    for member in StatusEnum:
        if member.name == current:
            continue
        try:
            assert_can_set_status(user, complaint, member)
        except HTTPException:
            continue
        allowed.append(member.name)
    return allowed
