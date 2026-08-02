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
from datetime import datetime, timezone
import jwt
from sqlalchemy.orm import selectinload
import os
import shutil
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectin_polymorphic  

from database import engine, Base, AsyncSessionLocal
import models
import schemas
import security

from security import get_password_hash

app = FastAPI(title="Municipal Complaint Management API")
# Create a folder to store images
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

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

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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


# Decodes the JWT token and fetches the current logged-in user from the database.
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    stmt = select(models.UserModel).where(models.UserModel.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    return user


## Allows a logged-in citizen to submit a new complaint
@app.post("/complaints/", response_model=schemas.ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    complaint_data: schemas.ComplaintCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user) 
):  
    if current_user.role.lower() != "citizen":
        raise HTTPException(status_code=403, detail="Only citizens can file new complaints.")

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
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user) 
):
     
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
        
    stmt = stmt.order_by(models.ComplaintModel.createdAt.desc())
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

# Uploads images by worker/citizen
# Allows the Citizen (creator) or Field Worker (assigned) to upload photos. 
@app.post("/complaints/{complaintId}/image", status_code=status.HTTP_201_CREATED)
async def upload_complaint_image(
    complaintId: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    
    stmt = select(models.ComplaintModel).where(models.ComplaintModel.complaintId == complaintId)
    result = await db.execute(stmt)
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
        
    is_owner = (current_user.role.lower() == "citizen" and complaint.citizenId == current_user.userId)
    is_assigned_worker = (current_user.role.lower() == "field_worker" and complaint.fieldWorkerId == current_user.userId)

    if not (is_owner or is_assigned_worker):
        raise HTTPException(status_code=403, detail="You do not have permission to upload images to this complaint.")

    file_extension = file.filename.split(".")[-1]
    safe_filename = f"{complaintId}_{str(uuid.uuid4())[:8]}.{file_extension}"
    file_path = os.path.join("uploads", safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    media_id = f"MED-{str(uuid.uuid4())[:6].upper()}"
    new_media = models.MediaAttachmentModel(
        mediaId=media_id,
        complaintId=complaintId,
        fileUrl=f"/uploads/{safe_filename}",
        type=file.content_type, 
        uploadedBy=current_user.userId 
    )
    db.add(new_media)
    await db.commit()

    return {
        "message": "Image uploaded successfully", 
        "mediaId": media_id,
        "fileUrl": new_media.fileUrl
    }


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
    
    if complaint.status.name != "RESOLVED":
        raise HTTPException(status_code=400, detail="Feedback can only be submitted for RESOLVED complaints.")

    feedback_id = f"FBK-{str(uuid.uuid4())[:8].upper()}"
    new_feedback = models.FeedbackModel(
        feedbackId=feedback_id,
        rating=feedback_data.rating,
        comments=feedback_data.comments,
        complaintId=complaintId,
        submittedAt=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    
    db.add(new_feedback)
    await db.commit()
    await db.refresh(new_feedback)
    return new_feedback

### NOTIFICATIONS: Get inbox for the citizen
@app.get("/notifications/me", response_model=List[schemas.NotificationResponse])
async def get_my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user)
):
    if current_user.role.lower() != "citizen":
        raise HTTPException(status_code=403, detail="Only citizens can view this inbox.")

    # Join Notification and Complaint to find alerts belonging to this specific citizen
    stmt = (
        select(models.NotificationModel)
        .join(models.ComplaintModel)
        .where(models.ComplaintModel.citizenId == current_user.userId)
        .order_by(models.NotificationModel.sentAt.desc())
    )
    
    result = await db.execute(stmt)
    return result.scalars().all()

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

    is_admin_or_officer = current_user.role.lower() in ["administrator", "officer"]
    is_assigned_worker = (current_user.role.lower() == "field_worker" and complaint.fieldWorkerId == current_user.userId)

    if not (is_admin_or_officer or is_assigned_worker):
        raise HTTPException(status_code=403, detail="You are not authorized to update this complaint.")

    previous_status = complaint.status
    complaint.status = status_update.status
    complaint.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None)

    history_id = f"HIST-{str(uuid.uuid4())[:8].upper()}"
    new_history = models.StatusHistoryModel(
        historyId=history_id,
        complaintId=complaintId,
        status=status_update.status,
        remarks=status_update.remarks,
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(new_history)
    if previous_status != status_update.status:
        status_name = status_update.status.name if hasattr(status_update.status, 'name') else str(status_update.status)
        
        notif_id = f"NOTIF-{str(uuid.uuid4())[:6].upper()}"
        new_notification = models.NotificationModel(
            notificationId=notif_id,
            message=f"Your complaint ({complaintId}) is now marked as {status_name}.",
            type="STATUS_UPDATE",
            sentAt=datetime.now(timezone.utc).replace(tzinfo=None),
            isRead=False,
            complaintId=complaintId
        )
        db.add(new_notification)
    await db.commit()
    await db.refresh(complaint)
    
    return complaint


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
    
    await db.commit()
    await db.refresh(complaint)
    
    return complaint

