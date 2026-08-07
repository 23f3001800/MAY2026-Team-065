"""Shared FastAPI dependencies.

Extracted from ``main.py`` so that routers can depend on authentication and the
database session without importing the application module (which would be a
circular import, since ``main`` includes the routers).

``main`` re-exports these names, so existing routes and any code importing them
from ``main`` keep working unchanged.
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator, Iterable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models
import security
from database import AsyncSessionLocal

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> models.UserModel:
    """Decode the bearer token and load the matching user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    result = await db.execute(select(models.UserModel).where(models.UserModel.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    return user


def require_roles(user: models.UserModel, allowed: Iterable[str], action: str) -> None:
    """Raise 403 unless the user holds one of the allowed roles.

    Role strings are compared lowercase. Note that municipal officers are stored
    with the polymorphic identity ``officer``, while some request bodies accept
    ``municipal_officer`` -- both are treated as the same role here.
    """
    allowed_set = {role.lower() for role in allowed}
    if "officer" in allowed_set:
        allowed_set.add("municipal_officer")

    if (user.role or "").lower() not in allowed_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your role ('{user.role}') is not permitted to {action}.",
        )
