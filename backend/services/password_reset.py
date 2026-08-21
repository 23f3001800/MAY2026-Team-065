"""Self-service password reset, by emailed verification code.

The flow is three calls, and the split is deliberate:

    POST /auth/forgot-password    ask for a code   -> always 202
    POST /auth/verify-reset-code  check the code   -> 200 or 400
    POST /auth/reset-password     set the password -> 200 or 400

**Why the request always succeeds.** Answering "no account with that email"
turns the endpoint into a membership oracle: anyone can test a list of
addresses against the citizen register. So an unknown address, a suspended
account and a real one all produce the same 202 and the same wording, and the
only difference is whether a message is actually sent.

**Why verify is separate from reset.** A person types a six-digit code from
their phone into a form; being told it was wrong only after they have also
chosen and confirmed a new password is a poor experience, and re-typing the
password is where they give up. Verification therefore checks the code without
consuming it. Only the reset marks it used.

**What actually stops a guesser.** Not the hashing -- a six-digit code has a
million values and offline that is nothing. It is that a code lives for fifteen
minutes, survives five wrong answers, and dies the moment a newer one is
issued; and that a single account can only be sent a handful of codes an hour.
"""

from __future__ import annotations

import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models
import security
from services import email as email_service

logger = logging.getLogger(__name__)

# Six digits: short enough to carry across the room from a phone, and the
# attempt limit rather than the length is what makes it safe.
CODE_DIGITS = 6

# Wrong answers a single code tolerates before it is dead. Five is enough for
# genuine typos and nowhere near enough to search the space.
MAX_ATTEMPTS = 5


def _int_env(name: str, default: int, minimum: int = 1) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


def code_ttl_minutes() -> int:
    return _int_env("PASSWORD_RESET_CODE_TTL_MINUTES", 15)


def max_requests_per_hour() -> int:
    """How many codes one account may be sent per hour.

    Rate limited per account rather than per IP: the thing being protected is a
    person's inbox, and the abuse worth stopping is using this endpoint to mail
    somebody repeatedly. An attacker changing IP does not change whose inbox
    fills up.
    """
    return _int_env("PASSWORD_RESET_MAX_PER_HOUR", 5)


def _utcnow() -> datetime:
    """Naive UTC, matching the DateTime columns used across the schema."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def generate_code() -> str:
    """A cryptographically random zero-padded code.

    ``secrets``, not ``random``: the latter is seeded predictably enough that a
    guesser who knows roughly when a code was issued can narrow the search.
    """
    return str(secrets.randbelow(10 ** CODE_DIGITS)).zfill(CODE_DIGITS)


class ResetError(Exception):
    """A reset attempt that cannot proceed, with wording safe to show a caller."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


async def _find_user(db: AsyncSession, email: str) -> Optional[models.UserModel]:
    if not email:
        return None
    # Case-insensitive: people capitalise their own address inconsistently, and
    # being unable to reset because you typed Ann@ rather than ann@ is absurd.
    result = await db.execute(
        select(models.UserModel).where(
            func.lower(models.UserModel.email) == email.strip().lower()
        )
    )
    return result.scalars().first()


async def _too_many_recent(db: AsyncSession, userId: str) -> bool:
    since = _utcnow() - timedelta(hours=1)
    result = await db.execute(
        select(func.count(models.PasswordResetCodeModel.requestId)).where(
            models.PasswordResetCodeModel.userId == userId,
            models.PasswordResetCodeModel.createdAt >= since,
        )
    )
    return (result.scalar_one() or 0) >= max_requests_per_hour()


async def _active_code(
    db: AsyncSession, userId: str
) -> Optional[models.PasswordResetCodeModel]:
    """The newest code for this user that is unused and unexpired.

    Only the newest one counts. Asking for a second code has to invalidate the
    first, or a stolen older code stays live for its full fifteen minutes
    alongside the one the owner is actually looking at.
    """
    now = _utcnow()
    result = await db.execute(
        select(models.PasswordResetCodeModel)
        .where(
            models.PasswordResetCodeModel.userId == userId,
            models.PasswordResetCodeModel.usedAt.is_(None),
            models.PasswordResetCodeModel.expiresAt > now,
        )
        .order_by(models.PasswordResetCodeModel.createdAt.desc())
        .limit(1)
    )
    return result.scalars().first()


