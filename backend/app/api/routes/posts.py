import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.sql import get_db_session
from app.models.social_models import Comment, Follow, Like, Post, PostMedia, User
from app.schemas.social_schema import (
    CommentCreateRequest,
    CommentResponse,
    PostAuthor,
    PostCommentItem,
    PostCreateRequest,
    PostResponse,
)


router = APIRouter(prefix="/posts", tags=["Posts"])
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "posts"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _build_post_response(db: Session, post: Post, current_user_id: int) -> PostResponse:
    likes_count = db.query(func.count(Like.id)).filter(Like.post_id == post.id).scalar() or 0
    comments_count = db.query(func.count(Comment.id)).filter(Comment.post_id == post.id).scalar() or 0
    is_liked = (
        db.query(Like)
        .filter(and_(Like.post_id == post.id, Like.user_id == current_user_id))
        .first()
        is not None
    )
    author = db.query(User).filter(User.id == post.user_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Post author not found")

    media = (
        db.query(PostMedia)
        .filter(PostMedia.post_id == post.id)
        .order_by(PostMedia.position.asc(), PostMedia.id.asc())
        .all()
    )
    image_urls = [m.image_url for m in media] or [post.image_url]

    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        image_url=post.image_url,
        caption=post.caption,
        created_at=post.created_at,
        likes_count=likes_count,
        comments_count=comments_count,
        is_liked=is_liked,
        author=PostAuthor(id=author.id, username=author.username, avatar_url=author.avatar_url),
        image_urls=image_urls,
    )


@router.post("", response_model=PostResponse)
def create_post(
    payload: PostCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    caption = payload.caption.strip()
    if payload.movie_title:
        caption = f"Review on {payload.movie_title.strip()}\n\n{caption}".strip()

    post = Post(user_id=current_user.id, image_url=payload.image_url.strip(), caption=caption)
    db.add(post)
    db.flush()
    db.add(PostMedia(post_id=post.id, image_url=payload.image_url.strip(), position=0))
    db.commit()
    db.refresh(post)
    return _build_post_response(db, post, current_user.id)


@router.post("/upload", response_model=PostResponse)
def create_post_with_upload(
    request: Request,
    caption: str = Form(default=""),
    movie_title: str | None = Form(default=None),
    image_url: str | None = Form(default=None),
    image_file: UploadFile | None = File(default=None),
    image_files: list[UploadFile] | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    normalized_caption = caption.strip()
    if movie_title and movie_title.strip():
        normalized_caption = f"Review on {movie_title.strip()}\n\n{normalized_caption}".strip()

    final_image_url = (image_url or "").strip()
    gathered_urls: list[str] = []

    if final_image_url:
        gathered_urls.append(final_image_url)

    files_to_process = []
    if image_files:
        files_to_process.extend([f for f in image_files if f and f.filename])
    if image_file and image_file.filename:
        files_to_process.append(image_file)

    for file_obj in files_to_process:
        ext = Path(file_obj.filename).suffix.lower()
        allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        if ext not in allowed:
            raise HTTPException(status_code=400, detail="Only image files are allowed")

        file_name = f"{uuid.uuid4().hex}{ext}"
        destination = UPLOAD_DIR / file_name
        with destination.open("wb") as buffer:
            shutil.copyfileobj(file_obj.file, buffer)
        gathered_urls.append(f"{request.base_url}uploads/posts/{file_name}".rstrip("/"))

    if not gathered_urls:
        raise HTTPException(status_code=400, detail="Provide an image URL or upload an image file")

    post = Post(user_id=current_user.id, image_url=gathered_urls[0], caption=normalized_caption)
    db.add(post)
    db.flush()
    for idx, media_url in enumerate(gathered_urls):
        db.add(PostMedia(post_id=post.id, image_url=media_url, position=idx))
    db.commit()
    db.refresh(post)
    return _build_post_response(db, post, current_user.id)


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    db.delete(post)
    db.commit()
    return {"success": True}


@router.get("/feed", response_model=list[PostResponse])
def get_feed(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    following_subquery = db.query(Follow.following_id).filter(Follow.follower_id == current_user.id)

    posts = (
        db.query(Post)
        .filter((Post.user_id == current_user.id) | (Post.user_id.in_(following_subquery)))
        .order_by(desc(Post.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_build_post_response(db, post, current_user.id) for post in posts]


@router.get("/user/{user_id}", response_model=list[PostResponse])
def get_posts_by_user(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    posts = (
        db.query(Post)
        .filter(Post.user_id == user_id)
        .order_by(desc(Post.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_build_post_response(db, post, current_user.id) for post in posts]


@router.post("/{post_id}/like")
def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(Like).filter(and_(Like.post_id == post_id, Like.user_id == current_user.id)).first()
    if existing:
        return {"success": True, "message": "Already liked"}

    db.add(Like(post_id=post_id, user_id=current_user.id))
    db.commit()
    return {"success": True, "message": "Liked"}


@router.delete("/{post_id}/like")
def unlike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    existing = db.query(Like).filter(and_(Like.post_id == post_id, Like.user_id == current_user.id)).first()
    if not existing:
        return {"success": True, "message": "Not liked"}

    db.delete(existing)
    db.commit()
    return {"success": True, "message": "Unliked"}


@router.post("/{post_id}/comment", response_model=CommentResponse)
def add_comment(
    post_id: int,
    payload: CommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = Comment(post_id=post_id, user_id=current_user.id, content=payload.content.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        content=comment.content,
        created_at=comment.created_at,
        author=PostAuthor(id=current_user.id, username=current_user.username, avatar_url=current_user.avatar_url),
    )


@router.get("/{post_id}/comments", response_model=list[PostCommentItem])
def list_comments(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = (
        db.query(Comment)
        .filter(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .all()
    )

    user_ids = {c.user_id for c in comments}
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u for u in users}

    return [
        PostCommentItem(
            id=c.id,
            content=c.content,
            created_at=c.created_at,
            author=PostAuthor(
                id=c.user_id,
                username=user_map[c.user_id].username if c.user_id in user_map else "unknown",
                avatar_url=user_map[c.user_id].avatar_url if c.user_id in user_map else None,
            ),
        )
        for c in comments
    ]
