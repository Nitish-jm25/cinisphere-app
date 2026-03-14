from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.sql import get_db_session
from app.models.social_models import ModerationReport, Post, User, UserBlock
from app.schemas.social_schema import BlockUserRequest, ModerationReportRequest

router = APIRouter(prefix="/moderation", tags=["Moderation"])


@router.post("/block")
def block_user(
    payload: BlockUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if payload.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    target = db.query(User).filter(User.id == payload.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    exists = (
        db.query(UserBlock)
        .filter(and_(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == payload.user_id))
        .first()
    )
    if exists:
        return {"success": True, "message": "Already blocked"}
    db.add(UserBlock(blocker_id=current_user.id, blocked_id=payload.user_id))
    db.commit()
    return {"success": True, "message": "User blocked"}


@router.delete("/block/{user_id}")
def unblock_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    row = (
        db.query(UserBlock)
        .filter(and_(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id))
        .first()
    )
    if not row:
        return {"success": True, "message": "User not blocked"}
    db.delete(row)
    db.commit()
    return {"success": True, "message": "User unblocked"}


@router.get("/blocks")
def list_blocks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    rows = db.query(UserBlock).filter(UserBlock.blocker_id == current_user.id).order_by(desc(UserBlock.created_at)).all()
    user_ids = [row.blocked_id for row in rows]
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u for u in users}
    return {
        "blocked_users": [
            {
                "user_id": row.blocked_id,
                "username": user_map[row.blocked_id].username if row.blocked_id in user_map else "unknown",
                "avatar_url": user_map[row.blocked_id].avatar_url if row.blocked_id in user_map else None,
                "blocked_at": row.created_at,
            }
            for row in rows
        ]
    }


@router.post("/report")
def create_report(
    payload: ModerationReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if not payload.target_user_id and not payload.target_post_id:
        raise HTTPException(status_code=400, detail="Provide target_user_id or target_post_id")
    if payload.target_post_id:
        post = db.query(Post).filter(Post.id == payload.target_post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Target post not found")
    if payload.target_user_id:
        target = db.query(User).filter(User.id == payload.target_user_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Target user not found")

    row = ModerationReport(
        reporter_id=current_user.id,
        target_user_id=payload.target_user_id,
        target_post_id=payload.target_post_id,
        reason=payload.reason.strip(),
        details=(payload.details or "").strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"success": True, "report_id": row.id}


@router.get("/my-reports")
def list_my_reports(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    rows = (
        db.query(ModerationReport)
        .filter(ModerationReport.reporter_id == current_user.id)
        .order_by(desc(ModerationReport.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "reports": [
            {
                "id": row.id,
                "target_user_id": row.target_user_id,
                "target_post_id": row.target_post_id,
                "reason": row.reason,
                "details": row.details,
                "status": row.status,
                "created_at": row.created_at,
            }
            for row in rows
        ]
    }
