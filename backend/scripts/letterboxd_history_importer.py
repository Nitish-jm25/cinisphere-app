import argparse
import csv
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


def _normalize_text(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _safe_int(value, default: Optional[int] = None) -> Optional[int]:
    try:
        if value is None or str(value).strip() == "":
            return default
        return int(str(value).strip())
    except Exception:
        return default


def _parse_date(date_str: str | None):
    if not date_str:
        return datetime.now(timezone.utc)
    raw = str(date_str).strip()
    for fmt in ("%Y-%m-%d", "%d %b %Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def _find_movie_id(movies_collection, title: str, year: Optional[int]) -> Optional[int]:
    if not title:
        return None

    exact = movies_collection.find_one(
        {"title": {"$regex": f"^{title}$", "$options": "i"}},
        {"movie_id": 1, "release_date": 1},
    )
    if exact:
        if year is None:
            return int(exact["movie_id"])
        release = str(exact.get("release_date") or "")
        if release.startswith(str(year)):
            return int(exact["movie_id"])

    if year is not None:
        candidate = movies_collection.find_one(
            {
                "title": {"$regex": f"^{title}$", "$options": "i"},
                "release_date": {"$regex": f"^{year}"},
            },
            {"movie_id": 1},
        )
        if candidate:
            return int(candidate["movie_id"])

    fuzzy = movies_collection.find_one(
        {"title": {"$regex": f"{title}", "$options": "i"}},
        {"movie_id": 1},
    )
    if fuzzy:
        return int(fuzzy["movie_id"])

    return None


def run_import(user_id: str, csv_path: str):
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / "backend" / ".env")

    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "cinisphere"

    client = MongoClient(mongo_uri)
    db = client[db_name]
    users = db["users"]
    movies = db["movies"]
    user_history = db["user_history"]
    external = db["user_external_signals"]

    user_obj_id = ObjectId(user_id)
    if not users.find_one({"_id": user_obj_id}):
        raise RuntimeError(f"user_id not found: {user_id}")

    input_path = Path(csv_path).resolve()
    if not input_path.exists():
        raise RuntimeError(f"CSV file not found: {input_path}")

    imported = 0
    matched = 0
    unmatched = 0

    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            imported += 1
            title = row.get("Name") or row.get("Title") or row.get("Film")
            title = _normalize_text(title or "")
            year = _safe_int(row.get("Year"))
            rating = row.get("Rating")
            watched_date = row.get("Watched Date") or row.get("Date")

            movie_id = _find_movie_id(movies, title=title, year=year)

            # Save raw source row for traceability.
            external.insert_one(
                {
                    "user_id": user_obj_id,
                    "source": "letterboxd",
                    "title_raw": row.get("Name") or row.get("Title"),
                    "year_raw": row.get("Year"),
                    "rating_raw": rating,
                    "watched_date_raw": watched_date,
                    "matched_movie_id": movie_id,
                    "row": row,
                    "created_at": datetime.now(timezone.utc),
                }
            )

            if movie_id is None:
                unmatched += 1
                continue

            matched += 1
            user_history.update_one(
                {"user_id": user_obj_id},
                {
                    "$push": {
                        "watched": {
                            "movie_id": int(movie_id),
                            "watched_at": _parse_date(watched_date),
                            "source": "letterboxd",
                            "rating": rating,
                        }
                    }
                },
                upsert=True,
            )

    users.update_one(
        {"_id": user_obj_id},
        {
            "$set": {
                "letterboxd_imported_at": datetime.now(timezone.utc),
                "letterboxd_last_import_file": str(input_path),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    client.close()
    print(
        f"Done. imported={imported} matched={matched} unmatched={unmatched} "
        f"user_id={user_id} db={db_name}"
    )


def main():
    parser = argparse.ArgumentParser(description="Import Letterboxd CSV into user history")
    parser.add_argument("--user-id", required=True, help="Mongo user _id from signup/signin")
    parser.add_argument("--csv", required=True, help="Path to Letterboxd exported CSV")
    args = parser.parse_args()

    run_import(user_id=args.user_id, csv_path=args.csv)


if __name__ == "__main__":
    main()
