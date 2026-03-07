import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_current_user_optional
from app.db.sql import get_db_session
from app.models.social_models import Follow, User
from app.schemas.social_schema import (
    FollowActionResponse,
    SearchUsersResponse,
    UpdateProfileRequest,
    UserProfileResponse,
    UserPublic,
)


router = APIRouter(prefix="/users", tags=["Users"])
AVATAR_UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "avatars"
AVATAR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/search", response_model=SearchUsersResponse)
def search_users(
    q: str = Query(min_length=1),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db_session),
):
    users = (
        db.query(User)
        .filter(User.username.ilike(f"%{q.strip()}%"))
        .order_by(User.created_at.desc())
        .limit(limit)
        .all()
    )
    return SearchUsersResponse(users=users)


@router.get("/suggestions", response_model=SearchUsersResponse)
def suggestions(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    following_subquery = db.query(Follow.following_id).filter(Follow.follower_id == current_user.id)

    users = (
        db.query(User)
        .filter(User.id != current_user.id)
        .filter(~User.id.in_(following_subquery))
        .order_by(User.created_at.desc())
        .limit(limit)
        .all()
    )
    return SearchUsersResponse(users=users)


@router.get("/discover", response_model=SearchUsersResponse)
def discover_users(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    users = (
        db.query(User)
        .filter(User.id != current_user.id)
        .filter(
            or_(
                User.email.like("%@seed.example.com"),
                User.email.like("%@seed.local"),
                User.email.notlike("%@seed.example.com"),
            )
        )
        .order_by(
            (User.email.like("%@seed.example.com") | User.email.like("%@seed.local")).desc(),
            User.created_at.asc(),
        )
        .limit(limit)
        .all()
    )
    return SearchUsersResponse(users=users)


@router.get("/{username}", response_model=UserProfileResponse)
def get_user_profile(
    username: str,
    db: Session = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    followers_count = db.query(func.count(Follow.id)).filter(Follow.following_id == user.id).scalar() or 0
    following_count = db.query(func.count(Follow.id)).filter(Follow.follower_id == user.id).scalar() or 0
    is_following = False

    if current_user:
        relation = (
            db.query(Follow)
            .filter(and_(Follow.follower_id == current_user.id, Follow.following_id == user.id))
            .first()
        )
        is_following = relation is not None

    return UserProfileResponse(
        user=user,
        followers_count=followers_count,
        following_count=following_count,
        is_following=is_following,
    )


@router.put("/profile", response_model=UserPublic)
def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/profile/avatar", response_model=UserPublic)
def upload_avatar(
    request: Request,
    avatar_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if not avatar_file.filename:
        raise HTTPException(status_code=400, detail="Avatar file is required")

    ext = Path(avatar_file.filename).suffix.lower()
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    file_name = f"{uuid.uuid4().hex}{ext}"
    destination = AVATAR_UPLOAD_DIR / file_name
    with destination.open("wb") as buffer:
        shutil.copyfileobj(avatar_file.file, buffer)

    current_user.avatar_url = f"{request.base_url}uploads/avatars/{file_name}".rstrip("/")
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/{user_id}/follow", response_model=FollowActionResponse)
def follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    exists = db.query(Follow).filter(and_(Follow.follower_id == current_user.id, Follow.following_id == user_id)).first()
    if exists:
        return FollowActionResponse(success=True, message="Already following")

    db.add(Follow(follower_id=current_user.id, following_id=user_id))
    db.commit()
    return FollowActionResponse(success=True, message="Followed")


@router.delete("/{user_id}/follow", response_model=FollowActionResponse)
def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    relation = db.query(Follow).filter(and_(Follow.follower_id == current_user.id, Follow.following_id == user_id)).first()
    if not relation:
        return FollowActionResponse(success=True, message="Not following")

    db.delete(relation)
    db.commit()
    return FollowActionResponse(success=True, message="Unfollowed")
