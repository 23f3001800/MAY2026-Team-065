import os
import enum
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

# .strip() because a connection string pasted into a hosting dashboard very
# often carries a trailing newline, and the failure it causes names the wrong
# culprit: the newline lands inside the database name, so the server answers
#
#     asyncpg.exceptions.InvalidCatalogNameError: database "postgres
#     " does not exist
#
# which reads as a missing database rather than a stray character, and sends
# whoever is deploying to go and create a database that is already there.
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in."
    )

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class StatusEnum(str, enum.Enum):
    """Complaint lifecycle, in roughly the order a complaint moves through it.

    Three phases:
      * Intake & triage  -- PENDING, UNDER_REVIEW
      * Action & dispatch -- ASSIGNED, IN_PROGRESS, ON_HOLD, ESCALATED
      * Closure & validation -- RESOLVED, VERIFIED, REOPENED, REJECTED

    Note for migrations: PostgreSQL stores this as a real enum type, so adding a
    member here is NOT picked up by create_all(). migrations.py issues the
    matching ALTER TYPE ... ADD VALUE.
    """

    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    ON_HOLD = "ON_HOLD"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    VERIFIED = "VERIFIED"
    REOPENED = "REOPENED"
    REJECTED = "REJECTED"


# Statuses that mean the complaint is no longer active work.
TERMINAL_STATUSES = {StatusEnum.VERIFIED, StatusEnum.REJECTED}

# Statuses an SLA timer should keep running through.
OPEN_STATUSES = {
    StatusEnum.PENDING,
    StatusEnum.UNDER_REVIEW,
    StatusEnum.ASSIGNED,
    StatusEnum.IN_PROGRESS,
    StatusEnum.ON_HOLD,
    StatusEnum.ESCALATED,
    StatusEnum.REOPENED,
}

class SeverityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"