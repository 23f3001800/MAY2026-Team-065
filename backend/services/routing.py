"""Deciding which officer owns a complaint.

A complaint belongs to a department -- that comes free with the category -- but
until now nothing connected the department to a *person*. ``officerId`` was set
only as a side effect of somebody assigning a field worker, so a complaint that
had not yet been dispatched had no owner at all, and "who is supposed to be
looking at this" had no answer. In practice that meant the officer-interest
notifications (RESOLVED, ESCALATED, ON_HOLD) were silently dropped for every
complaint nobody had touched yet, which are exactly the ones that need chasing.

So ownership is assigned when the complaint is filed, from the category's
department, and it is a real routing decision rather than "the first officer we
found":

* Only officers in the matching department are candidates. A Sanitation officer
  is not a fallback for an Electrical fault.
* Among them, the one carrying the fewest open complaints wins, so a queue
  spreads instead of piling onto whoever happens to sort first.
* Ties break on userId, so the same inputs always produce the same owner --
  which is what makes this testable.

**No owner is a valid outcome.** Three of the five departments in this
deployment currently have no officer at all. Inventing an owner from another
department would put work in front of somebody who cannot action it and, worse,
would make the queue *look* handled. An unowned complaint stays unowned and
stays visible; ``route_unassigned`` picks it up once somebody is hired.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from database import OPEN_STATUSES

logger = logging.getLogger(__name__)


def _normalise(department: Optional[str]) -> str:
    """Fold a department name for comparison.

    Departments are free text in three places -- the category, the officer, and
    the worker's skill set -- and they have been typed by hand in all three.
    "Roads & Transport" and "roads & transport " are the same department, and
    routing that fails on a trailing space is worse than useless because it
    fails silently.
    """
    return " ".join((department or "").split()).strip().lower()


async def _open_load(db: AsyncSession) -> Dict[str, int]:
    """How many still-open complaints each officer currently owns."""
    result = await db.execute(
        select(
            models.ComplaintModel.officerId,
            func.count(models.ComplaintModel.complaintId),
        )
        .where(
            models.ComplaintModel.officerId.is_not(None),
            models.ComplaintModel.status.in_(list(OPEN_STATUSES)),
        )
        .group_by(models.ComplaintModel.officerId)
    )
    return {row[0]: row[1] for row in result.all()}


async def officers_in_department(
    db: AsyncSession, department: Optional[str]
) -> List[models.MunicipalOfficerModel]:
    """Every active officer whose department matches, comparison-folded."""
    wanted = _normalise(department)
    if not wanted:
        return []

    result = await db.execute(select(models.MunicipalOfficerModel))
    return [
        officer
        for officer in result.scalars().all()
        if _normalise(officer.department) == wanted
        and getattr(officer, "isActive", True)
    ]


async def category_ids_for_department(
    db: AsyncSession, department: Optional[str]
) -> List[str]:
    """Every category id filed under this department, comparison-folded.

    A complaint has no department column of its own -- it inherits one through
    its category -- so scoping a query to a department means scoping it to that
    department's categories. Folding happens in Python for the same reason it
    does everywhere else in this module: the strings were typed by hand in two
    places and a trailing space must not silently empty an officer's queue.

    An unknown or blank department yields [], which callers must read as "no
    complaints", never as "no filter".
    """
    wanted = _normalise(department)
    if not wanted:
        return []

    result = await db.execute(select(models.CategoryModel))
    return [
        category.categoryId
        for category in result.scalars().all()
        if _normalise(category.department) == wanted
    ]


async def choose_officer(
    db: AsyncSession,
    department: Optional[str],
    *,
    load: Optional[Dict[str, int]] = None,
) -> Optional[models.MunicipalOfficerModel]:
    """The officer who should own a complaint in this department, or None.

    ``load`` lets a caller routing many complaints at once compute the workload
    map a single time; without it the map is queried per call, which is fine for
    the one-complaint case that runs on filing.
    """
    candidates = await officers_in_department(db, department)
    if not candidates:
        return None

    if load is None:
        load = await _open_load(db)

    return min(candidates, key=lambda o: (load.get(o.userId, 0), o.userId))


async def assign_owner(
    db: AsyncSession, complaint: models.ComplaintModel
) -> Optional[models.MunicipalOfficerModel]:
    """Give a complaint its department's officer. Does not commit.

    Never overwrites an existing owner: reassignment is a deliberate act, and
    silently moving a complaint out from under the officer already working it is
    exactly the kind of thing nobody notices until the work is dropped.
    """
    if complaint.officerId:
        return None

    department = complaint.category.department if complaint.category else None
    officer = await choose_officer(db, department)

    if officer is None:
        logger.info(
            "complaint %s not routed: no active officer in department %r",
            complaint.complaintId, department,
        )
        return None

    complaint.officerId = officer.userId
    logger.info(
        "complaint %s routed to officer %s (%s)",
        complaint.complaintId, officer.userId, department,
    )
    return officer


def same_department(left: Optional[str], right: Optional[str]) -> bool:
    """Are these two department names the same, ignoring case and spacing?"""
    return _normalise(left) == _normalise(right)


async def reroute_owner(
    db: AsyncSession, complaint: models.ComplaintModel, department: Optional[str]
) -> Optional[models.MunicipalOfficerModel]:
    """Move ownership to an officer in ``department``. Does not commit.

    Unlike ``assign_owner`` this DOES replace an existing owner -- that is the
    point, since it runs when a complaint has been recategorised into another
    department and the previous owner can no longer action it.

    If the new department has nobody, ownership is cleared rather than left with
    the old officer. Leaving it would be quietly wrong in the most damaging way:
    the complaint would look owned and appear on a dashboard belonging to
    somebody with no authority over it, so nobody would chase it.
    """
    officer = await choose_officer(db, department)

    previous = complaint.officerId
    complaint.officerId = officer.userId if officer else None

    if officer is None:
        logger.info(
            "complaint %s recategorised into %r, which has no officer; ownership cleared",
            complaint.complaintId, department,
        )
    else:
        logger.info(
            "complaint %s reassigned from officer %s to %s (%s)",
            complaint.complaintId, previous, officer.userId, department,
        )

    return officer


async def route_unassigned(db: AsyncSession, *, limit: int = 500) -> dict:
    """Give an owner to every open complaint that has none. Does not commit.

    Needed because ownership was introduced after complaints already existed --
    without this, every complaint filed before the change stays permanently
    ownerless and its officer notifications keep going nowhere.

    Load is recomputed as it goes, so routing fifty backlogged complaints
    spreads them rather than handing all fifty to whoever was quietest at the
    start.
    """
    result = await db.execute(
        select(models.ComplaintModel)
        .where(
            models.ComplaintModel.officerId.is_(None),
            models.ComplaintModel.status.in_(list(OPEN_STATUSES)),
        )
        .order_by(models.ComplaintModel.createdAt.asc())
        .limit(limit)
    )
    complaints = list(result.scalars().all())

    load = await _open_load(db)
    routed = 0
    skipped: Dict[str, int] = {}

    for complaint in complaints:
        category = await db.get(models.CategoryModel, complaint.categoryId)
        department = category.department if category else None

        officer = await choose_officer(db, department, load=load)
        if officer is None:
            key = department or "(no category)"
            skipped[key] = skipped.get(key, 0) + 1
            continue

        complaint.officerId = officer.userId
        load[officer.userId] = load.get(officer.userId, 0) + 1
        routed += 1

    return {
        "considered": len(complaints),
        "routed": routed,
        # Keyed by department so the answer to "why is this still unowned" is in
        # the response rather than only in the logs: these are the departments
        # with nobody to route to.
        "unroutable": skipped,
    }
