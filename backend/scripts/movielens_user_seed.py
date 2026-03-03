import argparse
import csv
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne


# Keep this fixed so profile vectors are comparable user-to-user.
CANONICAL_GENRES = [
    "action",
    "adventure",
    "animation",
    "comedy",
    "crime",
    "documentary",
    "drama",
    "family",
    "fantasy",
    "history",
    "horror",
    "music",
    "mystery",
    "romance",
    "science fiction",
    "tv movie",
    "thriller",
    "war",
    "western",
    "sci-fi",
]


def _load_env():
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / "backend" / ".env")
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "cinisphere"
    return mongo_uri, db_name


def _read_links(links_csv: Path) -> dict[int, int]:
    movie_to_tmdb: dict[int, int] = {}
    with links_csv.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                movie_id = int(row.get("movieId", ""))
                tmdb_raw = row.get("tmdbId", "")
                if not tmdb_raw:
                    continue
                tmdb_id = int(float(tmdb_raw))
                movie_to_tmdb[movie_id] = tmdb_id
            except Exception:
                continue
    return movie_to_tmdb


def _iter_ratings(ratings_csv: Path):
    with ratings_csv.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                uid = int(row.get("userId", ""))
                mid = int(row.get("movieId", ""))
                rating = float(row.get("rating", 0))
                ts_raw = str(row.get("timestamp", "")).strip()
                ts = None
                if ts_raw:
                    try:
                        # MovieLens variants: unix seconds
                        ts = int(float(ts_raw))
                    except Exception:
                        # Alternate variant: 'YYYY-MM-DD HH:MM:SS'
                        try:
                            dt = datetime.strptime(ts_raw, "%Y-%m-%d %H:%M:%S").replace(
                                tzinfo=timezone.utc
                            )
                            ts = int(dt.timestamp())
                        except Exception:
                            ts = None
                yield uid, mid, rating, ts
            except Exception:
                continue


def _normalize_genres(raw_genres):
    if isinstance(raw_genres, list):
        if raw_genres and isinstance(raw_genres[0], dict):
            return [str(g.get("name", "")).strip().lower() for g in raw_genres if g.get("name")]
        return [str(g).strip().lower() for g in raw_genres if str(g).strip()]
    if isinstance(raw_genres, str):
        return [g.strip().lower() for g in raw_genres.replace("|", ",").split(",") if g.strip()]
    return []


def _build_tmdb_movie_map(movies_collection) -> dict[int, dict]:
    tmdb_map: dict[int, dict] = {}
    cursor = movies_collection.find(
        {},
        {"_id": 0, "movie_id": 1, "tmdb_id": 1, "genres": 1},
    )
    for doc in cursor:
        tmdb_id = doc.get("tmdb_id")
        movie_id = doc.get("movie_id")
        if tmdb_id is None and movie_id is None:
            continue

        # Prefer explicit tmdb_id; fallback to movie_id when your ingestion aligns both.
        key_candidates = []
        if tmdb_id is not None:
            key_candidates.append(int(tmdb_id))
        if movie_id is not None:
            key_candidates.append(int(movie_id))

        payload = {"movie_id": int(movie_id if movie_id is not None else tmdb_id), "genres": doc.get("genres", [])}
        for key in key_candidates:
            tmdb_map[key] = payload
    return tmdb_map


def _genre_profile_vector(genre_counter: Counter) -> list[float]:
    total = float(sum(genre_counter.values())) or 1.0
    return [round(genre_counter.get(g, 0) / total, 6) for g in CANONICAL_GENRES]


