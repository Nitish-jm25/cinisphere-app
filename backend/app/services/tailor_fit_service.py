from typing import Any

import pandas as pd
import numpy as np
from pymongo import MongoClient
from fastapi import HTTPException
from bson import ObjectId
from datetime import datetime, timedelta, timezone
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
    release_period = str(survey.get("release_period", "any")).strip().lower() or "any"

    return {
        "genres": [movie_type] if movie_type else [],
        "languages": [language] if language else [],
        "mood": MOOD_MAP.get(mood_raw, "feel good"),
        "release_pref": release_pref if release_pref in {"latest", "any", "upcoming"} else "any",
        "release_period": release_period if release_period in {"any", "90s", "2000s", "2010s", "2020s"} else "any",
    }


def _load_movies_df() -> pd.DataFrame:
    movies = list(_movies_collection().find({}, {"_id": 0}))
    if not movies:
        raise HTTPException(status_code=400, detail="No movies found in DB. Run ingestion first.")
    return pd.DataFrame(movies)


def _user_history_collection():
    client = MongoClient(settings.MONGO_URI)
    return client[settings.DATABASE_NAME]["user_history"]


def _recommendation_state_collection():
    client = MongoClient(settings.MONGO_URI)
    return client[settings.DATABASE_NAME]["user_recommendation_state"]


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


def _compute_quality_score(df: pd.DataFrame) -> pd.Series:
    vote_average = df["vote_average"].fillna(0).astype(float) if "vote_average" in df.columns else pd.Series([0.0] * len(df), index=df.index)
    vote_count_raw = df["vote_count"].fillna(0).astype(float) if "vote_count" in df.columns else pd.Series([0.0] * len(df), index=df.index)
    popularity_raw = df["popularity"].fillna(0).astype(float) if "popularity" in df.columns else pd.Series([0.0] * len(df), index=df.index)

    # Bayesian weighted rating to avoid obscure low-vote titles dominating.
    c = float(vote_average.mean()) if len(vote_average) else 0.0
    m = float(vote_count_raw.quantile(0.75)) if len(vote_count_raw) else 0.0
    weighted_rating = ((vote_count_raw / (vote_count_raw + m)) * vote_average) + ((m / (vote_count_raw + m)) * c) if m > 0 else vote_average

    rating = _normalize_series(weighted_rating)
    popularity = _normalize_series(popularity_raw)
    vote_count = _normalize_series(vote_count_raw.apply(lambda x: float(np.log1p(x)) if x > 0 else 0.0))
    return 0.6 * rating + 0.25 * popularity + 0.15 * vote_count


def _apply_quality_gate(recs_df: pd.DataFrame, top_k: int) -> pd.DataFrame:
    if recs_df.empty:
        return recs_df

    vote_average = recs_df["vote_average"].fillna(0).astype(float) if "vote_average" in recs_df.columns else pd.Series([0.0] * len(recs_df), index=recs_df.index)
    vote_count = recs_df["vote_count"].fillna(0).astype(float) if "vote_count" in recs_df.columns else pd.Series([0.0] * len(recs_df), index=recs_df.index)
    popularity = recs_df["popularity"].fillna(0).astype(float) if "popularity" in recs_df.columns else pd.Series([0.0] * len(recs_df), index=recs_df.index)

    # Strict threshold first.
    strict = recs_df[(vote_average >= 7.2) & ((vote_count >= 300) | (popularity >= popularity.quantile(0.75)))]
    if len(strict) >= max(top_k, 8):
        return strict

    # Relaxed fallback to keep result count stable.
    relaxed = recs_df[(vote_average >= 6.8) & ((vote_count >= 120) | (popularity >= popularity.quantile(0.60)))]
    if len(relaxed) >= max(top_k, 8):
        return relaxed

    return recs_df


def _apply_release_period_filter(df: pd.DataFrame, release_period: str) -> pd.DataFrame:
    period_map: dict[str, tuple[int, int]] = {
        "90s": (1990, 1999),
        "2000s": (2000, 2009),
        "2010s": (2010, 2019),
        "2020s": (2020, 2029),
    }
    if release_period == "any":
        return df

    bounds = period_map.get(release_period)
    if not bounds:
        return df

    start_year, end_year = bounds
    filtered = df.copy()
    filtered["release_year"] = pd.to_datetime(filtered["release_date"], errors="coerce").dt.year
    filtered = filtered[(filtered["release_year"] >= start_year) & (filtered["release_year"] <= end_year)]
    filtered = filtered.drop(columns=["release_year"], errors="ignore")
    return filtered if not filtered.empty else df


def _extract_genre_tokens(raw_genres: Any) -> set[str]:
    tokens: set[str] = set()
    if isinstance(raw_genres, list):
        for item in raw_genres:
            if isinstance(item, dict):
                name = str(item.get("name", "")).strip().lower()
                if name:
                    tokens.add(name)
            else:
                token = str(item).strip().lower()
                if token:
                    tokens.add(token)
    elif isinstance(raw_genres, str):
        normalized = raw_genres.replace(",", " ").strip().lower()
        tokens.update([part for part in normalized.split() if part])
    return tokens


