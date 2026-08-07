"""Notification inbox API.

Available to every authenticated role. The previous ``/notifications/me``
implementation was citizen-only and resolved the recipient by joining through
``complaint.citizenId``; it now reads the explicit ``recipientId``, so field
workers and officers have real inboxes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

import models
import schemas
from dependencies import get_current_user, get_db
from services import notifications as notification_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "/me",
    response_model=List[schemas.NotificationResponse],
    summary="List my notifications",
)
async def list_my_notifications(
    unreadOnly: bool = Query(False, description="Return only unread notifications"),
    type: Optional[str] = Query(None, description="Filter by notification type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    """Return the current user's notifications, newest first."""
    return await notification_service.list_for_user(
        db,
        current_user.userId,
        unread_only=unreadOnly,
        type_filter=type,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/me/unread-count",
    response_model=schemas.UnreadCountResponse,
    summary="Count my unread notifications",
)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    """Cheap badge count for the navigation bar."""
    count = await notification_service.unread_count(db, current_user.userId)
    return {"unread": count}


@router.patch(
    "/{notificationId}/read",
    response_model=schemas.NotificationResponse,
    summary="Mark a notification read or unread",
)
async def mark_notification_read(
    notificationId: str,
    update: schemas.NotificationReadUpdate = schemas.NotificationReadUpdate(),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    """Persist read state for one notification the caller owns."""
    notification = await notification_service.get_for_user(
        db, notificationId, current_user.userId
    )
    if not notification:
        # Ownership is folded into the lookup, so someone else's ID is reported
        # as "not found" rather than "forbidden" -- no probing for valid IDs.
        raise HTTPException(status_code=404, detail="Notification not found.")

    notification.isRead = update.isRead
    notification.readAt = (
        datetime.now(timezone.utc).replace(tzinfo=None) if update.isRead else None
    )

    await db.commit()
    await db.refresh(notification)
    return notification


@router.post(
    "/me/read-all",
    response_model=schemas.MarkAllReadResponse,
    summary="Mark all my notifications read",
)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    updated = await notification_service.mark_all_read(db, current_user.userId)
    await db.commit()
    return {"message": "All notifications marked as read.", "updated": updated}


@router.delete(
    "/{notificationId}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a notification",
)
async def delete_notification(
    notificationId: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
):
    """Remove a notification from the caller's own inbox."""
    notification = await notification_service.get_for_user(
        db, notificationId, current_user.userId
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")

    await db.delete(notification)
    await db.commit()
    return None
