from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from database import StatusEnum, SeverityEnum
from pydantic import BaseModel, EmailStr, Field

# --- User & Auth Schemas --
class UserRegister(BaseModel):
    userId: str
    name: str
    email: str 
    phone: str
    password: str
    role: str = "citizen"
    address: Optional[str] = None 

class Token(BaseModel):
    access_token: str
    token_type: str

# --- Location & Category ---
class LocationBase(BaseModel):
    latitude: float
    longitude: float
    address: str

class LocationCreate(LocationBase):
    pass

class LocationResponse(LocationBase):
    locationId: int
    class Config: 
        from_attributes = True

class CategoryResponse(BaseModel):
    categoryId: str
    name: str
    department: str
    class Config: 
        from_attributes = True

# --- Complaint Schemas ---
class ComplaintCreate(BaseModel):
    complaintId: str
    description: str
    categoryId: str
    citizenId: str
    location: LocationCreate

class StatusUpdate(BaseModel):
    status: StatusEnum
    remarks: Optional[str] = None

class ComplaintResponse(BaseModel):
    complaintId: str
    description: str
    status: StatusEnum
    severity: SeverityEnum
    createdAt: datetime
    updatedAt: datetime
    location: LocationResponse
    category: CategoryResponse
    class Config: 
        from_attributes = True

class ComplaintAssign(BaseModel):
    fieldWorkerId: str

class FieldWorkerCreate(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    skillSet: str  # E.g., "Plumbing, Sanitation"

class FieldWorkerResponse(BaseModel):
    userId: str    
    name: str
    phone: str
    skillSet: str  
    availabilityStatus: str

    class Config:
        from_attributes = True

class PasswordReset(BaseModel):
    newPassword: str