from fastapi import FastAPI, Depends, HTTPException, status,  UploadFile, File
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
from datetime import date, datetime, timezone
import jwt
from sqlalchemy.orm import selectinload
import os
import shutil
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectin_polymorphic

import asyncio
import logging

from database import engine, Base, AsyncSessionLocal, StatusEnum, SeverityEnum
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

    stmt = stmt.order_by(models.ComplaintModel.createdAt.desc())
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
        
    if complaint.category.department not in field_worker.skillSet:
        raise HTTPException(
            status_code=400, 
            detail=f"Skill mismatch! This issue requires the '{complaint.category.department}' department, but this worker specializes in '{field_worker.skillSet}'."
        )

    complaint.fieldWorkerId = assignment.fieldWorkerId
    
    if current_user.role.lower() == "officer":
        complaint.officerId = current_user.userId  
        
    complaint.status = "ASSIGNED"
    complaint.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None)

    history_id = f"HIST-{str(uuid.uuid4())[:8].upper()}"
    new_history = models.StatusHistoryModel(
        historyId=history_id,
        complaintId=complaintId,
        status="ASSIGNED",
        remarks=f"Task dispatched to Field Worker: {assignment.fieldWorkerId}",
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(new_history)

    # Tell the worker they have a task, and the citizen that work has started.
    notification_service.notify_assignment(
        db, complaint, worker=field_worker, assigned_by=current_user
    )

    await db.commit()
    await db.refresh(complaint)

    return complaint


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
@app.get("/complaints/worker/tasks", response_model=List[schemas.ComplaintResponse])
async def get_worker_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
   
    
    if current_user.role.lower() != "field_worker":
        raise HTTPException(status_code=403, detail="Only field workers can access this feed.")

    stmt = (
        select(models.ComplaintModel)
        .where(models.ComplaintModel.fieldWorkerId == current_user.userId)
        .options(selectinload(models.ComplaintModel.location), selectinload(models.ComplaintModel.category))
    )
    result = await db.execute(stmt)
    
    return result.scalars().all()

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


def _store_upload(complaintId: str, file: UploadFile, uploadedBy: str) -> models.MediaAttachmentModel:
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
    )


# Uploads images by worker/citizen -- accepts several files in one request.
@app.post("/complaints/{complaintId}/images", status_code=status.HTTP_201_CREATED)
async def upload_complaint_images(
    complaintId: str,
    files: List[UploadFile] = File(..., description="One or more photos of the issue"),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    """Attach one or more photos to a complaint."""
    complaint = await _load_complaint_for_upload(complaintId, db, current_user)

    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    uploaded_media = []
    first_image: Optional[tuple] = None  # (bytes, mime) kept for AI analysis

    for file in files:
        # Read once: the stream cannot be rewound after copyfileobj consumes it,
        # and the AI step below needs the same bytes.
        contents = await file.read()
        await file.seek(0)

        new_media = _store_upload(complaintId, file, current_user.userId)
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

    await db.commit()

    return {
        "message": f"{len(uploaded_media)} image(s) uploaded successfully",
        "mediaAttachments": uploaded_media,
        "aiAnalysis": ai_analysis,
    }


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
    await _load_complaint_for_upload(complaintId, db, current_user)

    new_media = _store_upload(complaintId, file, current_user.userId)
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
    
    new_user = None
    if user_in.role == "municipal_officer":
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
@app.get("/admin/users")
async def list_users(
    query: Optional[str] = None,
    role: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    
    if current_user.role.lower() != "administrator":
        raise HTTPException(status_code=403, detail="Not authorized.")

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
@app.patch("/admin/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
  
    if current_user.role.lower() != "administrator":
        raise HTTPException(status_code=403, detail="Not authorized.")

    result = await db.execute(select(models.UserModel).where(models.UserModel.userId == user_id))
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if update_data.isActive is not None:
        target_user.isActive = update_data.isActive
        
    if update_data.role is not None and update_data.role != target_user.role:
         raise HTTPException(
             status_code=400, 
             detail="Cannot change base user role directly. Create a new account instead."
         )

    if target_user.role == "field_worker":
        fw_result = await db.execute(select(models.FieldWorkerModel).where(models.FieldWorkerModel.userId == user_id))
        field_worker = fw_result.scalar_one()
        
        if update_data.skills is not None:
            field_worker.skills = update_data.skills
        if update_data.department is not None:
            field_worker.department = update_data.department

    elif target_user.role == "municipal_officer" and update_data.department is not None:
        mo_result = await db.execute(select(models.MunicipalOfficerModel).where(models.MunicipalOfficerModel.userId == user_id))
        officer = mo_result.scalar_one()
        officer.department = update_data.department

    await db.commit()
    
    return {"message": "User updated successfully"}

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

