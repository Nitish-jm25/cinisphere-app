"""
CINESPHERE - Taste Matcher (History-Based Similarity)

Computes user-to-user similarity only from watch history ratings
stored in the `user_history` collection.
"""

import os
from typing import Any

import numpy as np
from bson import ObjectId
from pymongo import MongoClient
from sklearn.metrics.pairwise import cosine_similarity

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "movie_recommendation_db"
TOP_K = 5


def _get_db():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return client[DB_NAME]


def _normalize_rating(rating: Any) -> float:
    try:
        if rating is None:
            return 0.0
        r = float(rating)
    except Exception:
        return 0.0

    # Common scales: 0.5..5.0 or 0..10
    if r <= 5.0:
        return max(0.0, min(1.0, (r - 0.5) / 4.5))
    return max(0.0, min(1.0, r / 10.0))


def _load_history_vectors(db) -> tuple[dict[str, dict[int, float]], set[int]]:
    """
    Returns:
      user_vectors: {user_id_str: {movie_id: normalized_rating}}
      movie_ids: set of all movie ids seen in histories
    """
    user_vectors: dict[str, dict[int, float]] = {}
    movie_ids: set[int] = set()

    cursor = db["user_history"].find({}, {"_id": 0, "user_id": 1, "watched": 1})
    for doc in cursor:
        uid = str(doc.get("user_id"))
        watched = doc.get("watched", []) or []
        if not uid or not isinstance(watched, list):
            continue

        vec: dict[int, float] = {}
        for item in watched:
            if not isinstance(item, dict):
                continue
            mid = item.get("movie_id")
            if mid is None:
                continue
            try:
                mid_int = int(mid)
            except Exception:
                continue

            score = _normalize_rating(item.get("rating"))
            # If rating missing, treat watched as weak positive signal.
            if score == 0.0:
                score = 0.35
            vec[mid_int] = max(vec.get(mid_int, 0.0), score)
            movie_ids.add(mid_int)

        if vec:
            user_vectors[uid] = vec

    return user_vectors, movie_ids


def _build_dense_matrix(user_vectors: dict[str, dict[int, float]], movie_ids: set[int]):
    user_ids = list(user_vectors.keys())
    movie_index = {mid: idx for idx, mid in enumerate(sorted(movie_ids))}

    matrix = np.zeros((len(user_ids), len(movie_index)), dtype=np.float64)
    for i, uid in enumerate(user_ids):
        vec = user_vectors[uid]
        for mid, score in vec.items():
            j = movie_index.get(mid)
            if j is not None:
                matrix[i, j] = score

    return matrix, user_ids


def find_similar_users(user_id: str, top_k: int = TOP_K) -> list[dict]:
    db = _get_db()
    user_vectors, movie_ids = _load_history_vectors(db)

    if len(user_vectors) < 2:
        return []

    if user_id not in user_vectors:
        return []

    matrix, user_ids = _build_dense_matrix(user_vectors, movie_ids)
    sim_matrix = cosine_similarity(matrix)

    target_idx = user_ids.index(user_id)
    similarities = sim_matrix[target_idx]

    scored: list[dict] = []
    for i, score in enumerate(similarities):
        if i == target_idx:
            continue
        if float(score) <= 0:
            continue
        scored.append({"user_id": user_ids[i], "similarity": float(score)})

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    top_matches = scored[:top_k]

    users_coll = db["users"]
    for match in top_matches:
        try:
            obj_id = ObjectId(match["user_id"])
        except Exception:
            continue
        user_doc = users_coll.find_one({"_id": obj_id}, {"_id": 0, "name": 1, "email": 1})
        if user_doc:
            match["name"] = user_doc.get("name", "Unknown")
            match["email"] = user_doc.get("email", "")

    return top_matches


if __name__ == "__main__":
    sample = input("Enter user_id: ").strip()
    print(find_similar_users(sample))
