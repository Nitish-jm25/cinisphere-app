"""
CINESPHERE — Taste Matcher (User Similarity Engine)

Compares users by their TF-IDF profile vectors using cosine
similarity. Powers the social community feature — "Users with
similar taste".

Database  : movie_recommendation_db
Collection: user_profiles
"""

import sys

import numpy as np
from bson import ObjectId
from pymongo import MongoClient
from sklearn.metrics.pairwise import cosine_similarity

# ─── Configuration ────────────────────────────────────────────
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "movie_recommendation_db"
TOP_K = 5


# ─── Database Helper ──────────────────────────────────────────
def _get_db():
    """Return a handle to the movie_recommendation_db database."""
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return client[DB_NAME]


# ═══════════════════════════════════════════════════════════════
# 1. LOAD USER PROFILES
# ═══════════════════════════════════════════════════════════════
def _load_profiles(db) -> list[dict]:
    """
    Load all user profiles that have a profile_vector.

    Returns list of dicts: [{"user_id": ObjectId, "profile_vector": [...]}, ...]
    """
    profiles = list(
        db["user_profiles"].find(
            {"profile_vector": {"$exists": True, "$ne": []}},
            {"_id": 0, "user_id": 1, "profile_vector": 1},
        )
    )
    return profiles


# ═══════════════════════════════════════════════════════════════
# 2. BUILD SIMILARITY MATRIX
# ═══════════════════════════════════════════════════════════════
def _build_similarity_matrix(profiles: list[dict]) -> tuple[np.ndarray, list[str]]:
    """
    Convert profile vectors into a numpy matrix and compute
    pairwise cosine similarity.

    Returns
    -------
    sim_matrix : (N x N) numpy array of cosine similarities
    user_ids   : list of user_id strings in the same row order
    """
    # Pad vectors to the same length (in case of slight mismatches)
    max_len = max(len(p["profile_vector"]) for p in profiles)

    vectors = []
    user_ids = []
    for p in profiles:
        vec = p["profile_vector"]
        # Pad with zeros if shorter than the longest vector
        if len(vec) < max_len:
            vec = vec + [0.0] * (max_len - len(vec))
        vectors.append(vec)
        user_ids.append(str(p["user_id"]))

    matrix = np.array(vectors, dtype=np.float64)
    sim_matrix = cosine_similarity(matrix)

    return sim_matrix, user_ids


# ═══════════════════════════════════════════════════════════════
# 3. FIND SIMILAR USERS
# ═══════════════════════════════════════════════════════════════
def find_similar_users(user_id: str, top_k: int = TOP_K) -> list[dict]:
    """
    Find the top-K most similar users to the given user_id
    based on cosine similarity of their profile vectors.

    Parameters
    ----------
    user_id : user ID string
    top_k   : number of similar users to return (default 5)

    Returns
    -------
    list of dicts: [{"user_id": str, "similarity": float}, ...]
    sorted by similarity descending.
    """
    db = _get_db()

    # ── Load all profiles ──
    profiles = _load_profiles(db)

    if len(profiles) < 2:
        print("\n  [INFO] Not enough users with profile vectors for comparison.")
        return []

    # ── Build similarity matrix ──
    sim_matrix, user_ids = _build_similarity_matrix(profiles)

    # ── Locate target user ──
    if user_id not in user_ids:
        print(f"\n  [ERROR] User '{user_id}' not found or has no profile vector.")
        return []

    target_idx = user_ids.index(user_id)
    similarities = sim_matrix[target_idx]

    # ── Rank other users by similarity (exclude self) ──
    scored = []
    for i, score in enumerate(similarities):
        if i == target_idx:
            continue
        scored.append({"user_id": user_ids[i], "similarity": float(score)})

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    top_matches = scored[:top_k]

    # ── Fetch names for display ──
    users_coll = db["users"]
    for match in top_matches:
        user_doc = users_coll.find_one(
            {"_id": ObjectId(match["user_id"])},
            {"_id": 0, "name": 1, "email": 1},
        )
        if user_doc:
            match["name"] = user_doc.get("name", "Unknown")
            match["email"] = user_doc.get("email", "")

    # ── Display ──
    _display_results(user_id, top_matches)

    return top_matches


# ═══════════════════════════════════════════════════════════════
# 4. DISPLAY
# ═══════════════════════════════════════════════════════════════
def _display_results(user_id: str, matches: list[dict]):
    """Pretty-print the similar users."""
    print("\n" + "=" * 60)
    print("  🤝  CINESPHERE — Users With Similar Taste")
    print("=" * 60)
    print(f"  Target user: {user_id}\n")

    if not matches:
        print("  No similar users found.")
        print("=" * 60)
        return

    for rank, m in enumerate(matches, start=1):
        name = m.get("name", "Unknown")
        email = m.get("email", "")
        score = m["similarity"]
        bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
        print(f"  {rank}. {name:<20}  {bar}  {score:.4f}")
        if email:
            print(f"     {email}")

    print("\n" + "=" * 60)
    print(f"  Showing top {len(matches)} similar users.")
    print("=" * 60)


# ═══════════════════════════════════════════════════════════════
# QUICK SMOKE TEST
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("  CINESPHERE — Taste Matcher Smoke Test")
    print("=" * 60)

    test_uid = input("\n  Enter a user_id: ").strip()

    if not test_uid:
        print("  [ERROR] No user_id provided.")
    else:
        results = find_similar_users(test_uid)
        if not results:
            print("\n  No matches returned (need ≥2 users with profile vectors).")

    print("\n  ✓ Done")
