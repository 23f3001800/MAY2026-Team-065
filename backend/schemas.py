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

    # When the complaint first entered RESOLVED. Null if it never has, or if it
    # predates the column and had no RESOLVED history entry to backfill from.
    # Consumers must treat null as "unknown", never as zero.
    resolvedAt: Optional[datetime] = None

    # --- SLA, derived from createdAt + severity (services/sla.py) ------------
    # Answers "when should this be fixed by", which the complaint history could
    # not. Null when it cannot be computed -- never a guess.
    #
    # No "days remaining" integer is sent on purpose: the client renders
    # relative time against the reader's own clock, and a server-computed
    # countdown goes stale the moment it is cached.
    expectedResolutionAt: Optional[datetime] = None
    slaBreached: bool = False
    hoursRemaining: Optional[float] = None

    location: LocationResponse
    category: CategoryResponse

    # Who is involved. These columns already existed on the model; exposing them
    # lets the UI show "assigned to", build per-worker performance views, and
    # attribute uploaded photos to the reporter rather than inferring it from
    # upload order.
    citizenId: Optional[str] = None
    officerId: Optional[str] = None
    fieldWorkerId: Optional[str] = None

    # Advisory AI triage output. All optional: complaints filed before AI triage
    # existed, or filed while it was disabled, simply leave these null.
    aiSuggestedCategoryId: Optional[str] = None
    aiSeverity: Optional[str] = None
    aiConfidence: Optional[float] = None
    aiSummary: Optional[str] = None
    aiSource: Optional[str] = None
    aiAnalyzedAt: Optional[datetime] = None
    duplicateOfComplaintId: Optional[str] = None

    class Config:
        from_attributes = True

class WorkerTaskResponse(ComplaintResponse):
    """A complaint as a field worker sees it, plus how far away it is.

    distanceKm is only populated for sort=distance -- it is null otherwise,
    because a distance is meaningless without the point it was measured from,
    and sending a stale one would be worse than sending none.
    """

    distanceKm: Optional[float] = None


class ComplaintAssign(BaseModel):
    fieldWorkerId: str


class BulkAssign(BaseModel):
    """Assign many complaints to one field worker in a single call."""

    # Capped because each id costs a lifecycle check and a notification. Beyond
    # this the request stops being "the ward I am looking at" and starts being a
    # migration, which deserves a job rather than a request.
    complaintIds: List[str] = Field(..., min_length=1, max_length=50)
    fieldWorkerId: str


class BulkAssignFailure(BaseModel):
    complaintId: str
    reason: str


class BulkAssignResult(BaseModel):
    """Partial success is the normal outcome, so it is modelled explicitly.

    One already-resolved complaint in a batch of twenty should not fail the
    other nineteen, and the caller needs to know exactly which ones did not
    take rather than being told the whole thing worked.
    """

    assigned: List[str]
    failed: List[BulkAssignFailure]
    assignedCount: int
    failedCount: int


class EscalationItem(BaseModel):
    complaintId: str
    description: str
    status: StatusEnum
    severity: SeverityEnum
    createdAt: datetime
    expectedResolutionAt: Optional[datetime] = None
    # Negative once overdue. Kept signed rather than split into two fields so a
    # client can sort breached and at-risk on one key.
    hoursRemaining: Optional[float] = None
    department: Optional[str] = None
    categoryName: Optional[str] = None
    fieldWorkerId: Optional[str] = None
    officerId: Optional[str] = None
    address: Optional[str] = None


class EscalationResponse(BaseModel):
    breached: List[EscalationItem]
    atRisk: List[EscalationItem]
    breachedCount: int
    atRiskCount: int

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

class WorkerProfileUpdate(BaseModel):
    """What a field worker may change about themselves.

    Every field is optional and only applied when sent, so updating a phone
    number does not blank an address. Skills are NOT here on purpose: what a
    worker is qualified for is an administrator's call, not their own.
    """

    name: Optional[str] = None
    phone: Optional[str] = None
    baseAddress: Optional[str] = None

    # Sent together or not at all -- half a coordinate is not a position.
    currentLatitude: Optional[float] = Field(None, ge=-90, le=90)
    currentLongitude: Optional[float] = Field(None, ge=-180, le=180)


class WorkerProfileResponse(BaseModel):
    userId: str
    name: str
    email: str
    phone: Optional[str] = None
    skillSet: Optional[str] = None
    availabilityStatus: Optional[str] = None
    baseAddress: Optional[str] = None
    currentLatitude: Optional[float] = None
    currentLongitude: Optional[float] = None
    # When the position was last reported. A client showing a location without
    # this cannot tell a live fix from one recorded three days ago.
    locationUpdatedAt: Optional[datetime] = None

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
    """Fields an administrator may change on an existing account.

    Every field is optional and only applied when present, so a caller can
    change one thing without having to send the whole record back. `role` is
    accepted but rejected with a 400 if it differs from the current role --
    changing a role would mean moving the row between polymorphic subclass
    tables, which is not a safe in-place update.
    """

    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    isActive: Optional[bool] = None  # Suspend / reactivate. Blocks sign-in.
    role: Optional[str] = None
    department: Optional[str] = None   # Municipal officers only.
    skills: Optional[List[str]] = None  # Field workers only. Stored comma-joined.


