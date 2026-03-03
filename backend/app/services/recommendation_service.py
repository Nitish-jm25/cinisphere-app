from fastapi import HTTPException

from app.core import dependencies
from app.db.mongo import get_movies_collection

movies_collection = get_movies_collection()


def generate_recommendations(user_text: str, top_k: int = 20) -> list[dict]:
    try:
        if dependencies.ml_service is None:
            raise HTTPException(status_code=503, detail="ML service not initialized")

        diversified_ids = dependencies.ml_service.recommend(
            user_text=user_text,
            top_k=top_k,
        )

        if not diversified_ids:
            return []

        diversified_ids = [int(mid) for mid in diversified_ids]

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

        rank_map = {mid: idx for idx, mid in enumerate(diversified_ids)}
        movies_sorted = sorted(movies, key=lambda x: rank_map.get(x["movie_id"], 9999))
        return movies_sorted
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
