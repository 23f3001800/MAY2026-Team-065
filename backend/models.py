from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Enum, Boolean
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

class FeedbackModel(Base):
    __tablename__ = "feedbacks"
    feedbackId: Mapped[str] = mapped_column(String, primary_key=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comments: Mapped[str] = mapped_column(String, nullable=True)
    submittedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    complaintId: Mapped[str] = mapped_column(ForeignKey("complaints.complaintId"))
    
    complaint: Mapped["ComplaintModel"] = relationship(back_populates="feedbacks")