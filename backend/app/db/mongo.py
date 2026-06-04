from pymongo import MongoClient, ASCENDING, DESCENDING
from app.core.config import settings

client = MongoClient(settings.MONGO_URI)
db = client[settings.DATABASE_NAME]


def get_movies_collection():
    return db["movies"]


def ensure_indexes():
    """Create indexes to speed up queries on the 1M+ movies collection."""
    coll = get_movies_collection()
    try:
        # Primary sort indexes used by trending, top-rated, popular endpoints
        coll.create_index(
            [("popularity", DESCENDING), ("vote_average", DESCENDING), ("vote_count", DESCENDING)],
            name="idx_popularity_rating",
            background=True,
        )
        coll.create_index(
            [("vote_average", DESCENDING), ("vote_count", DESCENDING), ("popularity", DESCENDING)],
            name="idx_rating_popularity",
            background=True,
        )
        # Tamil / language-based discovery
        coll.create_index(
            [("original_language", ASCENDING), ("vote_average", DESCENDING), ("vote_count", DESCENDING)],
            name="idx_language_rating",
            background=True,
        )
        # Upcoming movies by release date
        coll.create_index(
            [("release_date", DESCENDING), ("vote_average", DESCENDING)],
            name="idx_release_date",
            background=True,
        )
        # Poster filtering (used in almost every query)
        coll.create_index(
            [("poster_path", ASCENDING)],
            name="idx_poster_path",
            background=True,
        )
        # Title search
        coll.create_index(
            [("title", ASCENDING)],
            name="idx_title",
            background=True,
        )
        # tmdb_id / movie_id lookups
        coll.create_index("tmdb_id", name="idx_tmdb_id", background=True, sparse=True)
        coll.create_index("movie_id", name="idx_movie_id", background=True, sparse=True)
    except Exception as e:
        print(f"[WARN] Index creation skipped or failed: {e}")


if settings.MONGO_ENSURE_INDEXES:
    ensure_indexes()
