from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
import uuid # Add this at the very top with your other imports
from sqlalchemy.future import select
from typing import List

from database import engine, Base, AsyncSessionLocal
import models
import schemas
import security

app = FastAPI(title="Municipal Complaint Management API")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Register Api
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