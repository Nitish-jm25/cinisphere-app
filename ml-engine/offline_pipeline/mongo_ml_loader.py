"""
CINESPHERE — MongoDB → Pandas Loader for ML Pipeline

Connects to local MongoDB, loads all movie documents from the
'movie_recommendation_db' database into a pandas DataFrame, and prepares
the data for downstream ML model usage.

The project uses an external TMDB ingestion utility (`tmdb_ingestor.py`)
that can populate or refresh the collection with thousands of movies
when a valid TMDB_API_KEY is provided.  This loader will prompt you when
it detects an empty/undersized dataset.
"""

import sys
import pandas as pd
from pymongo import MongoClient

# ─── Configuration ────────────────────────────────────────────
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "movie_recommendation_db"
COLLECTION_NAME = "movies"


def load_movies_from_mongo() -> pd.DataFrame:
    """
    Connect to MongoDB, fetch all movie documents, and return
    a cleaned pandas DataFrame (without the Mongo _id field).
    """

    # --- Connect ---
    print("Connecting to MongoDB...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.server_info()  # verify connection is alive
    except Exception as e:
        print(f"[ERROR] Could not connect to MongoDB: {e}")
        sys.exit(1)

    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    # --- Fetch ---
    print("Fetching movies...")
    cursor = collection.find({}, {"_id": 0})  # exclude _id field
    movies = list(cursor)
    client.close()

    # --- Validate ---
    if not movies:
        print("[WARNING] No movies found in MongoDB.")
        print(f"  Database   : {DB_NAME}")
        print(f"  Collection : {COLLECTION_NAME}")
        print("  Make sure you have run the data ingestion script first.")
        # If the user has a TMDB key we can offer to populate automatically
        import os
        if os.environ.get("TMDB_API_KEY"):
            print("  Tip: set TMDB_API_KEY and run tmdb_ingestor.py to import a large catalog of films.")
        return pd.DataFrame()

    # --- Convert to DataFrame ---
    df = pd.DataFrame(movies)
    print(f"Loaded {len(df)} movies from MongoDB\n")

    return df


# ─── Main ─────────────────────────────────────────────────────
if __name__ == "__main__":
    df = load_movies_from_mongo()

    if df.empty:
        sys.exit(1)

    # Preview
    print("DataFrame shape:", df.shape)
    print("Columns:", list(df.columns))
    print("\nFirst 5 rows:")
    print(df.head())
