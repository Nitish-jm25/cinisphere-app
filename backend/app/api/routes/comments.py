from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.sql import get_db_session
from app.models.social_models import Comment, Post, User


router = APIRouter(tags=["Comments"])


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    post = db.query(Post).filter(Post.id == comment.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if comment.user_id != current_user.id and post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")

    db.delete(comment)
    db.commit()
    return {"success": True}
