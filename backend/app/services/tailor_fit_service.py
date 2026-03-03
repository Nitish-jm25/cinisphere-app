from typing import Any

import pandas as pd
from pymongo import MongoClient
from fastapi import HTTPException
from bson import ObjectId
from sklearn.feature_extraction.text import TfidfVectorizer

from app.core.config import settings
from ml_engine.serving import taste_matcher, user_manager
from ml_engine.serving.survey_recommender import (
    generate_recommendations as survey_generate_recommendations,
    prepare_features,
    build_survey_profile,
)


MOOD_MAP = {
    "happy": "feel good",
    "sad": "emotional",
    "excited": "mass/action",
    "relaxed": "feel good",
    "romantic": "emotional",
    "feel good": "feel good",
    "dark": "dark",
    "emotional": "emotional",
    "thriller": "thriller",
    "mass/action": "mass/action",
}


def _movies_collection():
    client = MongoClient(settings.MONGO_URI)
    return client[settings.DATABASE_NAME]["movies"]


def normalize_survey_dict(survey: dict[str, Any]) -> dict[str, Any]:
    mood_raw = str(survey.get("mood", "")).strip().lower()
    language = str(survey.get("language", "")).strip().lower()
    movie_type = str(survey.get("movie_type", "")).strip().lower()
    release_pref = str(survey.get("release_pref", "any")).strip().lower() or "any"

    return {
        "genres": [movie_type] if movie_type else [],
        "languages": [language] if language else [],
        "mood": MOOD_MAP.get(mood_raw, "feel good"),
        "release_pref": release_pref if release_pref in {"latest", "any", "upcoming"} else "any",
    }


def _load_movies_df() -> pd.DataFrame:
    movies = list(_movies_collection().find({}, {"_id": 0}))
    if not movies:
        raise HTTPException(status_code=400, detail="No movies found in DB. Run ingestion first.")
    return pd.DataFrame(movies)


def _user_history_collection():
    client = MongoClient(settings.MONGO_URI)
    return client[settings.DATABASE_NAME]["user_history"]


def _get_watched(user_id: str) -> list[dict]:
    history_col = _user_history_collection()
    try:
        doc = history_col.find_one({"user_id": ObjectId(user_id)}, {"_id": 0, "watched": 1})
    except Exception:
        return []
    return doc.get("watched", []) if doc else []


def _rating_to_unit(rating: Any) -> float:
    try:
        if rating is None:
            return 0.0
        r = float(rating)
    except Exception:
        return 0.0
    # Common ranges: 0.5..5.0 or 0..10. Map both to 0..1.
    if r <= 5.0:
        return min(max((r - 0.5) / 4.5, 0.0), 1.0)
    return min(max(r / 10.0, 0.0), 1.0)


def _normalize_series(values: pd.Series) -> pd.Series:
    vmin = float(values.min())
    vmax = float(values.max())
    if vmax <= vmin:
        return pd.Series([0.0] * len(values), index=values.index)
    return (values - vmin) / (vmax - vmin)


def build_profile_vector_from_survey(survey_data: dict[str, Any]) -> list[float]:
    df = _load_movies_df()
    df_feat = prepare_features(df)
    user_doc = build_survey_profile(survey_data)
    corpus = df_feat["content"].tolist() + [user_doc]

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=10_000,
        ngram_range=(1, 2),
    )
    tfidf_matrix = vectorizer.fit_transform(corpus)
    return tfidf_matrix[-1].toarray().flatten().tolist()


def recommend_tailor_fit(
    user_id: str,
    survey: dict[str, Any],
    top_k: int = 15,
    similar_users_k: int = 5,
) -> dict[str, Any]:
    survey_data = normalize_survey_dict(survey)
    df = _load_movies_df()

    # Larger candidate pool to allow collaborative reranking.
    candidate_k = max(top_k * 8, 120)
    recs_df = survey_generate_recommendations(df=df, survey=survey_data, top_n=candidate_k)
    if recs_df.empty:
        return {"recommendations": [], "similar_users": []}

    profile_vector = build_profile_vector_from_survey(survey_data)
    user_manager.save_user_profile(
        user_id=user_id,
        survey_data=survey_data,
        profile_vector=profile_vector,
    )

    similar_users = taste_matcher.find_similar_users(user_id=user_id, top_k=similar_users_k)

    watched = _get_watched(user_id)
    watched_set = {int(w.get("movie_id")) for w in watched if w.get("movie_id") is not None}

    # Build collaborative score from neighbors' watched ratings.
    collab_num: dict[int, float] = {}
    collab_den: dict[int, float] = {}
    for neighbor in similar_users:
        neighbor_id = neighbor.get("user_id")
        sim = max(float(neighbor.get("similarity", 0.0)), 0.0)
        if not neighbor_id or sim <= 0:
            continue
        neighbor_history = _get_watched(str(neighbor_id))
        for item in neighbor_history:
            mid_raw = item.get("movie_id")
            if mid_raw is None:
                continue
            mid = int(mid_raw)
            if mid in watched_set:
                continue
            rating_score = _rating_to_unit(item.get("rating"))
            if rating_score <= 0:
                continue
            collab_num[mid] = collab_num.get(mid, 0.0) + sim * rating_score
            collab_den[mid] = collab_den.get(mid, 0.0) + sim

    recs_df = recs_df.copy()
    recs_df["movie_id"] = recs_df["movie_id"].astype(int)
    recs_df = recs_df[~recs_df["movie_id"].isin(watched_set)]

    recs_df["survey_score"] = _normalize_series(recs_df["similarity_score"].astype(float))
    recs_df["collab_score"] = recs_df["movie_id"].apply(
        lambda mid: (collab_num[mid] / collab_den[mid]) if mid in collab_den and collab_den[mid] > 0 else 0.0
    )
    recs_df["final_score"] = 0.7 * recs_df["survey_score"] + 0.3 * recs_df["collab_score"]
    recs_df = recs_df.sort_values("final_score", ascending=False).head(top_k)

    wanted_cols = [
        "movie_id",
        "title",
        "poster_path",
        "overview",
        "vote_average",
        "release_date",
        "genres",
        "popularity",
    ]
    existing_cols = [c for c in wanted_cols if c in recs_df.columns]
    recommendations = recs_df[existing_cols].to_dict(orient="records")

    return {
        "recommendations": recommendations,
        "similar_users": similar_users,
    }
