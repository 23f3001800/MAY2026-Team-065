from fastapi import (
    FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header, Query,
)
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.middleware.cors import CORSMiddleware 
import uuid 
from passlib.context import CryptContext
from sqlalchemy import select, or_
from sqlalchemy import func
from typing import List
from typing import Optional
from datetime import date, datetime, timedelta, timezone
import jwt
from sqlalchemy.orm import selectinload
import os
import shutil
import json
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectin_polymorphic

import asyncio
import logging

from database import (
    engine, Base, AsyncSessionLocal, StatusEnum, SeverityEnum,
    OPEN_STATUSES, TERMINAL_STATUSES,
)
import models
import schemas
import security
import migrations

from security import get_password_hash

# Shared dependencies live in dependencies.py so the routers can use them
# without importing this module (which would be circular). Re-exported here so
# existing imports of `main.get_current_user` keep working.
from dependencies import get_current_user, get_db, oauth2_scheme, require_roles

from ai.provider import highest_severity
from ai.service import AIService
from routers import ai as ai_router
from routers import analytics as analytics_router
from routers import notifications as notifications_router
from services import lifecycle
from services import notifications as notification_service
from services import sla as sla_service
from services import triage as triage_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Municipal Complaint Management API")
# Create a folder to store images
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

origins = [
    "http://localhost:3000",  
    "http://localhost:5173", 
    "http://localhost:8080", 
    "*"                      
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       
    allow_credentials=True,      
    allow_methods=["*"],         
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # create_all() only creates missing tables -- it never alters existing ones.
    # Databases created before the AI/notification columns existed need this.
    await migrations.run_migrations(engine)

    status_report = AIService().status()
    logger.info(
        "AI subsystem ready (provider=%s, llm_available=%s, model=%s)",
        status_report["provider"],
        status_report["llm"]["available"],
        status_report["llm"]["model"],
    )

    # Start the SLA sweeper. Held on app.state so shutdown can stop it cleanly.
    # Disabled with SLA_ENABLED=false when an external cron drives
    # POST /admin/sla/sweep instead (e.g. when running multiple API instances).
    app.state.sla_stop_event = asyncio.Event()
    app.state.sla_task = None
    if sla_service.is_enabled():
        app.state.sla_task = asyncio.create_task(
            sla_service.sweep_loop(app.state.sla_stop_event)
        )
    else:
        logger.info("SLA sweeper disabled (SLA_ENABLED=false)")


@app.on_event("shutdown")
async def shutdown():
    """Stop the SLA sweeper so the process exits promptly."""
    stop_event = getattr(app.state, "sla_stop_event", None)
    task = getattr(app.state, "sla_task", None)

    if stop_event:
        stop_event.set()

    if task:
        try:
            # The loop waits on the event, so it returns quickly; the timeout is
            # only a backstop against a sweep hanging on a slow query.
            await asyncio.wait_for(task, timeout=10)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            task.cancel()
            logger.warning("SLA sweeper did not stop in time; cancelled")

# for reset password
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

### Registeration Api
# Sort keys accepted by GET /complaints/. "expectedResolution" is served by a
# Python sort (see the handler) because the deadline is derived from severity,
# which has no meaningful SQL ordering of its own.
# Statuses a complaint can be bulk-assigned FROM: nobody is working it yet.
# ASSIGNED is excluded on purpose -- it already has a worker, and replacing them
# is a per-complaint decision, not a batch one.
ASSIGNABLE_STATUSES = {
    StatusEnum.PENDING.name,
    StatusEnum.UNDER_REVIEW.name,
    StatusEnum.REOPENED.name,
    StatusEnum.ESCALATED.name,
}

_COMPLAINT_SORTS = ("created", "aiConfidence", "expectedResolution")

# Ceiling on the rows pulled back for a Python-side sort. Beyond this the
# request is an accidental full-table export, and the answer is a real SQL
# ordering rather than a bigger buffer.
_MAX_PYTHON_SORT = 2000

# Mean Earth radius, km. Used by the equirectangular approximation below.
_EARTH_RADIUS_KM = 6371.0


def _distance_km(lat: float, lng: float, location) -> Optional[float]:
    """Great-circle distance from (lat, lng) to a complaint's location.

    Equirectangular approximation rather than full haversine: over the tens of
    kilometres a city spans the difference is metres, and this is only ever used
    to order a worker's task list. Returns None when the location has no usable
    coordinates -- never 0.0, which would sort an unknown location to the front
    as if the worker were standing on it.
    """
    if location is None:
        return None
    try:
        target_lat = float(location.latitude)
        target_lng = float(location.longitude)
    except (TypeError, ValueError):
        return None

    x = math.radians(target_lng - lng) * math.cos(math.radians((lat + target_lat) / 2))
    y = math.radians(target_lat - lat)
    return round(math.sqrt(x * x + y * y) * _EARTH_RADIUS_KM, 2)


@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register_user(user: schemas.UserRegister, db: AsyncSession = Depends(get_db)):
    stmt = select(models.UserModel).where(models.UserModel.email == user.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = security.get_password_hash(user.password)
    generated_user_id = str(uuid.uuid4())

    if user.role.lower() == "citizen":
        db_user = models.CitizenModel(
            userId=generated_user_id, 
            name=user.name,
            email=user.email,
            phone=user.phone,
            passwordHash=hashed_pw,
            role="citizen",
            address=user.address
        )
    else:
        raise HTTPException(status_code=400, detail="Only citizen registration is currently supported.")

    db.add(db_user)
    await db.commit()
    return {"message": "Citizen registered successfully. You may now log in.", "userId": generated_user_id}

# We map 'username' to the user's email address
@app.post("/auth/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    stmt = select(models.UserModel).where(models.UserModel.email == form_data.username)
    result = await db.execute(stmt)
    db_user = result.scalar_one_or_none()

    if not db_user or not security.verify_password(form_data.password, db_user.passwordHash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # A suspended account must not get a token. Checked AFTER the password so a
    # wrong password and a suspended account are indistinguishable to someone
    # probing for valid emails -- and 403 rather than 401, because the
    # credentials were correct and retrying with a different password will not
    # help. `is False` rather than `not`: a NULL here means the migration
    # backfill has not run, and refusing every login on a half-migrated
    # database would be a worse failure than allowing one.
    if db_user.isActive is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been suspended. Contact an administrator.",
        )

    access_token = security.create_access_token(
        data={
            "sub": db_user.email, 
            "userId": db_user.userId,
            "role": db_user.role
        }
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


# get_current_user now lives in dependencies.py (imported above) so routers can
# share it without importing this module.


## Allows a logged-in citizen to submit a new complaint
@app.post("/complaints/", response_model=schemas.ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    complaint_data: schemas.ComplaintCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user) 
):  
    if current_user.role.lower() != "citizen":
        raise HTTPException(status_code=403, detail="Only citizens can file new complaints.")

    # Validate the category up front: without this an unknown ID surfaces as a
    # raw foreign-key IntegrityError (a 500) instead of a clear 404.
    category = await db.get(models.CategoryModel, complaint_data.categoryId)
    if category is None:
        raise HTTPException(
            status_code=404,
            detail=f"Category '{complaint_data.categoryId}' does not exist.",
        )

    new_location = models.LocationModel(
        latitude=complaint_data.location.latitude,
        longitude=complaint_data.location.longitude,
        address=complaint_data.location.address
    )
    db.add(new_location)
    await db.flush()

    complaint_id = f"CMP-{str(uuid.uuid4())[:6].upper()}"
    new_complaint = models.ComplaintModel(
        complaintId=complaint_id,
        description=complaint_data.description,
        categoryId=complaint_data.categoryId,
        citizenId=current_user.userId,
        locationId=new_location.locationId,
        status="PENDING",
        severity="LOW"
    )
    db.add(new_complaint)
    await db.flush()

    # Run AI triage before committing so the complaint is stored already
    # prioritised. Wrapped defensively: triage is an enhancement, and a failure
    # in it must never stop a citizen from filing a complaint.
    service = AIService()
    triage_result = None
    if service.settings.auto_triage_on_create:
        try:
            categories = await triage_service.load_categories(db)
            candidates = await triage_service.load_duplicate_candidates(
                db,
                exclude_complaint_id=complaint_id,
                window_days=service.settings.duplicate_window_days,
            )
            triage_result = await service.triage(
                complaint_data.description,
                categories,
                duplicate_candidates=candidates,
                latitude=complaint_data.location.latitude,
                longitude=complaint_data.location.longitude,
                categoryId=complaint_data.categoryId,
            )
            triage_service.apply_triage(
                new_complaint,
                triage_result,
                db=db,
                autolink_threshold=service.settings.duplicate_autolink_threshold,
            )
        except Exception:
            logger.exception(
                "AI triage failed for %s; filing it with default severity", complaint_id
            )
            triage_result = None

    # Load relationships the notification messages read (category, location).
    await db.refresh(new_complaint, ["category", "location"])

    await notification_service.notify_new_complaint(db, new_complaint)

    if triage_result and triage_result.severity.severity in {"HIGH", "CRITICAL"}:
        await notification_service.notify_escalation(
            db,
            new_complaint,
            severity=triage_result.severity.severity,
            reason=triage_result.severity.reason,
        )

    await db.commit()

    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaint_id)
        .options(selectinload(models.ComplaintModel.location), selectinload(models.ComplaintModel.category))
    )
    result = await db.execute(stmt)

    return result.scalar_one()

# If a Citizen asks to see complaints, the API should only return the complaints they personally submitted.
# If an Administrator asks to see complaints, the API should return everyone's complaints so they can manage the city.
# Fetch complaints dynamically based on the user's role 
@app.get("/complaints/", response_model=List[schemas.ComplaintResponse])
async def get_complaints(
    status_: Optional[str] = Query(None, alias="status", description="StatusEnum name"),
    categoryId: Optional[str] = Query(None),
    severity: Optional[str] = Query(None, description="SeverityEnum name"),
    from_: Optional[date] = Query(None, alias="from", description="createdAt on or after"),
    to: Optional[date] = Query(None, description="createdAt on or before (inclusive)"),
    aiConfidenceMax: Optional[float] = Query(
        None, ge=0.0, le=1.0,
        description="Only complaints the classifier was at most this sure about",
    ),
    aiConfidenceMin: Optional[float] = Query(None, ge=0.0, le=1.0),
    sort: str = Query(
        "created",
        description="created (newest first) | aiConfidence | expectedResolution",
    ),
    order: str = Query("desc", description="asc | desc"),
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """List complaints, scoped by role and optionally filtered.

    Every filter is optional and omitting all of them preserves the previous
    behaviour exactly -- the frontend paginates client-side today, and breaking
    that on deploy would empty every dashboard.

    ``limit`` is capped at 500. Without a ceiling this endpoint is an accidental
    full-table export as the complaint count grows.
    """
    stmt = select(models.ComplaintModel).options(
        selectinload(models.ComplaintModel.location), 
        selectinload(models.ComplaintModel.category)
    )

    if current_user.role.lower() == "citizen":
        stmt = stmt.where(models.ComplaintModel.citizenId == current_user.userId)
    elif current_user.role.lower() in ["administrator", "officer"]:
        pass 
    else:
        raise HTTPException(status_code=403, detail="Unauthorized role.")

    # Unknown enum names are rejected rather than ignored: silently returning
    # everything for a typo'd status looks like "there are no filters applied",
    # which is a worse failure than a 422.
    if status_:
        try:
            stmt = stmt.where(models.ComplaintModel.status == StatusEnum[status_.upper()])
        except KeyError:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown status '{status_}'. Expected one of: "
                       + ", ".join(s.name for s in StatusEnum),
            )
    if severity:
        try:
            stmt = stmt.where(models.ComplaintModel.severity == SeverityEnum[severity.upper()])
        except KeyError:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown severity '{severity}'. Expected one of: "
                       + ", ".join(s.name for s in SeverityEnum),
            )
    if categoryId:
        stmt = stmt.where(models.ComplaintModel.categoryId == categoryId)
    if from_:
        stmt = stmt.where(
            models.ComplaintModel.createdAt >= datetime.combine(from_, datetime.min.time())
        )
    if to:
        # Inclusive of the whole day -- "to the 11th" means through the 11th.
        stmt = stmt.where(
            models.ComplaintModel.createdAt <= datetime.combine(to, datetime.max.time())
        )

    # Confidence filtering. A complaint with NULL aiConfidence was never
    # classified -- triage was off, or it predates triage -- which is a
    # different thing from "classified badly". Excluding NULLs keeps the two
    # queues apart; treating NULL as 0.0 would bury the genuinely doubtful
    # classifications under complaints the model never saw.
    if aiConfidenceMax is not None:
        stmt = stmt.where(
            models.ComplaintModel.aiConfidence.is_not(None),
            models.ComplaintModel.aiConfidence <= aiConfidenceMax,
        )
    if aiConfidenceMin is not None:
        stmt = stmt.where(
            models.ComplaintModel.aiConfidence.is_not(None),
            models.ComplaintModel.aiConfidence >= aiConfidenceMin,
        )

    sort_key = (sort or "created").strip()
    descending = (order or "desc").strip().lower() != "asc"
    if sort_key not in _COMPLAINT_SORTS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown sort '{sort}'. Expected one of: " + ", ".join(_COMPLAINT_SORTS),
        )

    if sort_key == "aiConfidence":
        # asc puts the least confident first, which is the whole point: an
        # officer wants to re-check what the model was unsure about. Unclassified
        # complaints sort last either way rather than masquerading as certain.
        column = models.ComplaintModel.aiConfidence
        stmt = stmt.order_by(
            column.desc().nullslast() if descending else column.asc().nullslast(),
            models.ComplaintModel.createdAt.desc(),
        )
    elif sort_key == "expectedResolution":
        # The deadline is createdAt + a per-severity offset, and severity is an
        # enum with no useful SQL ordering, so this cannot be expressed as an
        # ORDER BY. Sorted in Python below, which is why it forces a bounded
        # result set rather than silently sorting one page of an unsorted table.
        stmt = stmt.order_by(models.ComplaintModel.createdAt.desc())
    else:
        column = models.ComplaintModel.createdAt
        stmt = stmt.order_by(column.desc() if descending else column.asc())
    if sort_key == "expectedResolution":
        # Sort the whole (filtered) set before paginating, or page 1 would hold
        # the newest complaints sorted among themselves rather than the most
        # urgent overall. Capped so this cannot become a full-table sort.
        result = await db.execute(stmt.limit(_MAX_PYTHON_SORT))
        rows = list(result.scalars().all())
        far_future = datetime.max
        rows.sort(
            key=lambda c: c.expectedResolutionAt or far_future,
            reverse=descending,
        )
        return rows[offset: offset + limit] if limit else rows[offset:]

    if offset:
        stmt = stmt.offset(offset)
    if limit:
        stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    return result.scalars().all()

