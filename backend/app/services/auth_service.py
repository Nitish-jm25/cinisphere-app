from datetime import datetime, timezone
from typing import Any

import bcrypt
from bson import ObjectId
from pymongo import MongoClient

from app.core.config import settings
from ml_engine.serving import user_manager
from app.services.tailor_fit_service import (
    build_profile_vector_from_survey,
    normalize_survey_dict,
)


def _db():
    client = MongoClient(settings.MONGO_URI)
    return client, client[settings.DATABASE_NAME]


def _log_auth_event(
    users_collection,
    user_id: str,
    event_type: str,
    email: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
):
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$push": {
                "auth_events": {
                    "event_type": event_type,
                    "email": email.lower().strip(),
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                    "created_at": datetime.now(timezone.utc),
                }
            }
        },
    )


def sign_up(
    name: str,
    email: str,
    password: str,
    survey: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    user_id = user_manager.create_user(name=name, email=email, password=password)
    has_profile = False

    client, db = _db()
    try:
        users = db["users"]
        db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "updated_at": datetime.now(timezone.utc),
                    "last_login_at": None,
                    "last_login_ip": None,
                    "last_login_user_agent": None,
                    "login_count": 0,
                },
            },
            upsert=False,
        )
        db["user_history"].update_one(
            {"user_id": ObjectId(user_id)},
            {
                "$setOnInsert": {
                    "user_id": ObjectId(user_id),
                    "watched": [],
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

        _log_auth_event(
            users_collection=users,
            user_id=user_id,
            event_type="signup",
            email=email,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    finally:
        client.close()

    if survey:
        survey_data = normalize_survey_dict(survey)
        profile_vector = build_profile_vector_from_survey(survey_data)
        user_manager.save_user_profile(
            user_id=user_id,
            survey_data=survey_data,
            profile_vector=profile_vector,
        )
        has_profile = True

    return {
        "user_id": user_id,
        "name": name,
        "email": email,
        "has_profile": has_profile,
    }


def sign_in(
    email: str,
    password: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any] | None:
    client, db = _db()
    try:
        users = db["users"]
        user_doc = users.find_one({"email": email.lower().strip()})
        if not user_doc:
            return None

        hashed = user_doc.get("password")
        if not hashed:
            return None

        if not bcrypt.checkpw(password.encode("utf-8"), hashed):
            return None

        users.update_one(
            {"_id": user_doc["_id"]},
            {
                "$set": {
                    "last_login_at": datetime.now(timezone.utc),
                    "last_login_ip": ip_address,
                    "last_login_user_agent": user_agent,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$inc": {"login_count": 1},
            },
        )
        db["user_history"].update_one(
            {"user_id": user_doc["_id"]},
            {
                "$setOnInsert": {
                    "user_id": user_doc["_id"],
                    "watched": [],
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

        _log_auth_event(
            users_collection=users,
            user_id=str(user_doc["_id"]),
            event_type="signin",
            email=email,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        profile = user_manager.get_user_profile(str(user_doc["_id"]))

        return {
            "user_id": str(user_doc["_id"]),
            "name": user_doc.get("name", ""),
            "email": user_doc.get("email", ""),
            "has_profile": profile is not None,
        }
    finally:
        client.close()
