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
    description: str
    categoryId: str
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

# Field Worker Schemas
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

# available
class AvailabilityUpdate(BaseModel):
    status: str = Field(..., pattern="^(AVAILABLE|UNAVAILABLE)$", description="Must be AVAILABLE or UNAVAILABLE")


# officer 
class SystemOfficialCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = Field(..., pattern="^(municipal_officer|field_worker)$")
    department: Optional[str] = None 
    skills: Optional[List[str]] = None

class UserUpdate(BaseModel):
    isActive: Optional[bool] = None  # To suspend/activate accounts
    role: Optional[str] = None
    department: Optional[str] = None
    skills: Optional[List[str]] = None

class SystemOfficialCreate(BaseModel):
    name: str
    email: str
    phone: str   
    password: str
    role: str    
    department: str = "Unassigned" 
    designation: str = "General Officer" 
    skills: Optional[List[str]] = None

# --- FEEDBACK SCHEMAS ---
class FeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comments: Optional[str] = None

class FeedbackResponse(BaseModel):
    feedbackId: str
    rating: int
    comments: Optional[str]
    submittedAt: datetime
    complaintId: str

    class Config:
        from_attributes = True

# --- NOTIFICATION SCHEMAS should be implemented later---
class NotificationResponse(BaseModel):
    notificationId: str
    message: str
    type: str
    sentAt: datetime
    isRead: bool
    complaintId: str

    class Config:
        from_attributes = True

# Complaint Recategorize
class ComplaintRecategorize(BaseModel):
    categoryId: str