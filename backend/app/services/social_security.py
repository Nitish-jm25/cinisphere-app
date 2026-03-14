import hashlib
import secrets
from datetime import datetime, timedelta, timezone


def generate_raw_token(length_bytes: int = 24) -> str:
    return secrets.token_urlsafe(length_bytes)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def future_utc(minutes: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)
