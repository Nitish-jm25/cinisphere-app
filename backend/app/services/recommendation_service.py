from pymongo import MongoClient
from fastapi import HTTPException
from app.core.dependencies import ml_service

# ─── MongoDB Configuration ─────────────────────────────────────
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "movie_recommendation_db"
COLLECTION_NAME = "movies"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
movies_collection = db[COLLECTION_NAME]


# ─── Recommendation Service ────────────────────────────────────
def generate_recommendations(user_text: str, top_k: int = 20) -> list[dict]:
    try:
        # Step 1 — Use MLService (hybrid + diversity encapsulated)
        diversified_ids: list[int] = ml_service.recommend(
            user_text=user_text,
            top_k=top_k
        )

        if not diversified_ids:
            return []

        diversified_ids = [int(mid) for mid in diversified_ids]

        # Step 2 — Fetch metadata from Mongo
        movies = list(
            movies_collection.find(
                {"movie_id": {"$in": diversified_ids}},
                {
                    "_id": 0,
                    "movie_id": 1,
                    "title": 1,
                    "poster_path": 1,
                    "overview": 1,
                    "vote_average": 1,
                    "release_date": 1,
                    "genres": 1,
                    "popularity": 1,
                },
            )
        )

        # Step 3 — Preserve ranking order (O(1) lookup)
        rank_map = {mid: idx for idx, mid in enumerate(diversified_ids)}

        movies_sorted = sorted(
            movies,
            key=lambda x: rank_map.get(x["movie_id"], 9999),
        )

        return movies_sorted

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))