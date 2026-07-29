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

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectin_polymorphic  

from database import engine, Base, AsyncSessionLocal
import models
import schemas
import security

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

 ### Allows an Administrator,Officer and Field Worker to update the status of a complaint and logs the history.
 #  """ Allows an Admin, Officer, or the Assigned Field Worker to update the status. """
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
    
    await db.commit()
    await db.refresh(complaint)
    
    return complaint

### if a citizen or admin clicks on one specific issue to view its dedicated page
### Fetch the full details of a single specific complaint.
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
        passwordHash=worker.password, 
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