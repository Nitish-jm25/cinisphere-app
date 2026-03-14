import argparse
import os
import time
from datetime import datetime, timezone

import requests
from pymongo import MongoClient, UpdateOne


TMDB_BASE_URL = "https://api.themoviedb.org/3"


def fetch_tmdb_page(session: requests.Session, api_key: str, endpoint: str, page: int) -> dict:
    params = {"api_key": api_key, "page": page}
    if endpoint == "discover_tamil":
        url = f"{TMDB_BASE_URL}/discover/movie"
        params.update({"with_original_language": "ta", "sort_by": "popularity.desc"})
    else:
        url = f"{TMDB_BASE_URL}/{endpoint}"
    response = session.get(url, params=params, timeout=20)
    response.raise_for_status()
    return response.json()


def normalize_movie(raw: dict) -> dict:
    tmdb_id = int(raw.get("id") or 0)
    genres = raw.get("genre_ids") or []
    return {
        "movie_id": tmdb_id,
        "tmdb_id": tmdb_id,
        "title": raw.get("title") or "",
        "overview": raw.get("overview") or "",
        "poster_path": raw.get("poster_path"),
        "backdrop_path": raw.get("backdrop_path"),
        "release_date": raw.get("release_date") or "",
        "vote_average": float(raw.get("vote_average") or 0.0),
        "vote_count": int(raw.get("vote_count") or 0),
        "popularity": float(raw.get("popularity") or 0.0),
        "original_language": raw.get("original_language") or "",
        "genres": genres,
        "keywords": raw.get("genre_ids") or [],
        "updated_at_epoch": int(datetime.now(timezone.utc).timestamp()),
    }


def ingest(api_key: str, mongo_uri: str, db_name: str, target: int, sleep_ms: int) -> None:
    client = MongoClient(mongo_uri)
    collection = client[db_name]["movies"]

    session = requests.Session()
    # Ignore broken global proxy env on this machine.
    session.trust_env = False

    endpoints = [
        "movie/popular",
        "movie/top_rated",
        "movie/now_playing",
        "movie/upcoming",
        "trending/movie/week",
        "discover_tamil",
    ]

    seen_ids: set[int] = set()
    operations: list[UpdateOne] = []
    per_endpoint_page = 1
    round_count = 0

    while len(seen_ids) < target:
        round_count += 1
        any_new = False
        for endpoint in endpoints:
            try:
                payload = fetch_tmdb_page(session, api_key, endpoint, per_endpoint_page)
            except Exception as exc:
                print(f"[WARN] {endpoint} page {per_endpoint_page} failed: {exc}")
                continue

            for item in payload.get("results", []):
                mid = int(item.get("id") or 0)
                if mid <= 0 or mid in seen_ids:
                    continue
                seen_ids.add(mid)
                any_new = True
                movie_doc = normalize_movie(item)
                operations.append(
                    UpdateOne(
                        {"movie_id": movie_doc["movie_id"]},
                        {"$set": movie_doc},
                        upsert=True,
                    )
                )

            if sleep_ms > 0:
                time.sleep(sleep_ms / 1000.0)

        if operations:
            collection.bulk_write(operations, ordered=False)
            operations.clear()
            print(f"[INFO] round={round_count} page={per_endpoint_page} unique_movies={len(seen_ids)}")

        if not any_new:
            print("[INFO] No new movies fetched this round; stopping early.")
            break

        per_endpoint_page += 1
        if per_endpoint_page > 500:
            break

    total = collection.count_documents({})
    with_posters = collection.count_documents({"poster_path": {"$nin": [None, ""]}})
    print(f"[DONE] DB movies={total}, with_poster={with_posters}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest movies from TMDB into MongoDB")
    parser.add_argument("--target", type=int, default=10000, help="Target unique movies")
    parser.add_argument("--sleep-ms", type=int, default=120, help="Delay between API calls")
    parser.add_argument("--mongo-uri", default=os.getenv("MONGO_URI", "mongodb://localhost:27017"))
    parser.add_argument("--db-name", default=os.getenv("DATABASE_NAME", "cinisphere"))
    parser.add_argument("--api-key", default=os.getenv("TMDB_API_KEY"))
    args = parser.parse_args()

    if not args.api_key:
        raise SystemExit("TMDB_API_KEY is required (set env or --api-key)")

    ingest(
        api_key=args.api_key,
        mongo_uri=args.mongo_uri,
        db_name=args.db_name,
        target=args.target,
        sleep_ms=args.sleep_ms,
    )


if __name__ == "__main__":
    main()