### Returns a high-level dashboard of city-wide complaint statistics.
@app.get("/admin/analytics")
async def get_city_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
  
    if current_user.role.lower() != "administrator":
        raise HTTPException(status_code=403, detail="Only administrators can view city analytics.")

    total_stmt = select(func.count(models.ComplaintModel.complaintId))
    total_result = await db.execute(total_stmt)
    total_complaints = total_result.scalar_one()

    status_stmt = (
        select(models.ComplaintModel.status, func.count(models.ComplaintModel.complaintId))
        .group_by(models.ComplaintModel.status)
    )
    status_result = await db.execute(status_stmt)
    status_counts = {str(row[0].name if hasattr(row[0], 'name') else row[0]): row[1] for row in status_result.all()}

    severity_stmt = (
        select(models.ComplaintModel.severity, func.count(models.ComplaintModel.complaintId))
        .group_by(models.ComplaintModel.severity)
    )
    severity_result = await db.execute(severity_stmt)
    severity_counts = {str(row[0].name if hasattr(row[0], 'name') else row[0]): row[1] for row in severity_result.all()}

    return {
        "overview": {
            "totalComplaints": total_complaints
        },
        "breakdownByStatus": status_counts,
        "breakdownBySeverity": severity_counts
    }

#  Allows a Municipal Officer to assign a Field Worker to a specific complaint with skill validation. 
class AssignmentRefused(Exception):
    """A single complaint could not be assigned. Carries the reason verbatim.

    Exists so bulk assignment can collect per-complaint failures instead of
    aborting the whole batch, while the single-complaint endpoint turns the same
    reason into its 400.
    """

    def __init__(self, reason: str, status_code: int = 400):
        super().__init__(reason)
        self.reason = reason
        self.status_code = status_code


def _apply_assignment(
    db: AsyncSession,
    complaint: models.ComplaintModel,
    field_worker: models.FieldWorkerModel,
    current_user: models.UserModel,
    *,
    force: bool = False,
) -> None:
    """Assign one complaint to one worker, with history and notifications.

    Every assignment path goes through here. When this logic lived inline in the
    single-complaint endpoint, adding bulk assignment meant copying the skill
    check, the history row and the notification call -- and a copy drifts from
    its original within a sprint.

    Does NOT commit. The caller decides how a failure affects the batch.
    """
    # Terminal complaints are finished. Reassigning one quietly reopens work
    # somebody already signed off, so it is refused rather than silently allowed.
    current_status = str(getattr(complaint.status, "name", complaint.status) or "")
    if current_status in {st.name for st in TERMINAL_STATUSES}:
        raise AssignmentRefused("Complaint is already " + current_status.lower() + ".")

    # Already dispatched work is not bulk-assignable.
    #
    # Bulk assignment is for clearing a queue of untouched complaints. Sweeping
    # up one that a worker has already started and handing it to someone else
    # discards their progress silently -- and in a batch of fifty nobody would
    # notice which ones moved. Reassigning live work is a deliberate,
    # one-at-a-time decision, so it stays on the single-complaint endpoint via
    # `force`.
    if not force:
        if complaint.fieldWorkerId:
            raise AssignmentRefused(
                "Already assigned to a field worker. Reassign it individually if that is intended."
            )
        if current_status not in ASSIGNABLE_STATUSES:
            raise AssignmentRefused(
                "Status is " + current_status.lower()
                + "; only complaints not yet being worked can be assigned in bulk."
            )

    department = complaint.category.department if complaint.category else None
    if department and department not in (field_worker.skillSet or ""):
        raise AssignmentRefused(
            "Skill mismatch: this needs '" + department + "', the worker covers '"
            + (field_worker.skillSet or "nothing") + "'."
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    complaint.fieldWorkerId = field_worker.userId
    if current_user.role.lower() == "officer":
        complaint.officerId = current_user.userId
    complaint.status = "ASSIGNED"
    complaint.updatedAt = now

    db.add(models.StatusHistoryModel(
        historyId="HIST-" + str(uuid.uuid4())[:8].upper(),
        complaintId=complaint.complaintId,
        status="ASSIGNED",
        remarks="Task dispatched to Field Worker: " + field_worker.userId,
        timestamp=now,
    ))

    # Tell the worker they have a task, and the citizen that work has started.
    notification_service.notify_assignment(
        db, complaint, worker=field_worker, assigned_by=current_user
    )


@app.patch("/complaints/{complaintId}/assign", response_model=schemas.ComplaintResponse)
async def assign_field_worker(
    complaintId: str,
    assignment: schemas.ComplaintAssign,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    
    if current_user.role.lower() not in ["officer", "administrator"]:
        raise HTTPException(status_code=403, detail="Only Municipal Officers can assign tasks.")

    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaintId)
        .options(selectinload(models.ComplaintModel.location), selectinload(models.ComplaintModel.category))
    )
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    worker_stmt = select(models.FieldWorkerModel).where(models.FieldWorkerModel.userId == assignment.fieldWorkerId)
    worker_result = await db.execute(worker_stmt)
    field_worker = worker_result.scalar_one_or_none()
    
    if not field_worker:
        raise HTTPException(status_code=404, detail="Field Worker not found.")
        
    try:
        _apply_assignment(db, complaint, field_worker, current_user, force=True)
    except AssignmentRefused as refused:
        raise HTTPException(status_code=refused.status_code, detail=refused.reason)

    await db.commit()
    await db.refresh(complaint)

    return complaint


