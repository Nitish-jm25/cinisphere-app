from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.sql import get_db_session
from app.models.social_models import Community, CommunityMembership, CommunityPost, Post, User
from app.schemas.social_schema import (
    CommunityListResponse,
    CommunityMemberItem,
    CommunityMembersResponse,
    CommunityPostCreate,
    CommunitySummary,
    PostResponse,
)
from app.api.routes.posts import _build_post_response


router = APIRouter(prefix="/communities", tags=["Communities"])


@router.get("", response_model=CommunityListResponse)
def list_communities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    communities = db.query(Community).order_by(Community.name.asc()).all()
    if not communities:
        return CommunityListResponse(communities=[])

    community_ids = [c.id for c in communities]

    counts = (
        db.query(CommunityMembership.community_id, func.count(CommunityMembership.id))
        .filter(CommunityMembership.community_id.in_(community_ids))
        .group_by(CommunityMembership.community_id)
        .all()
    )
    count_map = {cid: cnt for cid, cnt in counts}

    joined_rows = (
        db.query(CommunityMembership.community_id)
        .filter(
            and_(
                CommunityMembership.user_id == current_user.id,
                CommunityMembership.community_id.in_(community_ids),
            )
        )
        .all()
    )
    joined_set = {row[0] for row in joined_rows}

    return CommunityListResponse(
        communities=[
            CommunitySummary(
                id=c.id,
                name=c.name,
                description=c.description,
                image_url=c.image_url,
                member_count=int(count_map.get(c.id, 0)),
                joined=c.id in joined_set,
            )
            for c in communities
        ]
    )


@router.post("/{community_id}/join")
def join_community(
    community_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    existing = (
        db.query(CommunityMembership)
        .filter(and_(CommunityMembership.community_id == community_id, CommunityMembership.user_id == current_user.id))
        .first()
    )
    if existing:
        return {"success": True, "message": "Already joined"}

    db.add(CommunityMembership(community_id=community_id, user_id=current_user.id))
    db.commit()
    return {"success": True, "message": "Joined"}


@router.delete("/{community_id}/leave")
def leave_community(
    community_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    membership = (
        db.query(CommunityMembership)
        .filter(and_(CommunityMembership.community_id == community_id, CommunityMembership.user_id == current_user.id))
        .first()
    )
    if not membership:
        return {"success": True, "message": "Not a member"}

    db.delete(membership)
    db.commit()
    return {"success": True, "message": "Left"}


@router.get("/{community_id}/members", response_model=CommunityMembersResponse)
def get_members(
    community_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    rows = (
        db.query(User)
        .join(CommunityMembership, CommunityMembership.user_id == User.id)
        .filter(CommunityMembership.community_id == community_id)
        .order_by(User.username.asc())
        .all()
    )
    return CommunityMembersResponse(
        members=[
            CommunityMemberItem(id=u.id, username=u.username, avatar_url=u.avatar_url, bio=u.bio)
            for u in rows
        ]
    )


@router.get("/{community_id}/posts", response_model=list[PostResponse])
def list_community_posts(
    community_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    post_ids = (
        db.query(CommunityPost.post_id)
        .filter(CommunityPost.community_id == community_id)
        .order_by(desc(CommunityPost.created_at))
        .all()
    )
    ids = [pid for (pid,) in post_ids]
    if not ids:
        return []

    posts = db.query(Post).filter(Post.id.in_(ids)).all()
    post_map = {p.id: p for p in posts}
    ordered = [post_map[i] for i in ids if i in post_map]
    return [_build_post_response(db, p, current_user.id) for p in ordered]


@router.post("/{community_id}/posts", response_model=PostResponse)
def create_community_post(
    community_id: int,
    payload: CommunityPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    membership = (
        db.query(CommunityMembership)
        .filter(and_(CommunityMembership.community_id == community_id, CommunityMembership.user_id == current_user.id))
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Join community before posting")

    from app.models.social_models import PostMedia

    caption = payload.caption.strip()
    if payload.movie_title:
        caption = f"Review on {payload.movie_title.strip()}\n\n{caption}".strip()

    post = Post(user_id=current_user.id, image_url=payload.image_url.strip(), caption=caption)
    db.add(post)
    db.flush()
    db.add(PostMedia(post_id=post.id, image_url=payload.image_url.strip(), position=0))
    db.add(CommunityPost(community_id=community_id, post_id=post.id))
    db.commit()
    db.refresh(post)
    return _build_post_response(db, post, current_user.id)