class UserAdminResponse(BaseModel):
    """What the admin user list and the update endpoint return.

    The previous version returned the raw ORM object from GET /admin/users and
    a bare ``{"message": ...}`` from PATCH, so a client could not tell what had
    actually been saved without re-reading the list. Returning the updated
    record makes the write self-verifying.
    """

    userId: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    isActive: bool = True
    department: Optional[str] = None
    designation: Optional[str] = None
    skillSet: Optional[str] = None
    availabilityStatus: Optional[str] = None

    class Config:
        from_attributes = True

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

# --- NOTIFICATION SCHEMAS ---
class NotificationResponse(BaseModel):
    notificationId: str
    message: str
    type: str
    sentAt: datetime
    isRead: bool
    complaintId: str
    recipientId: Optional[str] = None
    readAt: Optional[datetime] = None
    priority: str = "NORMAL"

    class Config:
        from_attributes = True


class NotificationReadUpdate(BaseModel):
    """Body for marking a single notification read or unread."""
    isRead: bool = True


class UnreadCountResponse(BaseModel):
    unread: int


class MarkAllReadResponse(BaseModel):
    message: str
    updated: int

# Complaint Recategorize
class ComplaintRecategorize(BaseModel):
    categoryId: str


# --- OFFICER CONTROL SCHEMAS ---
class SeverityOverride(BaseModel):
    """Officer's manual correction of a severity the AI or defaults got wrong."""
    severity: SeverityEnum
    remarks: Optional[str] = Field(None, max_length=500)


class ComplaintMerge(BaseModel):
    """Merge this complaint into another that reports the same real-world issue."""
    intoComplaintId: str
    remarks: Optional[str] = Field(None, max_length=500)


# --- READ-PATH SCHEMAS ---
# These expose data the system already writes but previously had no way to read
# back: the status timeline, uploaded photos, and submitted feedback.

class StatusHistoryResponse(BaseModel):
    historyId: str
    status: StatusEnum
    remarks: Optional[str] = None
    timestamp: datetime
    complaintId: str

    class Config:
        from_attributes = True


class MediaAttachmentResponse(BaseModel):
    mediaId: str
    fileUrl: str
    type: str
    uploadedBy: str
    uploadedAt: datetime
    complaintId: str

    # "report" = the problem as filed; "resolution" = the completed work.
    # Stored at upload time so clients stop inferring it from upload order --
    # that inference is why a worker's completion photo could appear as the
    # citizen's original report.
    phase: str = "report"

    class Config:
        from_attributes = True


# --- CITIZEN SELF-SERVICE SCHEMAS ---
class CitizenProfileUpdate(BaseModel):
    """Partial update: every field is optional, and omitted fields are left alone."""
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    phone: Optional[str] = Field(None, min_length=5, max_length=20)
    address: Optional[str] = Field(None, max_length=300)


class CitizenPasswordUpdate(BaseModel):
    oldPassword: str
    # Enforced here so a weak password is rejected before it is ever hashed.
    newPassword: str = Field(..., min_length=8, max_length=128)


# --- AI SCHEMAS ---
# Responses mirror the dataclasses in ai/provider.py. Every AI response carries a
# `source` field ("rules", "gemini" or "gemini-vision") so clients -- and
# officers auditing a decision -- can always tell which engine produced it.

class CategorySuggestionResponse(BaseModel):
    categoryId: str
    name: str
    department: str
    confidence: float = Field(..., ge=0, le=1)
    reason: str = ""


class CategorizeRequest(BaseModel):
    description: str = Field(..., min_length=5, max_length=5000)


class CategorizeResponse(BaseModel):
    suggestions: List[CategorySuggestionResponse]
    source: str


class SeverityRequest(BaseModel):
    description: str = Field(..., min_length=5, max_length=5000)
    categoryId: Optional[str] = None


class SeverityResponse(BaseModel):
    severity: SeverityEnum
    confidence: float = Field(..., ge=0, le=1)
    reason: str = ""
    signals: List[str] = []
    source: str


class DuplicateCheckRequest(BaseModel):
    description: str = Field(..., min_length=5, max_length=5000)
    categoryId: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class DuplicateCandidateResponse(BaseModel):
    complaintId: str
    similarity: float
    distanceKm: Optional[float] = None
    status: str
    description: str
    createdAt: Optional[str] = None
    reason: str = ""


class DuplicateCheckResponse(BaseModel):
    isDuplicate: bool
    candidates: List[DuplicateCandidateResponse]
    source: str


class VisionResponse(BaseModel):
    """Result of analysing a complaint photo.

    `available` is False (with a reason) when analysis could not run -- no API
    key, unsupported/oversized image, or a provider safety block. Callers should
    treat that as a soft failure and continue without image input.
    """
    available: bool
    unavailableReason: str = ""
    description: str = ""
    categoryId: Optional[str] = None
    categoryName: Optional[str] = None
    severity: SeverityEnum = SeverityEnum.LOW
    confidence: float = 0.0
    observations: List[str] = []
    source: str = "gemini-vision"


class TriageRequest(BaseModel):
    description: str = Field(..., min_length=5, max_length=5000)
    categoryId: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class TriageResponse(BaseModel):
    category: CategorizeResponse
    severity: SeverityResponse
    duplicates: DuplicateCheckResponse
    summary: str
    vision: Optional[VisionResponse] = None
    source: str


class AssistantQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)


class AssistantQueryResponse(BaseModel):
    answer: str
    citations: List[str] = []
    source: str
    contextUsed: List[str] = []


class DescriptionWriteupRequest(BaseModel):
    description: str = Field(..., min_length=5, max_length=5000)
    categoryId: Optional[str] = None


class DescriptionWriteupResponse(BaseModel):
    original: str
    rewritten: str
    source: str