@app.patch("/complaints/bulk-status", response_model=schemas.BulkStatusResult)
async def bulk_status(
    payload: schemas.BulkStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Advance several complaints of the same kind to the next status.

    This is what bulk assignment was being used for, and it is a different
    operation: assignment picks who does the work, this moves work already in
    flight along. Conflating them meant an officer trying to advance ten
    in-progress jobs ended up reassigning them all to one worker.

    `fromStatus` must match each complaint's current status. Anything that has
    moved since the officer's list was drawn is refused with its actual state
    rather than being dragged from a status they never saw -- a stale screen is
    the normal case here, not an edge case.

    Every transition goes through the same lifecycle rules as the
    single-complaint endpoint, so bulk cannot reach a state the individual
    action would refuse.
    """
    require_roles(current_user, ("officer", "administrator"), "change complaint status")

    from_name = payload.fromStatus.name
    to_name = payload.toStatus.name
    if from_name == to_name:
        raise HTTPException(status_code=422, detail="fromStatus and toStatus are the same.")

    wanted = list(dict.fromkeys(payload.complaintIds))
    result = await db.execute(
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId.in_(wanted))
        .options(
            selectinload(models.ComplaintModel.location),
            selectinload(models.ComplaintModel.category),
        )
    )
    found = {c.complaintId: c for c in result.scalars().all()}

    updated: List[str] = []
    failed: List[schemas.BulkAssignFailure] = []
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    for complaint_id in wanted:
        complaint = found.get(complaint_id)
        if complaint is None:
            failed.append(schemas.BulkAssignFailure(
                complaintId=complaint_id, reason="Complaint not found."))
            continue

        current = str(getattr(complaint.status, "name", complaint.status) or "")
        if current != from_name:
            failed.append(schemas.BulkAssignFailure(
                complaintId=complaint_id,
                reason="Expected " + from_name.lower() + " but it is " + current.lower() + ".",
            ))
            continue

        try:
            lifecycle.assert_can_set_status(current_user, complaint, to_name)
        except HTTPException as exc:
            failed.append(schemas.BulkAssignFailure(
                complaintId=complaint_id, reason=str(exc.detail)))
            continue

        complaint.status = to_name
        complaint.updatedAt = now
        # resolvedAt is stamped on the FIRST resolution only, matching the
        # single-complaint path -- a reopen-and-fix cycle keeps the original
        # turnaround rather than resetting it.
        if to_name == StatusEnum.RESOLVED.name and complaint.resolvedAt is None:
            complaint.resolvedAt = now

        db.add(models.StatusHistoryModel(
            historyId="HIST-" + str(uuid.uuid4())[:8].upper(),
            complaintId=complaint_id,
            status=to_name,
            remarks=payload.remarks or ("Bulk update by " + (current_user.name or "an officer")),
            timestamp=now,
        ))
        notification_service.notify_status_change(
            db, complaint, new_status=to_name,
            remarks=payload.remarks, actor=current_user,
        )
        updated.append(complaint_id)

    await db.commit()

    return schemas.BulkStatusResult(
        updated=updated,
        failed=failed,
        updatedCount=len(updated),
        failedCount=len(failed),
    )


@app.patch("/complaints/bulk-assign", response_model=schemas.BulkAssignResult)
async def bulk_assign(
    payload: schemas.BulkAssign,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Assign many complaints to one field worker in one call.

    Complaints in the same ward usually go to the same worker, and doing that
    one request at a time is slow enough that officers batch it up mentally and
    then lose track of half of it.

    Partial success is the normal outcome and is reported explicitly: one
    already-resolved complaint does not fail the other nineteen. The whole call
    is refused only when the worker id is bad, because then nothing in the batch
    could succeed.

    Each assignment runs through the same `_apply_assignment` path as the
    single-complaint endpoint, so the skill check, status history and
    notifications are identical.
    """
    require_roles(current_user, ("officer", "administrator"), "assign complaints")

    worker_result = await db.execute(
        select(models.FieldWorkerModel)
        .where(models.FieldWorkerModel.userId == payload.fieldWorkerId)
    )
    field_worker = worker_result.scalar_one_or_none()
    if not field_worker:
        raise HTTPException(status_code=404, detail="Field Worker not found.")

    # Deduplicated, preserving the order sent, so the same id twice does not
    # produce two history rows and two notifications.
    wanted = list(dict.fromkeys(payload.complaintIds))

    result = await db.execute(
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId.in_(wanted))
        .options(
            selectinload(models.ComplaintModel.location),
            selectinload(models.ComplaintModel.category),
        )
    )
    found = {c.complaintId: c for c in result.scalars().all()}

    assigned = []
    failed = []

    for complaint_id in wanted:
        complaint = found.get(complaint_id)
        if complaint is None:
            failed.append(schemas.BulkAssignFailure(
                complaintId=complaint_id, reason="Complaint not found."
            ))
            continue
        try:
            _apply_assignment(db, complaint, field_worker, current_user)
        except AssignmentRefused as refused:
            failed.append(schemas.BulkAssignFailure(
                complaintId=complaint_id, reason=refused.reason
            ))
            continue
        assigned.append(complaint_id)

    # One commit for the batch, so a crash mid-loop cannot leave half the ward
    # assigned with no record of which half.
    await db.commit()

    return schemas.BulkAssignResult(
        assigned=assigned,
        failed=failed,
        assignedCount=len(assigned),
        failedCount=len(failed),
    )


### Field worker create route
   ## Allows an Administrator to register a new Field Worker into the system. 
@app.post("/workers/", response_model=schemas.FieldWorkerResponse, status_code=status.HTTP_201_CREATED)
async def create_field_worker(
    worker: schemas.FieldWorkerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):    
    if current_user.role.lower() != "administrator":
        raise HTTPException(status_code=403, detail="Only administrators can register field workers.")

    worker_id = str(uuid.uuid4())
    
    new_worker = models.FieldWorkerModel(
        userId=worker_id,
        name=worker.name,
        email=worker.email,
        phone=worker.phone,
        # passwordHash=worker.password, 
        passwordHash=get_password_hash(worker.password),
        role="field_worker",          
        skillSet=worker.skillSet,
        availabilityStatus="AVAILABLE"
    )
    
    db.add(new_worker)
    await db.commit()
    await db.refresh(new_worker)
    
    return new_worker

# Get Api for worker
#  Fetch a list of field workers, optionally filtered by their specific skills. 
@app.get("/workers/", response_model=List[schemas.FieldWorkerResponse])
async def get_field_workers(
    skillSet: Optional[str] = None, 
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):

    if current_user.role.lower() not in ["administrator", "officer"]:
        raise HTTPException(status_code=403, detail="Not authorized to view field workers.")

    stmt = select(models.FieldWorkerModel)
    
    if skillSet:
        stmt = stmt.where(models.FieldWorkerModel.skillSet.ilike(f"%{skillSet}%"))
    result = await db.execute(stmt)
    return result.scalars().all()