def run_seed(
    ratings_csv: str,
    links_csv: str,
    max_users: int | None,
    min_rating: float,
    default_password: str,
):
    mongo_uri, db_name = _load_env()
    client = MongoClient(mongo_uri)
    db = client[db_name]

    users = db["users"]
    user_history = db["user_history"]
    user_profiles = db["user_profiles"]
    movies = db["movies"]

    users.create_index("email", unique=True)
    users.create_index("external_ids.movielens_user_id", unique=True, sparse=True)
    user_profiles.create_index("user_id", unique=True)
    user_history.create_index("user_id", unique=True)

    links_path = Path(links_csv).resolve()
    ratings_path = Path(ratings_csv).resolve()
    if not links_path.exists():
        raise RuntimeError(f"links.csv not found: {links_path}")
    if not ratings_path.exists():
        raise RuntimeError(f"ratings.csv not found: {ratings_path}")

    movie_to_tmdb = _read_links(links_path)
    tmdb_movie_map = _build_tmdb_movie_map(movies)

    seen_users: set[int] = set()
    user_watch_ops: dict[int, list[dict]] = {}
    user_genres: dict[int, Counter] = {}
    missing_tmdb = 0
    missing_movies = 0
    kept_rows = 0

    for uid, movie_id, rating, ts in _iter_ratings(ratings_path):
        if rating < min_rating:
            continue
        if max_users is not None and uid not in seen_users and len(seen_users) >= max_users:
            # ratings.csv is typically grouped by user; break early for speed.
            break

        seen_users.add(uid)
        tmdb_id = movie_to_tmdb.get(movie_id)
        if not tmdb_id:
            missing_tmdb += 1
            continue

        movie_doc = tmdb_movie_map.get(tmdb_id)
        if not movie_doc:
            missing_movies += 1
            continue

        final_movie_id = int(movie_doc.get("movie_id", tmdb_id))
        watched_at = datetime.fromtimestamp(ts, tz=timezone.utc) if ts > 0 else datetime.now(timezone.utc)

        user_watch_ops.setdefault(uid, []).append(
            {
                "movie_id": final_movie_id,
                "watched_at": watched_at,
                "rating": rating,
                "source": "movielens",
            }
        )

        counter = user_genres.setdefault(uid, Counter())
        counter.update(_normalize_genres(movie_doc.get("genres")))
        kept_rows += 1

    hashed_pw = bcrypt.hashpw(default_password.encode("utf-8"), bcrypt.gensalt())
    now = datetime.now(timezone.utc)

    user_upserts = []
    profile_upserts = []
    history_upserts = []

    for uid in sorted(seen_users):
        email = f"ml_user_{uid}@cinisphere.local"
        name = f"ML User {uid}"

        user_upserts.append(
            UpdateOne(
                {"external_ids.movielens_user_id": uid},
                {
                    "$set": {
                        "name": name,
                        "email": email,
                        "password": hashed_pw,
                        "updated_at": now,
                        "seed_source": "movielens",
                    },
                    "$setOnInsert": {
                        "created_at": now,
                        "login_count": 0,
                    },
                },
                upsert=True,
            )
        )

    if user_upserts:
        users.bulk_write(user_upserts, ordered=False)

    for uid in sorted(seen_users):
        user_doc = users.find_one({"external_ids.movielens_user_id": uid}, {"_id": 1})
        if not user_doc:
            continue
        user_id = user_doc["_id"]
        watched_list = user_watch_ops.get(uid, [])
        genres_counter = user_genres.get(uid, Counter())

        top_genres = [g for g, _ in genres_counter.most_common(3)]
        survey_data = {
            "genres": top_genres,
            "languages": [],
            "mood": "feel good",
            "release_pref": "any",
            "source": "movielens_seed",
        }

        profile_upserts.append(
            UpdateOne(
                {"user_id": user_id},
                {
                    "$set": {
                        "user_id": user_id,
                        "survey_data": survey_data,
                        "profile_vector": _genre_profile_vector(genres_counter),
                        "updated_at": now,
                    }
                },
                upsert=True,
            )
        )

        history_upserts.append(
            UpdateOne(
                {"user_id": user_id},
                {"$set": {"user_id": user_id, "watched": watched_list}},
                upsert=True,
            )
        )

    if profile_upserts:
        user_profiles.bulk_write(profile_upserts, ordered=False)
    if history_upserts:
        user_history.bulk_write(history_upserts, ordered=False)

    client.close()
    print(
        "Done. "
        f"users_seeded={len(seen_users)} kept_ratings={kept_rows} "
        f"missing_tmdb_map={missing_tmdb} missing_movies_in_db={missing_movies}"
    )
    print(f"Default password for seeded users: {default_password}")
    print("Login format: ml_user_<movielensUserId>@cinisphere.local")


def main():
    parser = argparse.ArgumentParser(description="Seed users/history/profiles from MovieLens ratings")
    parser.add_argument("--ratings-csv", required=True, help="Path to MovieLens ratings.csv")
    parser.add_argument("--links-csv", required=True, help="Path to MovieLens links.csv")
    parser.add_argument("--max-users", type=int, default=500, help="Max unique users to seed")
    parser.add_argument("--min-rating", type=float, default=3.5, help="Only keep ratings >= min")
    parser.add_argument(
        "--default-password",
        default="Pass@123",
        help="Password assigned to seeded users",
    )
    args = parser.parse_args()

    run_seed(
        ratings_csv=args.ratings_csv,
        links_csv=args.links_csv,
        max_users=args.max_users,
        min_rating=args.min_rating,
        default_password=args.default_password,
    )


if __name__ == "__main__":
    main()
