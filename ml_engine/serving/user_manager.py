"""
CINESPHERE — MongoDB User Management Module

Handles user accounts, preference profiles, and watch history
for the movie recommendation system.

Database  : movie_recommendation_db
Collections: users, user_profiles, user_history
"""

from datetime import datetime, timezone
import os

import bcrypt
from bson import ObjectId
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

# ─── Configuration ────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "movie_recommendation_db"


# ─── Database Helper ──────────────────────────────────────────
def _get_db():
    """Return a handle to the movie_recommendation_db database."""
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return client[DB_NAME]


# ═══════════════════════════════════════════════════════════════
# 1. USER CREATION
# ═══════════════════════════════════════════════════════════════
def create_user(name: str, email: str, password: str) -> str:
    """
    Create a new user with a bcrypt-hashed password.

    Parameters
    ----------
    name     : display name
    email    : unique email address
    password : plain-text password (hashed before storage)

    Returns
    -------
    str – the newly created user's ID (as a string)

    Raises
    ------
    ValueError  – if the email is already registered
    """
    db = _get_db()
    users = db["users"]

    # Ensure email uniqueness (idempotent index creation)
    users.create_index("email", unique=True)

    hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    user_doc = {
        "name": name,
        "email": email.lower().strip(),
        "password": hashed_pw,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = users.insert_one(user_doc)
    except DuplicateKeyError:
        raise ValueError(f"A user with email '{email}' already exists.")

    print(f"  [OK] User created  →  id={result.inserted_id}")
    return str(result.inserted_id)


# ═══════════════════════════════════════════════════════════════
# 2. GET USER BY EMAIL
# ═══════════════════════════════════════════════════════════════
def get_user_by_email(email: str) -> dict | None:
    """
    Look up a user by email address.

    Returns
    -------
    dict with keys 'user_id', 'name', 'email', or None if not found.
    """
    db = _get_db()
    users = db["users"]

    user = users.find_one({"email": email.lower().strip()})

    if user:
        return {
            "user_id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
        }
    return None


# ═══════════════════════════════════════════════════════════════
# 3. SAVE USER PROFILE
# ═══════════════════════════════════════════════════════════════
def save_user_profile(user_id: str, survey_data: dict, profile_vector: list) -> None:
    """
    Upsert the user's preference profile (survey answers + TF-IDF vector).

    Parameters
    ----------
    user_id        : user ID string (from create_user)
    survey_data    : dict of survey answers, e.g.
                     {"genres": [...], "languages": [...], "mood": "...", "release_pref": "..."}
    profile_vector : list of floats — the user's TF-IDF profile vector
    """
    db = _get_db()
    profiles = db["user_profiles"]

    profile_doc = {
        "user_id": ObjectId(user_id),
        "survey_data": survey_data,
        "profile_vector": profile_vector,
        "updated_at": datetime.now(timezone.utc),
    }

    profiles.update_one(
        {"user_id": ObjectId(user_id)},
        {"$set": profile_doc},
        upsert=True,
    )

    print(f"  [OK] Profile saved  →  user_id={user_id}")


# ═══════════════════════════════════════════════════════════════
# 4. GET USER PROFILE
# ═══════════════════════════════════════════════════════════════
def get_user_profile(user_id: str) -> dict | None:
    """
    Retrieve the user's preference profile.

    Returns
    -------
    dict with survey_data and profile_vector, or None if not found.
    """
    db = _get_db()
    profiles = db["user_profiles"]

    profile = profiles.find_one(
        {"user_id": ObjectId(user_id)},
        {"_id": 0},
    )

    return profile


# ═══════════════════════════════════════════════════════════════
# 5. SAVE USER HISTORY
# ═══════════════════════════════════════════════════════════════
def save_user_history(user_id: str, movie_id: int, rating: float | None = None) -> None:
    """
    Append a movie to the user's watch history.

    Parameters
    ----------
    user_id  : user ID string
    movie_id : TMDB movie ID (integer)
    """
    db = _get_db()
    history = db["user_history"]

    watched_doc = {
        "movie_id": int(movie_id),
        "watched_at": datetime.now(timezone.utc),
    }
    if rating is not None:
        watched_doc["rating"] = float(rating)

    history.update_one(
        {"user_id": ObjectId(user_id)},
        {
            "$push": {
                "watched": watched_doc
            }
        },
        upsert=True,
    )

    print(f"  [OK] History saved  →  user_id={user_id}, movie_id={movie_id}")


# ═══════════════════════════════════════════════════════════════
# 6. GET USER HISTORY
# ═══════════════════════════════════════════════════════════════
def get_user_history(user_id: str) -> list:
    """
    Retrieve the user's full watch history.

    Returns
    -------
    list of dicts [{"movie_id": int, "watched_at": datetime}, ...],
    or an empty list if no history exists.
    """
    db = _get_db()
    history = db["user_history"]

    doc = history.find_one(
        {"user_id": ObjectId(user_id)},
        {"_id": 0, "watched": 1},
    )

    return doc.get("watched", []) if doc else []


# ═══════════════════════════════════════════════════════════════
# QUICK SMOKE TEST
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import time

    print("=" * 60)
    print("  CINESPHERE — User Manager Smoke Test")
    print("=" * 60)

    # Use a unique email so the test is re-runnable
    unique_email = f"test_{int(time.time())}@cinesphere.ai"

    # 1. Create user
    uid = create_user("Test User", unique_email, "secureP@ss123")
    print(f"\n  Created user ID: {uid}")

    # 2. Save profile
    survey = {
        "genres": ["action", "sci-fi"],
        "languages": ["english", "tamil"],
        "mood": "thriller",
        "release_pref": "latest",
    }
    vector = [0.12, 0.87, 0.45, 0.33]  # dummy vector
    save_user_profile(uid, survey, vector)

    # 3. Get profile
    profile = get_user_profile(uid)
    print(f"\n  Retrieved profile: {profile}")

    # 4. Save history
    save_user_history(uid, 550)    # Fight Club
    save_user_history(uid, 680)    # Pulp Fiction

    # 5. Get history
    hist = get_user_history(uid)
    print(f"\n  Watch history ({len(hist)} entries):")
    for entry in hist:
        print(f"    movie_id={entry['movie_id']}  at {entry['watched_at']}")

    # Cleanup test data
    db = _get_db()
    db["users"].delete_one({"_id": ObjectId(uid)})
    db["user_profiles"].delete_one({"user_id": ObjectId(uid)})
    db["user_history"].delete_one({"user_id": ObjectId(uid)})
    print("\n  [CLEANUP] Test data removed from MongoDB")

    print("\n" + "=" * 60)
    print("  ✓ All operations completed successfully")
    print("=" * 60)