# Getapi: returns the complaints assigned to the specific Field Worker who is currently logged in
@app.get("/complaints/escalations", response_model=schemas.EscalationResponse)
async def get_escalations(
    includeAtRisk: bool = Query(
        False, description="Also return open complaints close to their deadline"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Open complaints that have missed their SLA deadline, worst first.

    The SLA sweep already detects breaches and raises notifications, but nothing
    could ASK for the list -- so an officer still found overdue work by
    scrolling the pending queue, which is exactly what they said was the
    problem. This is the query behind that screen.

    Deliberately NOT date-filtered: a complaint from eight months ago that is
    still open is the whole point of the endpoint, and a window would hide it.

    Only OPEN complaints appear. One that was resolved late is history, not a
    queue item; leaving it flagged forever would keep finished work in an
    officer's face and train them to ignore the list.
    """
    require_roles(current_user, ("officer", "administrator"), "view escalations")

    result = await db.execute(
        select(models.ComplaintModel)
        .where(models.ComplaintModel.status.in_([st.name for st in OPEN_STATUSES]))
        .options(
            selectinload(models.ComplaintModel.category),
            selectinload(models.ComplaintModel.location),
        )
    )
    complaints = list(result.scalars().all())

    hours = sla_service.sla_hours()
    breached = []
    at_risk = []

    for complaint in complaints:
        state = sla_service.sla_state(complaint, hours)
        remaining = state["hoursRemaining"]
        if state["expectedResolutionAt"] is None or remaining is None:
            # No createdAt, or no severity to price it from. Reporting it as
            # either breached or safe would be a guess, so it is left out and
            # stays visible in the ordinary queue.
            continue

        item = schemas.EscalationItem(
            complaintId=complaint.complaintId,
            description=complaint.description,
            status=complaint.status,
            severity=complaint.severity,
            createdAt=complaint.createdAt,
            expectedResolutionAt=state["expectedResolutionAt"],
            hoursRemaining=remaining,
            department=complaint.category.department if complaint.category else None,
            categoryName=complaint.category.name if complaint.category else None,
            fieldWorkerId=complaint.fieldWorkerId,
            officerId=complaint.officerId,
            address=complaint.location.address if complaint.location else None,
        )

        if remaining < 0:
            breached.append(item)
        elif includeAtRisk:
            # "At risk" is the last quarter of the window rather than a fixed
            # number of hours: four hours left is nothing on a CRITICAL job and
            # plenty on a LOW one, so a flat threshold would flood the list with
            # routine work while missing the urgent case.
            severity = str(getattr(complaint.severity, "name", complaint.severity) or "LOW")
            window = hours.get(severity, hours["LOW"])
            if window and remaining <= window * 0.25:
                at_risk.append(item)

    # Most overdue first; for at-risk, closest to breaching first.
    breached.sort(key=lambda i: i.hoursRemaining)
    at_risk.sort(key=lambda i: i.hoursRemaining)

    return schemas.EscalationResponse(
        breached=breached,
        atRisk=at_risk,
        breachedCount=len(breached),
        atRiskCount=len(at_risk),
    )


@app.get("/complaints/worker/tasks", response_model=List[schemas.WorkerTaskResponse])
async def get_worker_tasks(
    sort: str = Query("created", description="created | distance"),
    lat: Optional[float] = Query(None, ge=-90, le=90, description="Worker's current latitude"),
    lng: Optional[float] = Query(None, ge=-180, le=180, description="Worker's current longitude"),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """A field worker's assigned complaints.

    ``sort=distance`` orders by how far each job is from the coordinates the
    worker's device reports, nearest first, so a shift can be walked in a
    sensible order instead of by submission time.

    ``lat`` and ``lng`` are REQUIRED for that mode and produce a 422 when
    missing rather than quietly falling back to date order -- a list that looks
    sorted by distance and is not would send someone across the city and back.
    """
    if current_user.role.lower() != "field_worker":
        raise HTTPException(status_code=403, detail="Only field workers can access this feed.")

    sort_key = (sort or "created").strip()
    if sort_key not in ("created", "distance"):
        raise HTTPException(
            status_code=422,
            detail=f"Unknown sort '{sort}'. Expected 'created' or 'distance'.",
        )
    if sort_key == "distance" and (lat is None or lng is None):
        raise HTTPException(
            status_code=422,
            detail="sort=distance requires both lat and lng.",
        )

    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.fieldWorkerId == current_user.userId)
        .options(selectinload(models.ComplaintModel.location), selectinload(models.ComplaintModel.category))
    )
    result = await db.execute(stmt)
    tasks = list(result.scalars().all())

    if sort_key != "distance":
        tasks.sort(key=lambda c: c.createdAt or datetime.min, reverse=True)
        return [schemas.WorkerTaskResponse.model_validate(t) for t in tasks]

    # Distance is computed in Python, not SQL: PostGIS is not installed, and the
    # per-worker task list is tens of rows, not thousands. The same
    # equirectangular approximation /complaints/nearby uses -- at city scale the
    # error is metres.
    payload = []
    for task in tasks:
        km = _distance_km(lat, lng, task.location) if task.location else None
        item = schemas.WorkerTaskResponse.model_validate(task)
        item.distanceKm = km
        payload.append(item)

    # A task with no coordinates cannot be placed in a route, so it sorts last
    # rather than first -- which is what None would do by accident.
    payload.sort(key=lambda t: (t.distanceKm is None, t.distanceKm if t.distanceKm is not None else 0.0))
    return payload

## Reset Password by Admin
    #  Allows an Administrator to securely overwrite a forgotten password.
@app.patch("/users/{userId}/reset-password")
async def reset_user_password(
    userId: str,
    reset_data: schemas.PasswordReset,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    if current_user.role.lower() != "administrator":
        raise HTTPException(status_code=403, detail="Only administrators can perform password resets.")

    stmt = select(models.UserModel).where(models.UserModel.userId == userId)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.passwordHash = get_password_hash(reset_data.newPassword)
    await db.commit()
    return {
        "message": "Password reset successful.",
        "user": user.name,
        "email": user.email,
        "role": user.role
    }

# --- Complaint photo upload -------------------------------------------------
# Only the citizen who filed the complaint, or the field worker assigned to it,
# may attach photos. Shared by both the singular and plural routes below.
async def _load_complaint_for_upload(
    complaintId: str, db: AsyncSession, current_user: models.UserModel
) -> models.ComplaintModel:
    stmt = select(models.ComplaintModel).where(models.ComplaintModel.complaintId == complaintId)
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    is_owner = (current_user.role.lower() == "citizen" and complaint.citizenId == current_user.userId)
    is_assigned_worker = (current_user.role.lower() == "field_worker" and complaint.fieldWorkerId == current_user.userId)

    if not (is_owner or is_assigned_worker):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to upload images to this complaint.",
        )
    return complaint


def _upload_phase(complaint: models.ComplaintModel, uploader: models.UserModel) -> str:
    """Is this photo the reported problem, or evidence the work is done?

    Decided by WHO is uploading, not when. The citizen who filed the complaint
    is documenting the problem; anyone else -- the assigned worker, an office
    -- is documenting the work. Time is not used: a citizen adding a photo afte
    a repair would be misfiled as completion evidence, and a worker uploading
    minutes after the report would be misfiled as the report.

    A citizen uploading to a complaint that is already resolved is still filing
    "report" evidence: they are showing the problem persists, which is the
    reopen case, and calling it proof of completion would be exactly backwards.
    """
    if complaint.citizenId and uploader.userId == complaint.citizenId:
        return "report"
    return "resolution"


def _store_upload(
    complaintId: str,
    file: UploadFile,
    uploadedBy: str,
    phase: str = "report",
) -> models.MediaAttachmentModel:
    """Write one uploaded file to disk and build its MediaAttachment row.

    The stored name is always generated (complaintId + random suffix) and never
    derived from the client-supplied filename, so a crafted name like
    "../../etc/passwd" cannot escape the uploads directory.
    """
    original = file.filename or ""
    extension = original.rsplit(".", 1)[-1].lower() if "." in original else "bin"
    # Keep only characters that are safe in a filename.
    extension = "".join(ch for ch in extension if ch.isalnum())[:8] or "bin"

    safe_filename = f"{complaintId}_{str(uuid.uuid4())[:8]}.{extension}"
    file_path = os.path.join("uploads", safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return models.MediaAttachmentModel(
        mediaId=f"MED-{str(uuid.uuid4())[:6].upper()}",
        complaintId=complaintId,
        fileUrl=f"/uploads/{safe_filename}",
        type=file.content_type,
        uploadedBy=uploadedBy,
        phase=phase,
    )


# Uploads images by worker/citizen -- accepts several files in one request.
# How long a stored idempotency key is honoured. Long enough to cover a worker
# driving out of a dead zone and the phone retrying; short enough that the table
# does not grow without bound.
_IDEMPOTENCY_TTL_HOURS = 24


async def _replay_idempotent(
    db: AsyncSession, key: Optional[str], endpoint: str, user_id: str
) -> Optional[dict]:
    """Return the stored response for this key, or None if it is new.

    Expired keys are treated as new rather than as errors: past the TTL the
    client has long since given up, and refusing the request would be worse than
    letting it through.
    """
    if not key:
        return None

    result = await db.execute(
        select(models.IdempotencyKeyModel).where(
            models.IdempotencyKeyModel.key == key,
            models.IdempotencyKeyModel.endpoint == endpoint,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        return None

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        hours=_IDEMPOTENCY_TTL_HOURS
    )
    if record.createdAt and record.createdAt < cutoff:
        await db.delete(record)
        await db.flush()
        return None

    # A key belongs to whoever first used it. Replaying another user's response
    # would leak their data to anyone who guessed a key.
    if record.userId != user_id:
        raise HTTPException(
            status_code=409,
            detail="This idempotency key was already used by a different account.",
        )

    return json.loads(record.responseJson)


def _remember_idempotent(
    db: AsyncSession, key: Optional[str], endpoint: str, user_id: str, payload: dict
) -> None:
    """Store a response so a retry with the same key replays it."""
    if not key:
        return
    db.add(models.IdempotencyKeyModel(
        key=key,
        endpoint=endpoint,
        userId=user_id,
        responseJson=json.dumps(payload, default=str),
        createdAt=datetime.now(timezone.utc).replace(tzinfo=None),
    ))


@app.post("/complaints/{complaintId}/images", status_code=status.HTTP_201_CREATED)
async def upload_complaint_images(
    complaintId: str,
    files: List[UploadFile] = File(..., description="One or more photos of the issue"),
    remarks: Optional[str] = Form(
        None, description="What the worker wants recorded alongside the evidence"
    ),
    idempotency_key: Optional[str] = Header(
        None,
        alias="Idempotency-Key",
        description="Client-generated id, kept stable across retries of the same upload",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Attach one or more photos to a complaint.

    Safe to retry. A field worker in a weak-signal area will retry a failed
    upload, and without a key a partial success followed by a retry put a second
    copy of the same photo on the complaint -- evidence that looks like two
    separate visits. Send the same ``Idempotency-Key`` on every retry and the
    original response is replayed instead of storing anything again.

    ``remarks`` travels with the files so a retry carries the worker's typed text
    rather than losing it. It is appended to the status history, where it is
    attributable and timestamped, rather than stored as a loose field.
    """
    complaint = await _load_complaint_for_upload(complaintId, db, current_user)

    replayed = await _replay_idempotent(
        db, idempotency_key, f"POST /complaints/{complaintId}/images", current_user.userId
    )
    if replayed is not None:
        return replayed

    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    # Decided once for the request: every file in one upload documents the same
    # side of the work.
    phase = _upload_phase(complaint, current_user)

    uploaded_media = []
    first_image: Optional[tuple] = None  # (bytes, mime) kept for AI analysis

    for file in files:
        # Read once: the stream cannot be rewound after copyfileobj consumes it,
        # and the AI step below needs the same bytes.
        contents = await file.read()
        await file.seek(0)

        new_media = _store_upload(complaintId, file, current_user.userId, phase)
        db.add(new_media)
        uploaded_media.append({"mediaId": new_media.mediaId, "fileUrl": new_media.fileUrl})

        if first_image is None and contents:
            first_image = (contents, file.content_type or "")

    # Run vision analysis on the first photo so triage can use image evidence,
    # not just the citizen's text. Entirely best-effort: any failure (no API
    # key, safety block, upstream error) leaves the upload successful and simply
    # returns no analysis. Uploading a photo must never fail because the model
    # was unavailable.
    ai_analysis = None
    if first_image:
        try:
            ai_analysis = await _analyze_uploaded_photo(db, complaintId, *first_image)
        except Exception:
            logger.exception("photo analysis failed for %s; upload still succeeded", complaintId)

    # The worker's typed note goes into the audit trail, attributed and
    # timestamped, rather than into a field that nothing reads.
    if remarks and remarks.strip():
        db.add(models.StatusHistoryModel(
            historyId="HIST-" + str(uuid.uuid4())[:8].upper(),
            complaintId=complaintId,
            status=str(getattr(complaint.status, "name", complaint.status)),
            remarks=remarks.strip(),
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
        ))

    payload = {
        "message": f"{len(uploaded_media)} image(s) uploaded successfully",
        "mediaAttachments": uploaded_media,
        "aiAnalysis": ai_analysis,
    }

    _remember_idempotent(
        db, idempotency_key, f"POST /complaints/{complaintId}/images",
        current_user.userId, payload,
    )

    await db.commit()

    return payload


async def _analyze_uploaded_photo(
    db: AsyncSession, complaintId: str, contents: bytes, mime_type: str
) -> Optional[dict]:
    """Analyse a freshly uploaded photo and raise severity if it looks worse.

    Severity is only ever raised, never lowered -- the same rule the rest of the
    AI layer follows. A photo showing less than the text described is not
    evidence that the text was wrong.
    """
    service = AIService()
    if not service.llm_available:
        return None

    categories = await triage_service.load_categories(db)
    vision = await service.analyze_image(contents, mime_type, categories)

    if not vision.available:
        return {"available": False, "unavailableReason": vision.unavailableReason}

    result = await db.execute(
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaintId)
        .options(selectinload(models.ComplaintModel.category))
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        return None

    current = lifecycle.status_name(complaint.severity)
    escalated = highest_severity(current, vision.severity)

    # Record what the photo showed regardless, so the officer can see it.
    complaint.aiSummary = (vision.description or complaint.aiSummary or "")[:2000]
    complaint.aiSource = "gemini-vision"
    complaint.aiAnalyzedAt = datetime.now(timezone.utc).replace(tzinfo=None)

    severity_raised = escalated != current
    if severity_raised:
        complaint.severity = escalated
        complaint.aiSeverity = escalated

        triage_service.log_classification(
            db, complaint,
            field="severity",
            ai_value=escalated,
            confidence=vision.confidence,
            source="gemini-vision",
            previous=current,
            new_value=escalated,
        )

        db.add(models.StatusHistoryModel(
            historyId=f"HIST-{str(uuid.uuid4())[:8].upper()}",
            complaintId=complaintId,
            status=complaint.status,
            remarks=f"Severity raised {current} -> {escalated} from photo analysis.",
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
        ))

        if escalated in {"HIGH", "CRITICAL"}:
            await notification_service.notify_escalation(
                db, complaint, severity=escalated,
                reason=f"Photo analysis: {vision.description[:200]}",
            )

    return {
        "available": True,
        "description": vision.description,
        "categoryId": vision.categoryId,
        "severity": vision.severity,
        "confidence": vision.confidence,
        "observations": vision.observations,
        "severityRaised": severity_raised,
        "source": vision.source,
    }


# Kept for backwards compatibility: the frontend still posts a single file to
# this route. It delegates to the same storage helper as /images, so there is
# only one implementation to maintain. Prefer /images for new work.
@app.post(
    "/complaints/{complaintId}/image",
    status_code=status.HTTP_201_CREATED,
    deprecated=True,
    summary="Upload a single image (deprecated -- use /images)",
)
async def upload_complaint_image(
    complaintId: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    complaint = await _load_complaint_for_upload(complaintId, db, current_user)

    new_media = _store_upload(
        complaintId, file, current_user.userId, _upload_phase(complaint, current_user)
    )
    db.add(new_media)
    await db.commit()

    return {
        "message": "Image uploaded successfully",
        "mediaId": new_media.mediaId,
        "fileUrl": new_media.fileUrl,
    }


# --- Report slip ------------------------------------------------------------
# A printable, self-contained summary of a complaint. Visible to the citizen who
# filed it and to any official; deliberately NOT to other citizens, since it
# includes the reporter's contact details.
@app.get("/complaints/{complaintId}/report-slip")
async def get_complaint_report_slip(
    complaintId: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Return a structured report slip for printing or download."""
    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaintId)
        .options(
            selectinload(models.ComplaintModel.location),
            selectinload(models.ComplaintModel.category),
            selectinload(models.ComplaintModel.citizen),
            selectinload(models.ComplaintModel.officer),
            selectinload(models.ComplaintModel.field_worker),
        )
    )
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    is_owner = (current_user.role.lower() == "citizen" and complaint.citizenId == current_user.userId)
    is_official = lifecycle.is_official(current_user)
    # The assigned worker needs the slip to do the job on site.
    is_assigned_worker = (
        current_user.role.lower() == "field_worker"
        and complaint.fieldWorkerId == current_user.userId
    )

    if not (is_owner or is_official or is_assigned_worker):
        raise HTTPException(status_code=403, detail="Unauthorized to view this report slip.")

    return {
        "reportTitle": "Municipal Complaint Report Slip",
        "generatedAt": datetime.now(timezone.utc),
        "complaintId": complaint.complaintId,
        "status": lifecycle.status_name(complaint.status),
        "severity": lifecycle.status_name(complaint.severity),
        "description": complaint.description,
        "submittedAt": complaint.createdAt,
        "lastUpdatedAt": complaint.updatedAt,
        "category": {
            "name": complaint.category.name,
            "department": complaint.category.department,
        },
        "location": {
            "address": complaint.location.address,
            "latitude": complaint.location.latitude,
            "longitude": complaint.location.longitude,
        },
        "citizenDetails": {
            "name": complaint.citizen.name,
            "email": complaint.citizen.email,
            "phone": complaint.citizen.phone,
        },
        "assignmentDetails": {
            "assignedWorker": complaint.field_worker.name if complaint.field_worker else "Unassigned",
            "overseeingOfficer": complaint.officer.name if complaint.officer else "Unassigned",
        },
        # Included so a printed slip carries the triage reasoning with it.
        "aiAssessment": {
            "severity": complaint.aiSeverity,
            "summary": complaint.aiSummary,
            "source": complaint.aiSource,
            "analysedAt": complaint.aiAnalyzedAt,
        },
    }


# --- Citizen self-service ---------------------------------------------------
# Citizens can maintain their own contact details without an admin. Note this is
# separate from the admin reset route, which does not require the old password.
@app.patch("/citizens/me/profile")
async def update_citizen_profile(
    profile_data: schemas.CitizenProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Update the logged-in citizen's own name, phone or address."""
    if current_user.role.lower() != "citizen":
        raise HTTPException(
            status_code=403, detail="Only citizens can update their profile using this route."
        )

    # Query CitizenModel directly: `address` lives on the citizens table, and the
    # identity-mapped UserModel would not have it loaded.
    stmt = select(models.CitizenModel).where(models.CitizenModel.userId == current_user.userId)
    result = await db.execute(stmt)
    citizen = result.scalar_one_or_none()

    if not citizen:
        raise HTTPException(status_code=404, detail="Citizen profile not found.")

    # Only apply fields that were actually sent, so omitting a field leaves it
    # unchanged rather than blanking it.
    if profile_data.name is not None:
        citizen.name = profile_data.name
    if profile_data.phone is not None:
        citizen.phone = profile_data.phone
    if profile_data.address is not None:
        citizen.address = profile_data.address

    await db.commit()
    await db.refresh(citizen)

    return {
        "message": "Profile updated successfully.",
        "profile": {
            "name": citizen.name,
            "email": citizen.email,
            "phone": citizen.phone,
            "address": citizen.address,
        },
    }


@app.patch("/citizens/me/password")
async def update_citizen_password(
    password_data: schemas.CitizenPasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Change the logged-in citizen's password, verifying the current one first."""
    if current_user.role.lower() != "citizen":
        raise HTTPException(
            status_code=403, detail="Only citizens can update their password using this route."
        )

    # Proving knowledge of the old password is what stops a stolen session from
    # being turned into permanent account takeover.
    if not security.verify_password(password_data.oldPassword, current_user.passwordHash):
        raise HTTPException(status_code=400, detail="Incorrect current password.")

    if password_data.oldPassword == password_data.newPassword:
        raise HTTPException(
            status_code=400, detail="The new password must be different from the current one."
        )

    current_user.passwordHash = security.get_password_hash(password_data.newPassword)
    await db.commit()

    return {"message": "Password updated successfully."}


#  Allows a logged-in Field Worker to toggle their availability ON or OFF.
@app.get("/workers/me/profile", response_model=schemas.WorkerProfileResponse)
async def get_worker_profile(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """The signed-in field worker's own profile."""
    require_roles(current_user, ("field_worker",), "read a field worker profile")

    result = await db.execute(
        select(models.FieldWorkerModel)
        .where(models.FieldWorkerModel.userId == current_user.userId)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found.")
    return worker


@app.patch("/workers/me/profile", response_model=schemas.WorkerProfileResponse)
async def update_worker_profile(
    profile_data: schemas.WorkerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Update the signed-in field worker's own profile.

    Covers their name, phone, base address, and last known position. Skills are
    deliberately not editable here -- what a worker is qualified for decides
    what they can be assigned, so it stays an administrator's call.

    The two coordinates must arrive together. Storing one without the other
    would leave a row that looks like it has a position and cannot be plotted,
    and the distance sort would silently skip that worker forever.
    """
    require_roles(current_user, ("field_worker",), "update a field worker profile")

    result = await db.execute(
        select(models.FieldWorkerModel)
        .where(models.FieldWorkerModel.userId == current_user.userId)
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found.")

    lat, lng = profile_data.currentLatitude, profile_data.currentLongitude
    if (lat is None) != (lng is None):
        raise HTTPException(
            status_code=422,
            detail="Send currentLatitude and currentLongitude together, or neither.",
        )

    # Only fields that were actually sent are applied, so omitting one leaves it
    # alone rather than blanking it.
    if profile_data.name is not None:
        name = profile_data.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Name cannot be blank.")
        worker.name = name
    if profile_data.phone is not None:
        worker.phone = profile_data.phone.strip()
    if profile_data.baseAddress is not None:
        # An empty string clears it, which is different from not sending it.
        worker.baseAddress = profile_data.baseAddress.strip() or None
    if lat is not None and lng is not None:
        worker.currentLatitude = lat
        worker.currentLongitude = lng
        worker.locationUpdatedAt = datetime.now(timezone.utc).replace(tzinfo=None)

    await db.commit()
    await db.refresh(worker)
    return worker


@app.patch("/workers/me/availability")
async def update_worker_availability(
    update_data: schemas.AvailabilityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    if current_user.role.lower() != "field_worker":
        raise HTTPException(status_code=403, detail="Only field workers can update availability.")
    stmt = select(models.FieldWorkerModel).where(models.FieldWorkerModel.userId == current_user.userId)
    result = await db.execute(stmt)
    worker = result.scalar_one_or_none()

    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found in the database.")

    worker.availabilityStatus = update_data.status
    await db.commit()
    await db.refresh(worker)

    return {
        "message": "Availability updated successfully.",
        "worker": current_user.name,
        "availabilityStatus": worker.availabilityStatus
    }

##### Admin to Create officer & Search Functionality also Edit User Accounts
## new adding for admin to create officer    
@app.post("/admin/users/official", status_code=201)
async def create_system_official(
    user_in: schemas.SystemOfficialCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    
    if current_user.role.lower() != "administrator":
        raise HTTPException(status_code=403, detail="Only administrators can create official accounts.")

    result = await db.execute(select(models.UserModel).where(models.UserModel.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered.")

    hashed_password = get_password_hash(user_in.password)
    new_user_id = str(uuid.uuid4())
    
    # Only the officer branch is implemented here. Anything else used to fall
    # through with new_user still None and blow up on db.add(None) as a 500;
    # field workers have their own endpoint (POST /workers/) because they carry
    # a skill set this schema has no place for.
    role = (user_in.role or "").strip().lower()
    if role in {"field_worker", "fieldworker"}:
        raise HTTPException(
            status_code=400,
            detail="Create field workers with POST /workers/, which takes their skill set.",
        )
    if role not in {"municipal_officer", "officer"}:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create a '{user_in.role}' account here. Supported role: municipal_officer.",
        )

    new_user = None
    if role in {"municipal_officer", "officer"}:
        new_user = models.MunicipalOfficerModel(
            userId=new_user_id,          
            name=user_in.name,
            email=user_in.email,
            phone=getattr(user_in, 'phone', 'Not Provided'),        
            passwordHash=hashed_password,
            department=getattr(user_in, 'department', 'Unassigned'),
            # Safely fetch designation, defaulting to "General Officer"
            designation=getattr(user_in, 'designation', 'General Officer')
        )
        
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return {"message": f"{user_in.role} created successfully", "userId": new_user.userId}

# --- SLA sweep (manual trigger) ---------------------------------------------
# The background sweeper normally handles this. This endpoint exists so the
# sweep can be tested on demand, and so deployments running several API
# instances can disable the loop (SLA_ENABLED=false) and drive it from cron
# instead -- avoiding several sweepers racing on the same complaints.
@app.post("/admin/sla/sweep")
async def trigger_sla_sweep(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Run the SLA breach sweep now and report what it found."""
    require_roles(current_user, ["administrator"], "trigger an SLA sweep")

    result = await sla_service.run_sweep(db)
    return {
        "message": "SLA sweep complete.",
        "breached": result["breached"],
        "notified": result["notified"],
        "targetsHours": sla_service.sla_hours(),
    }


#Search Functionality
@app.get("/admin/users", response_model=List[schemas.UserAdminResponse])
async def list_users(
    query: Optional[str] = None,
    role: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    
    require_roles(current_user, ("administrator",), "list user accounts")

    stmt = select(models.UserModel).options(
        selectin_polymorphic(
            models.UserModel, 
            [models.FieldWorkerModel, models.MunicipalOfficerModel]
        )
    )
    if role:
        stmt = stmt.where(models.UserModel.role == role)
        
    if query:
        stmt = stmt.where(
            or_(
                models.UserModel.name.ilike(f"%{query}%"),
                models.UserModel.email.ilike(f"%{query}%")
            )
        )

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()

    return users

# Edit user accounts (Suspend users, update skills, change roles). This is for admin
@app.patch("/admin/users/{user_id}", response_model=schemas.UserAdminResponse)
async def update_user(
    user_id: str,
    update_data: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Update an account.

    Rewritten because the previous version silently discarded most of what it
    was given: it assigned ``field_worker.skills`` and ``field_worker.department``,
    neither of which exists on FieldWorkerModel (the column is ``skillSet``, and
    there is no department on a worker at all). SQLAlchemy accepted those as
    ordinary Python attributes, the commit saved nothing, and the endpoint still
    answered "User updated successfully" -- so a caller had no way to tell a
    saved change from a discarded one.

    Now it writes the real columns and returns the updated record, which makes
    the write self-verifying.
    """
    require_roles(current_user, ("administrator",), "manage user accounts")

    result = await db.execute(
        select(models.UserModel)
        .where(models.UserModel.userId == user_id)
        .options(
            selectin_polymorphic(
                models.UserModel,
                [models.FieldWorkerModel, models.MunicipalOfficerModel],
            )
        )
    )
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Changing a role would mean moving the row between polymorphic subclass
    # tables (citizens / municipal_officers / field_workers), which is not a
    # safe in-place update -- the subclass row would be missing or orphaned.
    if update_data.role is not None and update_data.role.lower() != target_user.role.lower():
        raise HTTPException(
            status_code=400,
            detail="Cannot change a user's role. Create a new account instead.",
        )

    if update_data.name is not None:
        name = update_data.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Name cannot be blank.")
        target_user.name = name

    if update_data.email is not None:
        email = update_data.email.strip().lower()
        if email != (target_user.email or "").lower():
            # email is the sign-in identifier and carries a UNIQUE constraint.
            # Checked here so the caller gets a 400 they can act on rather than
            # a 500 from the database.
            clash = await db.execute(
                select(models.UserModel.userId).where(models.UserModel.email == email)
            )
            if clash.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="That email is already registered.")
            target_user.email = email

    if update_data.phone is not None:
        target_user.phone = update_data.phone.strip()

    if update_data.isActive is not None:
        # Suspension is the soft delete. An administrator cannot suspend
        # themselves -- doing so would immediately lock them out of the screen
        # they would need to undo it, with no other way back in.
        if not update_data.isActive and target_user.userId == current_user.userId:
            raise HTTPException(
                status_code=400,
                detail="You cannot suspend your own account.",
            )
        target_user.isActive = update_data.isActive

    if isinstance(target_user, models.FieldWorkerModel):
        if update_data.skills is not None:
            # Stored as one comma-separated string (models.py:47). Assignment
            # substring-matches this against a complaint's department, so the
            # values have to survive the round trip exactly as given.
            target_user.skillSet = ", ".join(
                s.strip() for s in update_data.skills if s and s.strip()
            )
        if update_data.department is not None:
            raise HTTPException(
                status_code=400,
                detail="Field workers have skills, not a department. Send `skills` instead.",
            )

    elif isinstance(target_user, models.MunicipalOfficerModel):
        if update_data.department is not None:
            target_user.department = update_data.department.strip()
        if update_data.skills is not None:
            raise HTTPException(
                status_code=400,
                detail="Municipal officers have a department, not skills. Send `department` instead.",
            )

    elif update_data.department is not None or update_data.skills is not None:
        raise HTTPException(
            status_code=400,
            detail=f"A {target_user.role} account has neither a department nor skills.",
        )

    await db.commit()
    await db.refresh(target_user)
    return target_user


@app.delete("/admin/users/{user_id}", response_model=schemas.UserAdminResponse)
async def deactivate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Deactivate an account. This is a SOFT delete, deliberately.

    Complaints carry citizenId, officerId and fieldWorkerId, and status history
    records who made every transition. Removing the row would orphan all of it
    and destroy the audit trail the rest of the system is built to preserve --
    so DELETE marks the account inactive, which blocks sign-in and every
    authenticated request, and leaves the history intact and attributable.

    Reactivate with PATCH /admin/users/{id} {"isActive": true}.
    """
    require_roles(current_user, ("administrator",), "deactivate user accounts")

    result = await db.execute(
        select(models.UserModel)
        .where(models.UserModel.userId == user_id)
        .options(
            selectin_polymorphic(
                models.UserModel,
                [models.FieldWorkerModel, models.MunicipalOfficerModel],
            )
        )
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if target_user.userId == current_user.userId:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    target_user.isActive = False
    await db.commit()
    await db.refresh(target_user)
    return target_user


##### Feedback System and Location
### GEOSPATIAL: Nearby Complaints Map
@app.get("/complaints/nearby", response_model=List[schemas.ComplaintResponse])
async def get_nearby_complaints(
    latitude: float = Query(..., description="Citizen's current latitude"),
    longitude: float = Query(..., description="Citizen's current longitude"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * math.cos(math.radians(latitude)))

    stmt = (
        select(models.ComplaintModel)
        .join(models.LocationModel)
        .where(
            models.LocationModel.latitude.between(latitude - lat_delta, latitude + lat_delta),
            models.LocationModel.longitude.between(longitude - lon_delta, longitude + lon_delta)
        )
        .options(
            selectinload(models.ComplaintModel.location), 
            selectinload(models.ComplaintModel.category)
        )
        .order_by(models.ComplaintModel.createdAt.desc())
    )
    
    result = await db.execute(stmt)
    return result.scalars().all()


# --- Category catalogue -----------------------------------------------------
# The frontend previously hardcoded a mirror of seed.py; if anyone edited the
# seed without editing that file, the UI started sending category ids that did
# not exist. Exposing the table removes that whole class of breakage.
@app.get("/categories", response_model=List[schemas.CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """List every complaint category and its owning department."""
    result = await db.execute(select(models.CategoryModel).order_by(models.CategoryModel.name))
    return result.scalars().all()


# --- Complaint sub-resources ------------------------------------------------
# All three read paths below share the same visibility rule as the complaint
# itself, so they load the complaint first and defer to lifecycle.
async def _load_complaint_for_read(
    complaintId: str, db: AsyncSession, current_user: models.UserModel
) -> models.ComplaintModel:
    result = await db.execute(
        select(models.ComplaintModel).where(models.ComplaintModel.complaintId == complaintId)
    )
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    lifecycle.assert_can_view_complaint(current_user, complaint)
    return complaint


@app.get(
    "/complaints/{complaintId}/history",
    response_model=List[schemas.StatusHistoryResponse],
)
async def get_complaint_history(
    complaintId: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Return the full status timeline for a complaint, oldest first.

    Ordered ascending because the UI renders it as a timeline read top-to-bottom.
    """
    await _load_complaint_for_read(complaintId, db, current_user)

    result = await db.execute(
        select(models.StatusHistoryModel)
        .where(models.StatusHistoryModel.complaintId == complaintId)
        .order_by(models.StatusHistoryModel.timestamp.asc())
    )
    return result.scalars().all()


@app.get(
    "/complaints/{complaintId}/media",
    response_model=List[schemas.MediaAttachmentResponse],
)
async def get_complaint_media(
    complaintId: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """List photos attached to a complaint.

    `fileUrl` is relative (/uploads/...) and served by the static mount, so the
    client joins it against the API base URL.
    """
    await _load_complaint_for_read(complaintId, db, current_user)

    result = await db.execute(
        select(models.MediaAttachmentModel)
        .where(models.MediaAttachmentModel.complaintId == complaintId)
        .order_by(models.MediaAttachmentModel.uploadedAt.asc())
    )
    return result.scalars().all()


@app.get(
    "/complaints/{complaintId}/feedback",
    response_model=List[schemas.FeedbackResponse],
)
async def get_complaint_feedback(
    complaintId: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Return feedback submitted for a complaint, newest first."""
    await _load_complaint_for_read(complaintId, db, current_user)

    result = await db.execute(
        select(models.FeedbackModel)
        .where(models.FeedbackModel.complaintId == complaintId)
        .order_by(models.FeedbackModel.submittedAt.desc())
    )
    return result.scalars().all()


### if a citizen or admin clicks on one specific issue to view its dedicated page
### Fetch the full details of a single specific complaint.
# Retrieves the feedback. This is open to the citizen who wrote it, but it is primarily used by the MunicipalOfficer or Administrator roles on their dashboard to track worker performance and citizen satisfaction.
@app.get("/complaints/{complaintId}", response_model=schemas.ComplaintResponse)
async def get_complaint_by_id(
    complaintId: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
     
    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaintId)
        .options(
            selectinload(models.ComplaintModel.location), 
            selectinload(models.ComplaintModel.category)
        )
    )
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    if current_user.role.lower() == "citizen" and complaint.citizenId != current_user.userId:
        raise HTTPException(status_code=403, detail="You do not have permission to view this complaint.")

    return complaint


###  FEEDBACK: Submit feedback for a resolved complaint by citizen. Rating should be from 1 to 5
@app.post("/complaints/{complaintId}/feedback", response_model=schemas.FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    complaintId: str,
    feedback_data: schemas.FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    if current_user.role.lower() != "citizen":
        raise HTTPException(status_code=403, detail="Only citizens can submit feedback.")

    stmt = select(models.ComplaintModel).where(models.ComplaintModel.complaintId == complaintId)
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    
    if complaint.citizenId != current_user.userId:
        raise HTTPException(status_code=403, detail="You can only leave feedback on your own complaints.")

    # VERIFIED counts too: a citizen who closed the loop themselves should still
    # be able to rate the work.
    current_status = lifecycle.status_name(complaint.status)
    if current_status not in {"RESOLVED", "VERIFIED"}:
        raise HTTPException(
            status_code=400,
            detail="Feedback can only be submitted once a complaint is RESOLVED or VERIFIED.",
        )

    # Guard against double submission. Previously a second POST silently created
    # a second row and the citizen had no way to tell. Feedback is allowed once
    # per resolution cycle -- so if the complaint was reopened and fixed again,
    # the citizen can rate the new attempt.
    reopened_at_result = await db.execute(
        select(func.max(models.StatusHistoryModel.timestamp)).where(
            models.StatusHistoryModel.complaintId == complaintId,
            models.StatusHistoryModel.status == StatusEnum.REOPENED,
        )
    )
    last_reopened_at = reopened_at_result.scalar_one_or_none()

    existing_stmt = select(models.FeedbackModel).where(
        models.FeedbackModel.complaintId == complaintId
    )
    if last_reopened_at is not None:
        existing_stmt = existing_stmt.where(
            models.FeedbackModel.submittedAt > last_reopened_at
        )

    if (await db.execute(existing_stmt)).scalars().first():
        raise HTTPException(
            status_code=409,
            detail="You have already submitted feedback for this complaint.",
        )

    feedback_id = f"FBK-{str(uuid.uuid4())[:8].upper()}"
    new_feedback = models.FeedbackModel(
        feedbackId=feedback_id,
        rating=feedback_data.rating,
        comments=feedback_data.comments,
        complaintId=complaintId,
        submittedAt=datetime.now(timezone.utc).replace(tzinfo=None)
    )

    db.add(new_feedback)

    # Let the officer and worker who handled it see the rating.
    notification_service.notify_feedback(
        db, complaint, rating=feedback_data.rating, comments=feedback_data.comments
    )

    # A poor rating means the fix did not hold, so the complaint goes back into
    # the queue automatically rather than waiting for someone to notice.
    # Threshold is configurable; REOPEN_ON_RATING=0 disables the behaviour.
    reopen_threshold = int(os.getenv("REOPEN_ON_RATING", "2"))
    if reopen_threshold and feedback_data.rating <= reopen_threshold:
        complaint.status = StatusEnum.REOPENED
        complaint.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None)

        db.add(models.StatusHistoryModel(
            historyId=f"HIST-{str(uuid.uuid4())[:8].upper()}",
            complaintId=complaintId,
            status=StatusEnum.REOPENED,
            remarks=(
                f"Automatically reopened: citizen rated the resolution "
                f"{feedback_data.rating}/5."
            ),
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
        ))

        # Notify the worker and officer, but not the citizen -- they just told
        # us, so echoing it back would be noise. Passing them as the actor is
        # what suppresses their own copy.
        notification_service.notify_status_change(
            db,
            complaint,
            StatusEnum.REOPENED,
            remarks=f"Citizen rated the resolution {feedback_data.rating}/5.",
            actor=current_user,
        )
        logger.info(
            "complaint %s auto-reopened after a %d-star rating",
            complaintId, feedback_data.rating,
        )

    await db.commit()
    await db.refresh(new_feedback)
    return new_feedback

### NOTIFICATIONS
# The inbox now lives in routers/notifications.py. It reads the explicit
# recipientId instead of joining through complaint.citizenId, so field workers
# and officers get real inboxes rather than a 403.

### Allows an Administrator,Officer and Field Worker to update the status of a complaint and logs the history.
 #  Allows an Admin, Officer, or the Assigned Field Worker to update the status.
@app.patch("/complaints/{complaintId}/status", response_model=schemas.ComplaintResponse)
async def update_complaint_status(
    complaintId: str,
    status_update: schemas.StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    
    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaintId)
        .options(selectinload(models.ComplaintModel.location), selectinload(models.ComplaintModel.category))
    )
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    # Permission now depends on WHICH status is being set, not just on the role.
    # The expanded lifecycle means a citizen can VERIFY or REOPEN their own
    # complaint, and the assigned worker can report IN_PROGRESS/ON_HOLD/
    # RESOLVED/ESCALATED, while triage decisions stay with officials.
    # The full matrix lives in services/lifecycle.py.
    lifecycle.assert_can_set_status(current_user, complaint, status_update.status)

    previous_status = complaint.status
    complaint.status = status_update.status
    complaint.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None)

    # Stamp the FIRST resolution only. Reopening and resolving again should not
    # reset it, otherwise a complaint that bounced once reports the turnaround
    # of its final attempt rather than how long the citizen actually waited.
    if (
        lifecycle.status_name(status_update.status) == StatusEnum.RESOLVED.name
        and complaint.resolvedAt is None
    ):
        complaint.resolvedAt = complaint.updatedAt

    history_id = f"HIST-{str(uuid.uuid4())[:8].upper()}"
    new_history = models.StatusHistoryModel(
        historyId=history_id,
        complaintId=complaintId,
        status=status_update.status,
        remarks=status_update.remarks,
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(new_history)

    # Fan out to the citizen, the assigned worker and (on resolution) the owning
    # officer -- everyone with a stake, minus whoever made the change.
    if previous_status != status_update.status:
        notification_service.notify_status_change(
            db,
            complaint,
            status_update.status,
            remarks=status_update.remarks,
            actor=current_user,
        )

    await db.commit()
    await db.refresh(complaint)

    return complaint


# --- Severity override ------------------------------------------------------
# Counterpart to the existing category patch. Without this, an officer who
# disagreed with an AI severity had no way to correct it except re-running
# triage and hoping for a different answer.
@app.patch("/complaints/{complaintId}/severity", response_model=schemas.ComplaintResponse)
async def override_complaint_severity(
    complaintId: str,
    severity_update: schemas.SeverityOverride,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Manually set a complaint's severity, recording who changed it and why."""
    require_roles(current_user, ["officer", "administrator"], "change complaint severity")

    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaintId)
        .options(
            selectinload(models.ComplaintModel.location),
            selectinload(models.ComplaintModel.category),
        )
    )
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    previous = lifecycle.status_name(complaint.severity)
    new_severity = lifecycle.status_name(severity_update.severity)

    if previous == new_severity:
        raise HTTPException(
            status_code=400, detail=f"Complaint severity is already {new_severity}."
        )

    complaint.severity = severity_update.severity
    complaint.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None)

    # Record the override against the AI's original call. This is the signal the
    # spec asks for when measuring classification accuracy -- see
    # services/triage.log_override.
    triage_service.log_override(
        db,
        complaint,
        field="severity",
        previous=previous,
        new_value=new_severity,
        actor=current_user,
        remarks=severity_update.remarks,
    )

    # Severity changes are logged in the status timeline too, keeping the
    # complaint's status unchanged, exactly as the category patch does.
    note = severity_update.remarks or "no reason given"
    db.add(models.StatusHistoryModel(
        historyId=f"HIST-{str(uuid.uuid4())[:8].upper()}",
        complaintId=complaintId,
        status=complaint.status,
        remarks=f"Severity changed from {previous} to {new_severity} by {current_user.name}: {note}",
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
    ))

    # An upgrade to HIGH/CRITICAL is exactly the case the department needs to
    # hear about; a downgrade is not worth interrupting anyone for.
    if new_severity in {"HIGH", "CRITICAL"}:
        await notification_service.notify_escalation(
            db,
            complaint,
            severity=new_severity,
            reason=f"Severity raised manually by {current_user.name}. {note}",
        )

    await db.commit()
    await db.refresh(complaint)

    return complaint


# --- Duplicate merge --------------------------------------------------------
# Duplicate detection flags candidates; this is how an officer acts on the flag.
@app.post("/complaints/{complaintId}/merge", response_model=schemas.ComplaintResponse)
async def merge_complaint(
    complaintId: str,
    merge_data: schemas.ComplaintMerge,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Merge one complaint into another that reports the same real-world issue.

    The source complaint is closed as REJECTED and linked to the target via
    `duplicateOfComplaintId`; the target is left untouched. Both citizens are
    notified, so the person whose report was merged is never left wondering
    where it went.
    """
    require_roles(current_user, ["officer", "administrator"], "merge complaints")

    if complaintId == merge_data.intoComplaintId:
        raise HTTPException(status_code=400, detail="A complaint cannot be merged into itself.")

    load = lambda cid: (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == cid)
        .options(
            selectinload(models.ComplaintModel.location),
            selectinload(models.ComplaintModel.category),
        )
    )

    source = (await db.execute(load(complaintId))).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    target = (await db.execute(load(merge_data.intoComplaintId))).scalar_one_or_none()
    if not target:
        raise HTTPException(
            status_code=404,
            detail=f"Target complaint '{merge_data.intoComplaintId}' does not exist.",
        )

    # Refuse to chain merges: pointing at an already-merged complaint would bury
    # the report two levels deep and make the trail hard to follow.
    if target.duplicateOfComplaintId:
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{target.complaintId}' has itself been merged into "
                f"'{target.duplicateOfComplaintId}'. Merge into that one instead."
            ),
        )

    if lifecycle.status_name(source.status) == "REJECTED" and source.duplicateOfComplaintId:
        raise HTTPException(status_code=400, detail="This complaint has already been merged.")

    note = merge_data.remarks or "confirmed duplicate"
    source.duplicateOfComplaintId = target.complaintId
    source.status = StatusEnum.REJECTED
    source.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None)

    db.add(models.StatusHistoryModel(
        historyId=f"HIST-{str(uuid.uuid4())[:8].upper()}",
        complaintId=source.complaintId,
        status=StatusEnum.REJECTED,
        remarks=f"Merged into {target.complaintId} by {current_user.name}: {note}",
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
    ))

    # Tell the citizen whose report was merged where to follow it, and tell the
    # target's citizen that another report corroborates theirs.
    notification_service.notify_merge(
        db, source=source, target=target, actor=current_user, remarks=note
    )

    await db.commit()
    await db.refresh(source)

    return source


# to recategorize complaints by officer or admin
@app.patch("/complaints/{complaintId}/category", response_model=schemas.ComplaintResponse)
async def recategorize_complaint(
    complaintId: str,
    recategorize_data: schemas.ComplaintRecategorize,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    if current_user.role.lower() not in ["officer", "administrator"]:
        raise HTTPException(status_code=403, detail="Only authorized officials can recategorize complaints.")

    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaintId)
        .options(selectinload(models.ComplaintModel.location), selectinload(models.ComplaintModel.category))
    )
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    cat_stmt = select(models.CategoryModel).where(models.CategoryModel.categoryId == recategorize_data.categoryId)
    cat_result = await db.execute(cat_stmt)
    new_category = cat_result.scalar_one_or_none()

    if not new_category:
        raise HTTPException(status_code=404, detail="The specified category ID does not exist.")

    if complaint.categoryId == recategorize_data.categoryId:
        raise HTTPException(status_code=400, detail="Complaint is already assigned to this category.")

    old_category_name = complaint.category.name

    complaint.categoryId = recategorize_data.categoryId
    complaint.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None)

    history_id = f"HIST-{str(uuid.uuid4())[:8].upper()}"
    new_history = models.StatusHistoryModel(
        historyId=history_id,
        complaintId=complaintId,
        status=complaint.status,  # Keep the current status
        remarks=f"Recategorized from '{old_category_name}' to '{new_category.name}'",
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(new_history)

    notification_service.notify_recategorized(
        db, complaint, old_category=old_category_name, new_category=new_category.name
    )

    await db.commit()
    await db.refresh(complaint)

    return complaint


# --- Routers -------------------------------------------------------------
# Registered last so the route table reads in the same order as this file.
app.include_router(analytics_router.router)
app.include_router(notifications_router.router)
app.include_router(ai_router.router)

