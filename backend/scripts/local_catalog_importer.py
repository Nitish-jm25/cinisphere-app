import argparse
import csv
import json
import os
import time
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne


def _to_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(float(value))
    except Exception:
        return default


def _to_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def _parse_listish(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, (int, float)):
        return [value]

    text = str(value).strip()
    if not text:
        return []

    # JSON list string, e.g. '["Action","Sci-Fi"]'
    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            pass

    # Fallback: comma-separated
    return [part.strip() for part in text.split(",") if part.strip()]


def _normalize_genres(raw_genres, raw_genre_ids):
    genres = _parse_listish(raw_genres)
    if genres:
        if genres and isinstance(genres[0], dict):
            return genres
        return [str(g) for g in genres]

    genre_ids = _parse_listish(raw_genre_ids)
    return [str(g) for g in genre_ids]


def _normalize_keywords(raw_keywords):
    keywords = _parse_listish(raw_keywords)
    if keywords and isinstance(keywords[0], dict):
        return keywords
    return [str(k) for k in keywords]


def normalize_movie(row: dict):
    movie_id = (
        row.get("movie_id")
        or row.get("id")
        or row.get("tmdb_id")
        or row.get("movieId")
    )
    movie_id = _to_int(movie_id, default=0)
    if movie_id <= 0:
        return None

    genres = _normalize_genres(row.get("genres"), row.get("genre_ids"))
    keywords = _normalize_keywords(row.get("keywords"))

    return {
        "tmdb_id": movie_id,
        "movie_id": movie_id,
        "title": row.get("title") or row.get("name") or "",
        "overview": row.get("overview") or row.get("description") or row.get("plot") or "",
        "genres": genres,
        "keywords": keywords,
        "original_language": row.get("original_language") or row.get("language") or row.get("lang") or "",
        "vote_average": _to_float(row.get("vote_average"), 0.0),
        "vote_count": _to_int(row.get("vote_count"), 0),
        "popularity": _to_float(row.get("popularity"), 0.0),
        "release_date": str(row.get("release_date") or ""),
        "poster_path": row.get("poster_path"),
        "backdrop_path": row.get("backdrop_path"),
        "updated_at_epoch": int(time.time()),
    }


def load_rows(input_path: Path, file_format: str) -> Iterable[dict]:
    if file_format == "csv":
        with input_path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                yield row
        return

    if file_format == "json":
        with input_path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        if isinstance(payload, list):
            for row in payload:
                if isinstance(row, dict):
                    yield row
        elif isinstance(payload, dict):
            items = payload.get("results") if isinstance(payload.get("results"), list) else []
            for row in items:
                if isinstance(row, dict):
                    yield row
        return

    if file_format == "jsonl":
        with input_path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                    if isinstance(row, dict):
                        yield row
                except Exception:
                    continue
        return

    raise RuntimeError(f"Unsupported format: {file_format}")


def detect_format(input_path: Path, file_format: str) -> str:
    if file_format != "auto":
        return file_format
    suffix = input_path.suffix.lower()
    if suffix == ".csv":
        return "csv"
    if suffix == ".json":
        return "json"
    if suffix in (".jsonl", ".ndjson"):
        return "jsonl"
    raise RuntimeError("Could not auto-detect format. Use --format csv|json|jsonl")


def run_import(input_file: str, file_format: str, limit: int | None):
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / "backend" / ".env")

    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "cinisphere"

    input_path = Path(input_file).resolve()
    if not input_path.exists():
        raise RuntimeError(f"Input file not found: {input_path}")

    resolved_format = detect_format(input_path, file_format)

    client = MongoClient(mongo_uri)
    collection = client[db_name]["movies"]

    collection.create_index("movie_id", unique=True)
    collection.create_index("popularity")
    collection.create_index("vote_count")
    collection.create_index("release_date")

    inserted = 0
    updated = 0
    skipped = 0
    total_seen = 0

    ops = []
    batch_size = 1000

    for row in load_rows(input_path, resolved_format):
        total_seen += 1
        if limit is not None and total_seen > limit:
            break

        doc = normalize_movie(row)
        if not doc:
            skipped += 1
            continue

        ops.append(
            UpdateOne(
                {"movie_id": doc["movie_id"]},
                {"$set": doc},
                upsert=True,
            )
        )

        if len(ops) >= batch_size:
            result = collection.bulk_write(ops, ordered=False)
            inserted += result.upserted_count
            updated += result.modified_count
            ops = []

    if ops:
        result = collection.bulk_write(ops, ordered=False)
        inserted += result.upserted_count
        updated += result.modified_count

    client.close()

    print(
        f"Import done. seen={total_seen} inserted={inserted} updated={updated} "
        f"skipped={skipped} db={db_name} collection=movies source={input_path}"
    )


def main():
    parser = argparse.ArgumentParser(description="Import local movie catalog into MongoDB")
    parser.add_argument("--input", required=True, help="Path to CSV/JSON/JSONL movie file")
    parser.add_argument(
        "--format",
        default="auto",
        choices=["auto", "csv", "json", "jsonl"],
        help="Input file format",
    )
    parser.add_argument("--limit", type=int, default=None, help="Optional max rows to import")
    args = parser.parse_args()

    run_import(input_file=args.input, file_format=args.format, limit=args.limit)


if __name__ == "__main__":
    main()
