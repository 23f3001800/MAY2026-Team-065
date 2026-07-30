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
    
    # Relationships
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
    
    complaints: Mapped[List["ComplaintModel"]] = relationship(back_populates="category")

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
    
    # Relationships mapping back to users and properties
    location: Mapped["LocationModel"] = relationship(back_populates="complaint")
    category: Mapped["CategoryModel"] = relationship(back_populates="complaints")
    citizen: Mapped["CitizenModel"] = relationship(back_populates="complaints")
    officer: Mapped["MunicipalOfficerModel"] = relationship(back_populates="complaints")
    field_worker: Mapped["FieldWorkerModel"] = relationship(back_populates="complaints")
    
    # One-to-Many relationships for supporting features
    media_attachments: Mapped[List["MediaAttachmentModel"]] = relationship(back_populates="complaint")
    status_histories: Mapped[List["StatusHistoryModel"]] = relationship(back_populates="complaint")
    notifications: Mapped[List["NotificationModel"]] = relationship(back_populates="complaint")
    feedbacks: Mapped[List["FeedbackModel"]] = relationship(back_populates="complaint")


# --- Supporting Entities ---
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
    
    complaint: Mapped["ComplaintModel"] = relationship(back_populates="notifications")

class FeedbackModel(Base):
    __tablename__ = "feedbacks"
    feedbackId: Mapped[str] = mapped_column(String, primary_key=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comments: Mapped[str] = mapped_column(String, nullable=True)
    submittedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    complaintId: Mapped[str] = mapped_column(ForeignKey("complaints.complaintId"))
    
    complaint: Mapped["ComplaintModel"] = relationship(back_populates="feedbacks")