def _load_recently_shown(user_id: str, days: int = 14) -> set[int]:
    col = _recommendation_state_collection()
    doc = col.find_one({"user_id": str(user_id)}, {"_id": 0, "shown": 1})
    if not doc or not isinstance(doc.get("shown"), list):
        return set()

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    recent_ids: set[int] = set()
    for item in doc["shown"]:
        if not isinstance(item, dict):
            continue
        try:
            mid = int(item.get("movie_id"))
        except Exception:
            continue
        shown_at = item.get("shown_at")
        if isinstance(shown_at, datetime):
            if shown_at.tzinfo is None:
                shown_at = shown_at.replace(tzinfo=timezone.utc)
            if shown_at >= cutoff:
                recent_ids.add(mid)
    return recent_ids


def _save_recently_shown(user_id: str, movie_ids: list[int], keep_limit: int = 120) -> None:
    if not movie_ids:
        return
    col = _recommendation_state_collection()
    now = datetime.now(timezone.utc)
    existing = col.find_one({"user_id": str(user_id)}, {"_id": 0, "shown": 1})
    shown = existing.get("shown", []) if existing else []

    for mid in movie_ids:
        shown.append({"movie_id": int(mid), "shown_at": now})

    shown = shown[-keep_limit:]
    col.update_one(
        {"user_id": str(user_id)},
        {"$set": {"shown": shown, "updated_at": now}},
        upsert=True,
    )


def _diversify_recommendations(recs_df: pd.DataFrame, top_k: int) -> pd.DataFrame:
    if recs_df.empty:
        return recs_df

    pool_size = min(max(top_k * 5, top_k), len(recs_df))
    pool = recs_df.sort_values("final_score", ascending=False).head(pool_size).copy()
    pool["genre_tokens"] = pool["genres"].apply(_extract_genre_tokens)
    pool["release_year"] = pd.to_datetime(pool["release_date"], errors="coerce").dt.year.fillna(0).astype(int)

    selected_indices: list[int] = []
    selected_genres: dict[str, int] = {}
    selected_years: dict[int, int] = {}
    remaining_indices = list(pool.index)

    while remaining_indices and len(selected_indices) < top_k:
        best_idx = None
        best_score = -1.0

        for idx in remaining_indices:
            row = pool.loc[idx]
            base = float(row["final_score"])
            genres = row["genre_tokens"]
            year = int(row["release_year"])

            genre_penalty = sum(selected_genres.get(g, 0) for g in genres) * 0.04
            year_penalty = selected_years.get(year, 0) * 0.03 if year else 0.0
            adjusted = base - genre_penalty - year_penalty

            if adjusted > best_score:
                best_score = adjusted
                best_idx = idx

        if best_idx is None:
            break

        selected_indices.append(best_idx)
        remaining_indices.remove(best_idx)
        row = pool.loc[best_idx]
        for g in row["genre_tokens"]:
            selected_genres[g] = selected_genres.get(g, 0) + 1
        ry = int(row["release_year"])
        if ry:
            selected_years[ry] = selected_years.get(ry, 0) + 1

    if not selected_indices:
        return recs_df.sort_values("final_score", ascending=False).head(top_k)

    diversified = pool.loc[selected_indices]
    return diversified.head(top_k)


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
    df = _apply_release_period_filter(df, survey_data.get("release_period", "any"))

    # Larger candidate pool to allow collaborative reranking.
    candidate_k = max(top_k * 8, 120)
    recs_df = survey_generate_recommendations(df=df, survey=survey_data, top_n=candidate_k)
    if recs_df.empty:
        return {"recommendations": [], "similar_users": []}

    profile_vector = build_profile_vector_from_survey(survey_data)
    # Mongo-side profile persistence expects ObjectId-based users.
    # Social auth users are SQL integers; skip Mongo profile upsert for them.
    if ObjectId.is_valid(user_id):
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

    recently_shown = _load_recently_shown(user_id)
    filtered_recs_df = recs_df[~recs_df["movie_id"].isin(recently_shown)]
    if not filtered_recs_df.empty:
        recs_df = filtered_recs_df

    recs_df = _apply_quality_gate(recs_df, top_k=top_k)

    recs_df["survey_score"] = _normalize_series(recs_df["similarity_score"].astype(float))
    recs_df["collab_score"] = recs_df["movie_id"].apply(
        lambda mid: (collab_num[mid] / collab_den[mid]) if mid in collab_den and collab_den[mid] > 0 else 0.0
    )
    recs_df["quality_score"] = _compute_quality_score(recs_df)
    high_rated = recs_df["vote_average"].fillna(0).astype(float) >= 7.0 if "vote_average" in recs_df.columns else pd.Series([False] * len(recs_df), index=recs_df.index)
    pop_threshold = recs_df["popularity"].fillna(0).astype(float).quantile(0.75) if "popularity" in recs_df.columns else 0.0
    popular = recs_df["popularity"].fillna(0).astype(float) >= pop_threshold if "popularity" in recs_df.columns else pd.Series([False] * len(recs_df), index=recs_df.index)
    recs_df["quality_bonus"] = (high_rated | popular).astype(float) * 0.10
    recs_df["final_score"] = (
        0.45 * recs_df["survey_score"]
        + 0.15 * recs_df["collab_score"]
        + 0.40 * recs_df["quality_score"]
        + recs_df["quality_bonus"]
    )
    recs_df = _diversify_recommendations(recs_df, top_k=top_k)

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
    _save_recently_shown(user_id=user_id, movie_ids=[int(r["movie_id"]) for r in recommendations if "movie_id" in r])

    return {
        "recommendations": recommendations,
        "similar_users": similar_users,
    }
