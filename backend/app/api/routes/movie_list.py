from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.sql import get_db_session
from app.models.social_models import MovieListItem, User
from app.schemas.social_schema import MovieListItemCreate, MovieListItemResponse, MovieListItemUpdate


router = APIRouter(prefix="/movie-list", tags=["MovieList"])


def _serialize(item: MovieListItem) -> MovieListItemResponse:
    return MovieListItemResponse(
        id=item.id,
        movie_id=item.movie_id,
        title=item.title,
        poster_path=item.poster_path,
        release_date=item.release_date,
        status=item.status,
        rating=item.rating,
        notes=item.notes or "",
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=list[MovieListItemResponse])
def list_movie_items(
    status: str = Query(default="all", pattern="^(all|watchlist|watched)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    query = db.query(MovieListItem).filter(MovieListItem.user_id == current_user.id)
    if status != "all":
        query = query.filter(MovieListItem.status == status)
    rows = query.order_by(desc(MovieListItem.updated_at), desc(MovieListItem.created_at)).all()
    return [_serialize(row) for row in rows]


@router.post("", response_model=MovieListItemResponse)
def upsert_movie_item(
    payload: MovieListItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    item = (
        db.query(MovieListItem)
        .filter(and_(MovieListItem.user_id == current_user.id, MovieListItem.movie_id == payload.movie_id))
        .first()
    )
    if not item:
        item = MovieListItem(user_id=current_user.id, movie_id=payload.movie_id)

    item.title = payload.title.strip()
    item.poster_path = payload.poster_path
    item.release_date = payload.release_date
    item.status = payload.status
    item.rating = payload.rating
    item.notes = payload.notes.strip()
    item.updated_at = datetime.utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.patch("/{item_id}", response_model=MovieListItemResponse)
def update_movie_item(
    item_id: int,
    payload: MovieListItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    item = db.query(MovieListItem).filter(MovieListItem.id == item_id, MovieListItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Movie list item not found")

    if payload.status is not None:
        item.status = payload.status
    if payload.rating is not None or "rating" in payload.model_fields_set:
        item.rating = payload.rating
    if payload.notes is not None:
        item.notes = payload.notes.strip()
    item.updated_at = datetime.utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.delete("/{item_id}")
def delete_movie_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    item = db.query(MovieListItem).filter(MovieListItem.id == item_id, MovieListItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Movie list item not found")
    db.delete(item)
    db.commit()
    return {"success": True}