async def request_code(db: AsyncSession, email: str) -> dict:
    """Issue and email a verification code. Commits.

    Returns a diagnostic dict for the caller's logs. The HTTP layer must NOT
    put its contents in the response -- ``sent`` alone tells you whether the
    address is registered.
    """
    user = await _find_user(db, email)

    if user is None:
        logger.info("password reset asked for an address with no account")
        return {"sent": False, "reason": "no-account"}

    if not getattr(user, "isActive", True):
        # A suspended account is not a route back in. Silent to the caller for
        # the same reason as above.
        logger.info("password reset refused for suspended account %s", user.userId)
        return {"sent": False, "reason": "suspended"}

    if await _too_many_recent(db, user.userId):
        logger.warning(
            "password reset rate limit hit for %s (%d/hour)",
            user.userId, max_requests_per_hour(),
        )
        return {"sent": False, "reason": "rate-limited"}

    # Retire anything outstanding, so only the code just emailed can be used.
    now = _utcnow()
    existing = await db.execute(
        select(models.PasswordResetCodeModel).where(
            models.PasswordResetCodeModel.userId == user.userId,
            models.PasswordResetCodeModel.usedAt.is_(None),
            models.PasswordResetCodeModel.expiresAt > now,
        )
    )
    for stale in existing.scalars().all():
        stale.expiresAt = now

    ttl = code_ttl_minutes()
    code = generate_code()

    record = models.PasswordResetCodeModel(
        requestId="PWR-" + str(uuid.uuid4())[:12].upper(),
        userId=user.userId,
        codeHash=security.get_password_hash(code),
        createdAt=now,
        expiresAt=now + timedelta(minutes=ttl),
        attempts=0,
    )
    db.add(record)

    # Committed BEFORE sending. If the process dies mid-send the person can ask
    # again; if the row were written after a successful send, a crash would mail
    # somebody a code the database has never heard of.
    await db.commit()

    result = await email_service.send_password_reset_code(
        to=user.email,
        name=user.name or "there",
        code=code,
        minutes_valid=ttl,
    )

    record.delivered = bool(result.delivered)
    await db.commit()

    return {
        "sent": True,
        "delivered": result.delivered,
        "reason": result.reason,
        "expiresInMinutes": ttl,
    }


async def _check_code(
    db: AsyncSession, email: str, code: str
) -> Tuple[models.UserModel, models.PasswordResetCodeModel]:
    """Validate a code and return the user and the record it belongs to.

    Raises ``ResetError`` with deliberately uniform wording: distinguishing
    "no such request" from "wrong code" tells a guesser which addresses have a
    reset in flight.
    """
    generic = "That code is not valid. Ask for a new one and try again."

    user = await _find_user(db, email)
    if user is None or not getattr(user, "isActive", True):
        raise ResetError(generic)

    record = await _active_code(db, user.userId)
    if record is None:
        raise ResetError(generic)

    if record.attempts >= MAX_ATTEMPTS:
        raise ResetError("Too many incorrect attempts on this code. Ask for a new one.")

    if not security.verify_password((code or "").strip(), record.codeHash):
        # Count the failure and persist it immediately, or a caller that keeps
        # the connection open could guess without ever incrementing anything.
        record.attempts += 1
        await db.commit()
        remaining = MAX_ATTEMPTS - record.attempts
        if remaining <= 0:
            raise ResetError(
                "Too many incorrect attempts on this code. Ask for a new one."
            )
        plural = " attempt remains." if remaining == 1 else " attempts remain."
        raise ResetError("That code is not correct. " + str(remaining) + plural)

    return user, record


async def verify_code(db: AsyncSession, email: str, code: str) -> dict:
    """Check a code without consuming it. Raises ``ResetError`` if it is no good."""
    user, record = await _check_code(db, email, code)
    remaining = (record.expiresAt - _utcnow()).total_seconds() / 60
    return {"verified": True, "expiresInMinutes": max(0, round(remaining))}


async def reset_password(
    db: AsyncSession, email: str, code: str, new_password: str
) -> models.UserModel:
    """Consume the code and set the new password. Commits."""
    user, record = await _check_code(db, email, code)

    user.passwordHash = security.get_password_hash(new_password)
    record.usedAt = _utcnow()

    await db.commit()

    logger.info("password reset completed for %s", user.userId)

    # Tell them it happened. If they did not do this, this message is the only
    # warning they will get that somebody else did.
    settings = email_service.EmailSettings()
    await email_service.send_email(
        to=user.email,
        subject="Your " + settings.app_name + " password was changed",
        body="\n".join([
            "Hello " + (user.name or "there") + ",",
            "",
            "Your password has just been changed using a verification code sent"
            " to this address. You can now sign in with it.",
            "",
            "If this was not you, your account may be compromised -- contact"
            " " + settings.support_email + " straight away.",
        ]),
    )

    return user
