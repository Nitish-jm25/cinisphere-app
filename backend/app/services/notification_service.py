from sqlalchemy.orm import Session

from app.models.social_models import Notification, User


def create_notification(
    db: Session,
    user_id: int,
    actor_id: int | None,
    notif_type: str,
    message: str,
    resource_id: int | None = None,
) -> None:
    if actor_id is not None and actor_id == user_id:
        return
    row = Notification(
        user_id=user_id,
        actor_id=actor_id,
        type=notif_type,
        resource_id=resource_id,
        message=message[:280],
        is_read=False,
    )
    db.add(row)


def to_notification_item(db: Session, n: Notification) -> dict:
    actor_username = None
    actor_avatar_url = None
    if n.actor_id:
        actor = db.query(User).filter(User.id == n.actor_id).first()
        if actor:
            actor_username = actor.username
            actor_avatar_url = actor.avatar_url
    return {
        "id": n.id,
        "type": n.type,
        "actor_id": n.actor_id,
        "actor_username": actor_username,
        "actor_avatar_url": actor_avatar_url,
        "resource_id": n.resource_id,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at,
    }
