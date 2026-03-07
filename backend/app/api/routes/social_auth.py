import hashlib

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import create_access_token
from app.db.sql import get_db_session
from app.models.social_models import User
from app.schemas.social_schema import AuthTokenResponse, LoginRequest, RegisterRequest


router = APIRouter(prefix="/auth", tags=["SocialAuth"])


def _normalize_password(password: str) -> bytes:
    # Pre-hash avoids bcrypt's 72-byte input limit and keeps verification stable.
    return hashlib.sha256(password.encode("utf-8")).digest()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(_normalize_password(password), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        hashed = stored_hash.encode("utf-8")
        # New scheme
        if bcrypt.checkpw(_normalize_password(password), hashed):
            return True
        # Backward compatibility for previously stored raw bcrypt passwords
        return bcrypt.checkpw(password.encode("utf-8"), hashed)
    except Exception:
        return False


@router.post("/register", response_model=AuthTokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db_session)):
    existing_email = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already in use")

    existing_username = db.query(User).filter(User.username == payload.username.strip()).first()
    if existing_username:
        raise HTTPException(status_code=409, detail="Username already in use")

    user = User(
        username=payload.username.strip(),
        email=payload.email.lower().strip(),
        password_hash=_hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return AuthTokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        email=user.email,
    )


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db_session)):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(str(user.id))
    return AuthTokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        email=user.email,
    )
