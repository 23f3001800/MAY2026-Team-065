from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Enum, Boolean, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Import Base and Enums from your database.py file
from database import Base, StatusEnum, SeverityEnum

# --- User Base ---
class UserModel(Base):
    __tablename__ = "users"
    
    userId: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    passwordHash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False) 

    # Whether the account may sign in. Suspension is a soft delete: complaints
    # reference citizenId, officerId and fieldWorkerId, so removing the row
    # would orphan history that the audit trail depends on.
    #
    # Defaults True and is server_default'ed too -- rows that predate this
    # column are backfilled to True by migrations.py, never left NULL, because
    # `NULL != False` would let a suspended-looking account through the login
    # check below.
    isActive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))

    __mapper_args__ = {
        "polymorphic_on": "role",
        "polymorphic_identity": "user",
    }

class CitizenModel(UserModel):
    __tablename__ = "citizens"
    userId: Mapped[str] = mapped_column(ForeignKey("users.userId"), primary_key=True)
    address: Mapped[str] = mapped_column(String, nullable=True)

    complaints: Mapped[List["ComplaintModel"]] = relationship(back_populates="citizen")
    
    __mapper_args__ = {"polymorphic_identity": "citizen"}

class MunicipalOfficerModel(UserModel):
    __tablename__ = "municipal_officers"
    userId: Mapped[str] = mapped_column(ForeignKey("users.userId"), primary_key=True)
    department: Mapped[str] = mapped_column(String, nullable=False)
    designation: Mapped[str] = mapped_column(String, nullable=False)
    
    complaints: Mapped[List["ComplaintModel"]] = relationship(back_populates="officer")

    __mapper_args__ = {"polymorphic_identity": "officer"}

class FieldWorkerModel(UserModel):
    __tablename__ = "field_workers"
    userId: Mapped[str] = mapped_column(ForeignKey("users.userId"), primary_key=True)
    skillSet: Mapped[str] = mapped_column(String, nullable=True) # Stored as comma-separated values
    availabilityStatus: Mapped[str] = mapped_column(String, default="AVAILABLE")
    
    complaints: Mapped[List["ComplaintModel"]] = relationship(back_populates="field_worker")

    __mapper_args__ = {"polymorphic_identity": "field_worker"}

class AdministratorModel(UserModel):
    __tablename__ = "administrators"
    userId: Mapped[str] = mapped_column(ForeignKey("users.userId"), primary_key=True)
    accessLevel: Mapped[str] = mapped_column(String, default="SUPER")
    
    #  Admin manages Users
    managed_users: Mapped[List["UserModel"]] = relationship(
        "UserModel",
        primaryjoin="foreign(UserModel.userId) != AdministratorModel.userId", 
        viewonly=True
    )

    __mapper_args__ = {"polymorphic_identity": "administrator"}


# --- Core Entities ---

class LocationModel(Base):
    __tablename__ = "locations"
    locationId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str] = mapped_column(String, nullable=False)
    
    complaint: Mapped["ComplaintModel"] = relationship(back_populates="location")

class CategoryModel(Base):
    __tablename__ = "categories"
    categoryId: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    
    # Disambiguated: ComplaintModel has two FKs into categories (the authoritative
    # categoryId and the advisory aiSuggestedCategoryId).
    complaints: Mapped[List["ComplaintModel"]] = relationship(
        back_populates="category", foreign_keys="ComplaintModel.categoryId"
    )

