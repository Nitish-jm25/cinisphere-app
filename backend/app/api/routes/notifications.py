from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.sql import get_db_session
from app.models.social_models import Notification, User
from app.schemas.social_schema import NotificationListResponse, NotificationReadRequest
from app.services.notification_service import to_notification_item

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    unread = db.query(func.count(Notification.id)).filter(Notification.user_id == current_user.id, Notification.is_read.is_(False)).scalar() or 0
    return NotificationListResponse(
        notifications=[to_notification_item(db, r) for r in rows],
        unread_count=int(unread),
    )


@router.post("/read")
def mark_read(
    payload: NotificationReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if payload.ids:
        query = query.filter(Notification.id.in_(payload.ids))
    rows = query.all()
    for row in rows:
        row.is_read = True
        db.add(row)
    db.commit()
    return {"success": True, "updated": len(rows)}
