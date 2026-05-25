from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session

from app.core.dependencies import decode_user_from_token, get_current_user
from app.db.sql import get_db_session
from app.models.social_models import Community, CommunityMembership, CommunityMessage, DirectMessage, User
from app.schemas.social_schema import (
    CommunityMessageCreate,
    CommunityMessageItem,
    DirectConversationItem,
    DirectMessageCreate,
    DirectMessageItem,
    PostAuthor,
)
from app.services.notification_service import create_notification
from app.services.social_guard import is_blocked_either_direction


router = APIRouter(prefix="/chat", tags=["CommunityChat"])
_sockets_by_community: dict[int, set[WebSocket]] = defaultdict(set)


def _serialize_direct(row: DirectMessage) -> DirectMessageItem:
    return DirectMessageItem(
        id=row.id,
        sender_id=row.sender_id,
        recipient_id=row.recipient_id,
        created_at=row.created_at,
        read_at=row.read_at,
        message=row.message,
    )


@router.get("/direct/conversations", response_model=list[DirectConversationItem])
def list_direct_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    rows = (
        db.query(DirectMessage)
        .filter(or_(DirectMessage.sender_id == current_user.id, DirectMessage.recipient_id == current_user.id))
        .order_by(desc(DirectMessage.created_at))
        .limit(300)
        .all()
    )
    latest_by_user: dict[int, DirectMessage] = {}
    for row in rows:
        other_id = row.recipient_id if row.sender_id == current_user.id else row.sender_id
        if other_id not in latest_by_user and not is_blocked_either_direction(db, current_user.id, other_id):
            latest_by_user[other_id] = row

    if not latest_by_user:
        return []

    users = db.query(User).filter(User.id.in_(latest_by_user.keys())).all()
    user_map = {user.id: user for user in users}
    conversations: list[DirectConversationItem] = []
    for other_id, last_message in latest_by_user.items():
        other = user_map.get(other_id)
        if not other:
            continue
        unread_count = (
            db.query(DirectMessage)
            .filter(
                DirectMessage.sender_id == other_id,
                DirectMessage.recipient_id == current_user.id,
                DirectMessage.read_at.is_(None),
            )
            .count()
        )
        conversations.append(
            DirectConversationItem(
                user=PostAuthor(id=other.id, username=other.username, avatar_url=other.avatar_url),
                last_message=_serialize_direct(last_message),
                unread_count=unread_count,
            )
        )
    return conversations


@router.get("/direct/{user_id}", response_model=list[DirectMessageItem])
def list_direct_messages(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    other = db.query(User).filter(User.id == user_id).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    if is_blocked_either_direction(db, current_user.id, user_id):
        raise HTTPException(status_code=403, detail="Messages unavailable")

    rows = (
        db.query(DirectMessage)
        .filter(
            or_(
                and_(DirectMessage.sender_id == current_user.id, DirectMessage.recipient_id == user_id),
                and_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == current_user.id),
            )
        )
        .order_by(DirectMessage.created_at.asc())
        .limit(200)
        .all()
    )
    now = datetime.utcnow()
    changed = False
    for row in rows:
        if row.recipient_id == current_user.id and row.read_at is None:
            row.read_at = now
            changed = True
    if changed:
        db.commit()
    return [_serialize_direct(row) for row in rows]


@router.post("/direct/{user_id}", response_model=DirectMessageItem)
def send_direct_message(
    user_id: int,
    payload: DirectMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot message yourself")
    recipient = db.query(User).filter(User.id == user_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    if is_blocked_either_direction(db, current_user.id, user_id):
        raise HTTPException(status_code=403, detail="Messages unavailable")

    row = DirectMessage(sender_id=current_user.id, recipient_id=user_id, message=payload.message.strip())
    db.add(row)
    create_notification(
        db,
        user_id=user_id,
        actor_id=current_user.id,
        notif_type="message",
        message=f"{current_user.username} sent you a message",
        resource_id=current_user.id,
    )
    db.commit()
    db.refresh(row)
    return _serialize_direct(row)


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