class ComplaintModel(Base):
    __tablename__ = "complaints"
    
    complaintId: Mapped[str] = mapped_column(String, primary_key=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[StatusEnum] = mapped_column(Enum(StatusEnum), default=StatusEnum.PENDING)
    severity: Mapped[SeverityEnum] = mapped_column(Enum(SeverityEnum), default=SeverityEnum.LOW)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # When the complaint FIRST entered RESOLVED. Distinct from updatedAt, which
    # moves on any edit -- a recategorisation months later would otherwise make
    # this look like a months-long resolution. Set once and never overwritten,
    # so a reopen-and-fix-again cycle still reports the original turnaround.
    resolvedAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Foreign Keys
    locationId: Mapped[int] = mapped_column(ForeignKey("locations.locationId"))
    categoryId: Mapped[str] = mapped_column(ForeignKey("categories.categoryId"))
    citizenId: Mapped[str] = mapped_column(ForeignKey("citizens.userId"))
    officerId: Mapped[Optional[str]] = mapped_column(ForeignKey("municipal_officers.userId"), nullable=True)
    fieldWorkerId: Mapped[Optional[str]] = mapped_column(ForeignKey("field_workers.userId"), nullable=True)

    # --- AI triage results ---
    # Persisted rather than recomputed so an officer can see what the model said
    # and when, even after the complaint has been manually recategorized. These
    # are advisory: categoryId/severity remain the authoritative human-owned values.
    aiSuggestedCategoryId: Mapped[Optional[str]] = mapped_column(
        ForeignKey("categories.categoryId"), nullable=True
    )
    aiSeverity: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    aiConfidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    aiSummary: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Which engine produced the result: "rules", "gemini", or "gemini-vision".
    aiSource: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    aiAnalyzedAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Flagged by duplicate detection; an officer confirms or clears it.
    duplicateOfComplaintId: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    location: Mapped["LocationModel"] = relationship(back_populates="complaint")
    category: Mapped["CategoryModel"] = relationship(
        back_populates="complaints", foreign_keys=[categoryId]
    )
    aiSuggestedCategory: Mapped[Optional["CategoryModel"]] = relationship(
        "CategoryModel", foreign_keys=[aiSuggestedCategoryId], viewonly=True
    )
    citizen: Mapped["CitizenModel"] = relationship(back_populates="complaints")
    officer: Mapped["MunicipalOfficerModel"] = relationship(back_populates="complaints")
    field_worker: Mapped["FieldWorkerModel"] = relationship(back_populates="complaints")

    # --- SLA, derived rather than stored -------------------------------------
    # The deadline is a pure function of createdAt and severity, so storing it
    # would mean a column that silently goes stale the moment an officer
    # re-rates the severity. Exposed as properties instead: ComplaintResponse
    # has from_attributes=True, so every endpoint that returns a complaint picks
    # these up without the handler doing anything.
    #
    # The import is deliberately inside the property: services/sla.py imports
    # this module, and pulling it in at module level would be a circular import.

    @property
    def expectedResolutionAt(self) -> Optional[datetime]:
        """When this complaint should be resolved by. None if it cannot be computed."""
        from services import sla

        return sla.deadline_for(self, sla.sla_hours())

    @property
    def slaBreached(self) -> bool:
        """Past its deadline AND still open.

        A complaint resolved late is history, not a queue item -- keeping it
        flagged forever would leave finished work in an officer's face.
        """
        from services import sla

        return bool(sla.sla_state(self)["slaBreached"])

    @property
    def hoursRemaining(self) -> Optional[float]:
        """Hours until the deadline; negative when overdue. None once closed."""
        from services import sla

        return sla.sla_state(self)["hoursRemaining"]
    
    media_attachments: Mapped[List["MediaAttachmentModel"]] = relationship(back_populates="complaint")
    status_histories: Mapped[List["StatusHistoryModel"]] = relationship(back_populates="complaint")
    notifications: Mapped[List["NotificationModel"]] = relationship(back_populates="complaint")
    feedbacks: Mapped[List["FeedbackModel"]] = relationship(back_populates="complaint")


class MediaAttachmentModel(Base):
    __tablename__ = "media_attachments"
    mediaId: Mapped[str] = mapped_column(String, primary_key=True)
    fileUrl: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    uploadedBy: Mapped[str] = mapped_column(String, nullable=False)
    uploadedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    complaintId: Mapped[str] = mapped_column(ForeignKey("complaints.complaintId"))
    
    complaint: Mapped["ComplaintModel"] = relationship(back_populates="media_attachments")

class StatusHistoryModel(Base):
    __tablename__ = "status_histories"
    historyId: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[StatusEnum] = mapped_column(Enum(StatusEnum), nullable=False)
    remarks: Mapped[str] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    complaintId: Mapped[str] = mapped_column(ForeignKey("complaints.complaintId"))
    
    complaint: Mapped["ComplaintModel"] = relationship(back_populates="status_histories")

class NotificationModel(Base):
    __tablename__ = "notifications"
    notificationId: Mapped[str] = mapped_column(String, primary_key=True)
    message: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    sentAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    isRead: Mapped[bool] = mapped_column(Boolean, default=False)
    complaintId: Mapped[str] = mapped_column(ForeignKey("complaints.complaintId"))

    # Explicit recipient. Before this existed, notifications were addressed only
    # implicitly via complaint.citizenId, which made it impossible to notify a
    # field worker or an officer. Nullable so the additive migration can backfill
    # pre-existing rows without a NOT NULL violation.
    recipientId: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.userId"), nullable=True, index=True
    )
    # Set when the recipient reads it; isRead stays as the cheap boolean filter.
    readAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    priority: Mapped[str] = mapped_column(String, default="NORMAL")

    complaint: Mapped["ComplaintModel"] = relationship(back_populates="notifications")
    recipient: Mapped[Optional["UserModel"]] = relationship("UserModel", foreign_keys=[recipientId])

