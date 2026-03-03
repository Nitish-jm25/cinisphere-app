import argparse
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

TMDB_BASE_URL = "https://api.themoviedb.org/3"


def tmdb_get(
    api_key: str,
    path: str,
    params: dict | None = None,
    timeout_sec: int = 30,
    max_retries: int = 4,
    retry_base_sleep_ms: int = 500,
):
    query = {"api_key": api_key}
    if params:
        query.update(params)
    url = f"{TMDB_BASE_URL}{path}?{urlencode(query)}"

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            with urlopen(url, timeout=timeout_sec) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8") if exc.fp else str(exc)
            # Auth/permission errors should fail fast.
            if exc.code in (401, 403):
                raise RuntimeError(f"TMDB HTTP {exc.code}: {body}")
            last_error = RuntimeError(f"TMDB HTTP {exc.code}: {body}")
        except URLError as exc:
            last_error = RuntimeError(f"TMDB network error: {exc.reason}")
        except Exception as exc:
            last_error = RuntimeError(f"TMDB unknown error: {exc}")

        if attempt < max_retries:
            backoff = (retry_base_sleep_ms * (2 ** (attempt - 1))) / 1000
            print(f"TMDB request failed (attempt {attempt}/{max_retries}). Retrying in {backoff:.1f}s...")
            time.sleep(backoff)

    raise last_error if last_error else RuntimeError("TMDB request failed")


def normalize_movie(movie: dict):
    genres = movie.get("genres", [])
    if genres and isinstance(genres[0], dict):
        genre_value = genres
    else:
        genre_ids = movie.get("genre_ids", [])
        genre_value = [str(gid) for gid in genre_ids]

    return {
        "tmdb_id": int(movie.get("id")),
        "movie_id": int(movie.get("id")),
        "title": movie.get("title") or movie.get("name") or "",
        "overview": movie.get("overview") or "",
        "genres": genre_value,
        "keywords": [],
        "original_language": movie.get("original_language") or "",
        "vote_average": float(movie.get("vote_average") or 0.0),
        "vote_count": int(movie.get("vote_count") or 0),
        "popularity": float(movie.get("popularity") or 0.0),
        "release_date": movie.get("release_date") or "",
        "poster_path": movie.get("poster_path"),
        "backdrop_path": movie.get("backdrop_path"),
        "updated_at_epoch": int(time.time()),
    }


def run_ingestion(pages: int, sleep_ms: int, timeout_sec: int, max_retries: int):
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / "backend" / ".env")

    tmdb_api_key = os.getenv("TMDB_API_KEY")
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "cinisphere"

    if not tmdb_api_key:
        raise RuntimeError("TMDB_API_KEY is missing in backend/.env")

    client = MongoClient(mongo_uri)
    collection = client[db_name]["movies"]

    collection.create_index("movie_id", unique=True)
    collection.create_index("popularity")
    collection.create_index("vote_count")
    collection.create_index("release_date")

    inserted = 0
    updated = 0
    failed = 0
    failed_pages = 0

    for page in range(1, pages + 1):
        try:
            payload = tmdb_get(
                tmdb_api_key,
                "/discover/movie",
                {
                    "sort_by": "popularity.desc",
                    "include_adult": "false",
                    "include_video": "false",
                    "language": "en-US",
                    "page": page,
                },
                timeout_sec=timeout_sec,
                max_retries=max_retries,
            )
        except RuntimeError as exc:
            failed_pages += 1
            print(f"Page {page}: request failed -> {exc}")
            continue

        movies = payload.get("results", [])
        if not movies:
            print(f"Page {page}: no results, stopping.")
            break

        ops = []
        for movie in movies:
            mid = movie.get("id")
            if not mid:
                failed += 1
                continue

            doc = normalize_movie(movie)
            ops.append(
                UpdateOne(
                    {"movie_id": doc["movie_id"]},
                    {"$set": doc},
                    upsert=True,
                )
            )

        if ops:
            result = collection.bulk_write(ops, ordered=False)
            inserted += result.upserted_count
            updated += result.modified_count

        print(
            f"Page {page}: fetched={len(movies)} inserted_total={inserted} "
            f"updated_total={updated} failed_total={failed}"
        )

        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000)

    client.close()
    print(
        f"Done. inserted={inserted} updated={updated} failed={failed} "
        f"failed_pages={failed_pages} db={db_name} collection=movies"
    )


def main():
    parser = argparse.ArgumentParser(description="TMDB -> Mongo movie ingestion")
    parser.add_argument("--pages", type=int, default=50, help="Number of TMDB pages to ingest")
    parser.add_argument("--sleep-ms", type=int, default=150, help="Delay between API calls")
    parser.add_argument("--timeout-sec", type=int, default=30, help="TMDB request timeout in seconds")
    parser.add_argument("--max-retries", type=int, default=4, help="TMDB retries per page")
    args = parser.parse_args()
    run_ingestion(
        pages=args.pages,
        sleep_ms=args.sleep_ms,
        timeout_sec=args.timeout_sec,
        max_retries=args.max_retries,
    )


if __name__ == "__main__":
    main()
