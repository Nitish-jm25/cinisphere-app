from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.social_models import UserBlock


def is_blocked_either_direction(db: Session, user_a_id: int, user_b_id: int) -> bool:
    if user_a_id == user_b_id:
        return False
    row = (
        db.query(UserBlock)
        .filter(
            (and_(UserBlock.blocker_id == user_a_id, UserBlock.blocked_id == user_b_id))
            | (and_(UserBlock.blocker_id == user_b_id, UserBlock.blocked_id == user_a_id))
        )
        .first()
    )
    return row is not None