class AIClassificationLogModel(Base):
    """Audit trail of AI triage decisions and the human overrides that followed.

    The complaint row only ever holds the *current* values, so once an officer
    corrects a severity the AI's original call is gone -- and that comparison is
    exactly what is needed to measure classification accuracy. Each row here
    records what the AI said, what it was changed to, and by whom.

    Rows are written on triage (actorId NULL) and on override (actorId set), so
    joining the two gives a labelled dataset for free.
    """

    __tablename__ = "ai_classification_logs"

    logId: Mapped[str] = mapped_column(String, primary_key=True)
    complaintId: Mapped[str] = mapped_column(ForeignKey("complaints.complaintId"), index=True)

    # Which prediction this row is about: "category" or "severity".
    field: Mapped[str] = mapped_column(String, nullable=False)

    # What the AI predicted, and how sure it was.
    aiValue: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    aiConfidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    aiSource: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # The transition actually applied. On a triage row these match the AI value;
    # on an override row newValue is the human's decision.
    previousValue: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    newValue: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # NULL when the AI wrote the row; set to the user who overrode it.
    actorId: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    complaint: Mapped["ComplaintModel"] = relationship()


class FeedbackModel(Base):
    __tablename__ = "feedbacks"
    feedbackId: Mapped[str] = mapped_column(String, primary_key=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comments: Mapped[str] = mapped_column(String, nullable=True)
    submittedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    complaintId: Mapped[str] = mapped_column(ForeignKey("complaints.complaintId"))
    
    complaint: Mapped["ComplaintModel"] = relationship(back_populates="feedbacks")

class IdempotencyKeyModel(Base):
    """A record of a request that must not be performed twice.

    A field worker uploading evidence on a weak connection will retry, and a
    retry after a partial success used to put a second copy of the same photo on
    the complaint -- which then shows up as fabricated "after" evidence.

    The client sends a key it keeps stable across retries; the first request
    stores its response under that key, and every repeat gets the stored
    response back without storing anything again.

    Scoped by (key, endpoint) rather than key alone so a client reusing one key
    for two different operations cannot receive the wrong operation's answer.
    """

    __tablename__ = "idempotency_keys"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    endpoint: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, nullable=False)
    # The response body, JSON-encoded. Replayed verbatim so a retry is
    # indistinguishable from the original call.
    responseJson: Mapped[str] = mapped_column(String, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
