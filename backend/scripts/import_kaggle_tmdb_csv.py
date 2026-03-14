import argparse
import ast
import json
from pathlib import Path
from typing import Any

import pandas as pd
from pymongo import MongoClient, UpdateOne


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return default
        return float(value)
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return default
        return int(float(value))
    except Exception:
        return default


def _normalize_image_path(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.startswith("http://") or text.startswith("https://") or text.startswith("/"):
        return text
    return f"/{text}"


def _parse_list_field(value: Any) -> list[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            if isinstance(item, dict):
                name = str(item.get("name", "")).strip()
            else:
                name = str(item).strip()
            if name:
                out.append(name)
        return out

    text = str(value).strip()
    if not text:
        return []

    # JSON-like list/object string
    if text.startswith("[") or text.startswith("{"):
        for parser in (json.loads, ast.literal_eval):
            try:
                parsed = parser(text)
                return _parse_list_field(parsed)
            except Exception:
                continue

    # delimiter fallback
    if "|" in text:
        return [part.strip() for part in text.split("|") if part.strip()]
    if "," in text:
        return [part.strip() for part in text.split(",") if part.strip()]
    return [text]


def _pick_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    lower_map = {c.lower(): c for c in df.columns}
    for name in candidates:
        if name.lower() in lower_map:
            return lower_map[name.lower()]
    return None


def _resolve_csv_path(args_csv: str | None, download: bool, dataset: str) -> Path:
    if args_csv:
        csv_path = Path(args_csv).expanduser().resolve()
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV not found: {csv_path}")
        return csv_path

    if not download:
        raise ValueError("Provide --csv path, or use --download to fetch from Kaggle.")

    try:
        import kagglehub  # type: ignore
    except Exception as exc:
        raise RuntimeError("kagglehub is not installed. Run: pip install kagglehub") from exc

    dataset_path = Path(kagglehub.dataset_download(dataset)).resolve()
    csv_files = list(dataset_path.rglob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in downloaded dataset: {dataset_path}")

    # Use the largest CSV as default candidate.
    csv_files.sort(key=lambda p: p.stat().st_size, reverse=True)
    return csv_files[0]


def import_csv_to_mongo(
    csv_path: Path,
    mongo_uri: str,
    db_name: str,
    collection_name: str,
    chunk_size: int,
) -> None:
    client = MongoClient(mongo_uri)
    collection = client[db_name][collection_name]

    total_rows = 0
    total_upserts = 0

    for chunk in pd.read_csv(csv_path, chunksize=chunk_size):
        if chunk.empty:
            continue

        id_col = _pick_column(chunk, ["id", "tmdb_id", "movie_id"])
        title_col = _pick_column(chunk, ["title", "original_title", "name"])
        overview_col = _pick_column(chunk, ["overview", "description", "plot"])
        release_col = _pick_column(chunk, ["release_date", "releasedate", "release"])
        lang_col = _pick_column(chunk, ["original_language", "language", "lang"])
        rating_col = _pick_column(chunk, ["vote_average", "rating", "avg_vote"])
        vote_count_col = _pick_column(chunk, ["vote_count", "votes", "num_votes"])
        popularity_col = _pick_column(chunk, ["popularity"])
        genres_col = _pick_column(chunk, ["genres", "genre_names", "genre"])
        keywords_col = _pick_column(chunk, ["keywords", "tags"])
        poster_col = _pick_column(chunk, ["poster_path", "poster", "poster_url"])
        backdrop_col = _pick_column(chunk, ["backdrop_path", "backdrop", "backdrop_url"])

        if not id_col or not title_col:
            raise ValueError("CSV must contain at least movie id and title columns.")

        ops: list[UpdateOne] = []
        for _, row in chunk.iterrows():
            tmdb_id = _safe_int(row.get(id_col))
            if tmdb_id <= 0:
                continue

            title = str(row.get(title_col, "")).strip()
            if not title:
                continue

            doc = {
                "movie_id": tmdb_id,
                "tmdb_id": tmdb_id,
                "title": title,
                "overview": str(row.get(overview_col, "")).strip() if overview_col else "",
                "release_date": str(row.get(release_col, "")).strip() if release_col else "",
                "original_language": str(row.get(lang_col, "")).strip() if lang_col else "",
                "vote_average": _safe_float(row.get(rating_col), 0.0) if rating_col else 0.0,
                "vote_count": _safe_int(row.get(vote_count_col), 0) if vote_count_col else 0,
                "popularity": _safe_float(row.get(popularity_col), 0.0) if popularity_col else 0.0,
                "genres": _parse_list_field(row.get(genres_col)) if genres_col else [],
                "keywords": _parse_list_field(row.get(keywords_col)) if keywords_col else [],
                "poster_path": _normalize_image_path(row.get(poster_col)) if poster_col else None,
                "backdrop_path": _normalize_image_path(row.get(backdrop_col)) if backdrop_col else None,
                "updated_at_epoch": _safe_int(pd.Timestamp.utcnow().timestamp()),
            }

            ops.append(
                UpdateOne(
                    {"movie_id": doc["movie_id"]},
                    {"$set": doc},
                    upsert=True,
                )
            )

        if ops:
            result = collection.bulk_write(ops, ordered=False)
            total_upserts += result.upserted_count + result.modified_count

        total_rows += len(chunk)
        print(f"[INFO] processed_rows={total_rows}")

    total_docs = collection.count_documents({})
    with_posters = collection.count_documents({"poster_path": {"$nin": [None, ""]}})
    print(f"[DONE] collection={db_name}.{collection_name} total_docs={total_docs} with_poster={with_posters} write_ops={total_upserts}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import TMDB CSV (local or Kaggle) into MongoDB.")
    parser.add_argument("--csv", help="Path to CSV file")
    parser.add_argument("--download", action="store_true", help="Download dataset using kagglehub")
    parser.add_argument("--dataset", default="alanvourch/tmdb-movies-daily-updates", help="Kaggle dataset slug")
    parser.add_argument("--mongo-uri", default="mongodb://localhost:27017")
    parser.add_argument("--db-name", default="cinisphere")
    parser.add_argument("--collection", default="movies")
    parser.add_argument("--chunk-size", type=int, default=5000)
    args = parser.parse_args()

    csv_path = _resolve_csv_path(args.csv, args.download, args.dataset)
    print(f"[INFO] using_csv={csv_path}")

    import_csv_to_mongo(
        csv_path=csv_path,
        mongo_uri=args.mongo_uri,
        db_name=args.db_name,
        collection_name=args.collection,
        chunk_size=args.chunk_size,
    )


if __name__ == "__main__":
    main()
