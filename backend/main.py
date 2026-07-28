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