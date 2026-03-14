from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.dependencies import decode_user_from_token, get_current_user
from app.db.sql import get_db_session
from app.models.social_models import Community, CommunityMembership, CommunityMessage, User
from app.schemas.social_schema import CommunityMessageCreate, CommunityMessageItem
from app.services.social_guard import is_blocked_either_direction


router = APIRouter(prefix="/chat", tags=["CommunityChat"])
_sockets_by_community: dict[int, set[WebSocket]] = defaultdict(set)


@router.get("/communities/{community_id}/messages", response_model=list[CommunityMessageItem])
def list_messages(
    community_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    messages = (
        db.query(CommunityMessage)
        .filter(CommunityMessage.community_id == community_id)
        .order_by(CommunityMessage.created_at.asc())
        .all()
    )
    user_ids = {m.user_id for m in messages}
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u for u in users}
    messages = [m for m in messages if not is_blocked_either_direction(db, current_user.id, m.user_id)]

    return [
        CommunityMessageItem(
            id=m.id,
            community_id=m.community_id,
            created_at=m.created_at,
            username=user_map[m.user_id].username if m.user_id in user_map else "unknown",
            avatar_url=user_map[m.user_id].avatar_url if m.user_id in user_map else None,
            message=m.message,
        )
        for m in messages
    ]


@router.post("/communities/{community_id}/messages", response_model=CommunityMessageItem)
def send_message(
    community_id: int,
    payload: CommunityMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    community = db.query(Community).filter(Community.id == community_id).first()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    membership = (
        db.query(CommunityMembership)
        .filter(and_(CommunityMembership.community_id == community_id, CommunityMembership.user_id == current_user.id))
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Join community before chatting")

    row = CommunityMessage(community_id=community_id, user_id=current_user.id, message=payload.message.strip())
    db.add(row)
    db.commit()
    db.refresh(row)

    return CommunityMessageItem(
        id=row.id,
        community_id=row.community_id,
        created_at=row.created_at,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        message=row.message,
    )


@router.websocket("/ws/communities/{community_id}")
async def community_chat_ws(websocket: WebSocket, community_id: int, token: str | None = None):
    await websocket.accept()
    db = next(get_db_session())
    try:
        if not token:
            await websocket.send_json({"type": "error", "detail": "Missing token"})
            await websocket.close(code=1008)
            return
        try:
            current_user = decode_user_from_token(token, db)
        except HTTPException:
            await websocket.send_json({"type": "error", "detail": "Invalid token"})
            await websocket.close(code=1008)
            return

        community = db.query(Community).filter(Community.id == community_id).first()
        if not community:
            await websocket.send_json({"type": "error", "detail": "Community not found"})
            await websocket.close(code=1008)
            return
        membership = (
            db.query(CommunityMembership)
            .filter(and_(CommunityMembership.community_id == community_id, CommunityMembership.user_id == current_user.id))
            .first()
        )
        if not membership:
            await websocket.send_json({"type": "error", "detail": "Join community before chatting"})
            await websocket.close(code=1008)
            return

        _sockets_by_community[community_id].add(websocket)
        while True:
            payload = await websocket.receive_json()
            raw_message = str(payload.get("message", "")).strip()
            if not raw_message:
                continue
            row = CommunityMessage(community_id=community_id, user_id=current_user.id, message=raw_message[:2000])
            db.add(row)
            db.commit()
            db.refresh(row)
            event = {
                "type": "message",
                "id": row.id,
                "community_id": row.community_id,
                "created_at": row.created_at.isoformat(),
                "username": current_user.username,
                "avatar_url": current_user.avatar_url,
                "message": row.message,
            }
            for conn in list(_sockets_by_community[community_id]):
                try:
                    await conn.send_json(event)
                except Exception:
                    _sockets_by_community[community_id].discard(conn)
    except WebSocketDisconnect:
        _sockets_by_community[community_id].discard(websocket)
    finally:
        try:
            db.close()
        except Exception:
            pass
