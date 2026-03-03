"""
CINESPHERE — Survey-Based Movie Recommendation Engine

Netflix-style onboarding survey that collects user preferences
(genres, languages, mood, release window), then uses TF-IDF
content similarity to deliver personalised recommendations
straight from MongoDB.

Integrates with user_manager for account creation, profile
persistence, and watch history tracking.

Database : movie_recommendation_db
Collection: movies
"""

import sys
import os
import numpy as np
import pandas as pd
from datetime import datetime
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from .user_manager import (
        create_user,
        get_user_by_email,
        save_user_profile,
        get_user_profile,
        save_user_history,
    )
except ImportError:
    from user_manager import (
        create_user,
        get_user_by_email,
        save_user_profile,
        get_user_profile,
        save_user_history,
    )

# ─── Configuration ────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DATABASE_NAME") or os.getenv("DB_NAME") or "movie_recommendation_db"
COLLECTION_NAME = "movies"
TOP_N = 15

# Language display name → ISO code mapping
LANGUAGE_MAP = {
    "tamil": "ta", "english": "en", "hindi": "hi",
    "malayalam": "ml", "telugu": "te", "kannada": "kn",
    "korean": "ko", "japanese": "ja", "spanish": "es",
    "french": "fr", "german": "de", "chinese": "zh",
}

# Mood → genre/keyword association for scoring
MOOD_KEYWORDS = {
    "feel good": ["comedy", "family", "animation", "romance", "music", "adventure", "fantasy", "feel good", "happy", "fun"],
    "dark": ["thriller", "crime", "horror", "mystery", "dark", "noir", "suspense", "psychological"],
    "emotional": ["drama", "romance", "war", "history", "emotional", "heartfelt", "tragedy", "life"],
    "thriller": ["thriller", "mystery", "crime", "action", "suspense", "tension", "detective", "spy"],
    "mass/action": ["action", "adventure", "science fiction", "war", "superhero", "fantasy", "fight", "battle", "explosion"],
}


# ═══════════════════════════════════════════════════════════════
# 1. DATA LOADING
# ═══════════════════════════════════════════════════════════════
def load_movies() -> pd.DataFrame:
    """Load all movies from MongoDB."""
    print("\n  Connecting to MongoDB...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.server_info()
    except Exception as e:
        print(f"  [FATAL] MongoDB connection failed: {e}")
        sys.exit(1)

    collection = client[DB_NAME][COLLECTION_NAME]
    movies = list(collection.find({}, {"_id": 0}))
    client.close()

    if not movies:
        print("  [ERROR] No movies in MongoDB. Run ingestion script first.")
        sys.exit(1)

    df = pd.DataFrame(movies)
    print(f"  Loaded {len(df)} movies from MongoDB")
    return df


# ═══════════════════════════════════════════════════════════════
# 2. SURVEY
# ═══════════════════════════════════════════════════════════════
def run_survey() -> dict:
    """Conduct a Netflix-style onboarding survey."""
    print("\n" + "=" * 60)
    print("  🎬  CINESPHERE — Personalisation Survey")
    print("=" * 60)
    print("  Answer a few quick questions so we can find movies you'll love.\n")

    # ── Q1: Favourite Genres ──
    print("  1️⃣  What genres do you enjoy? (comma-separated)")
    print("     Examples: action, sci-fi, romance, thriller, comedy,")
    print("               horror, drama, animation, fantasy, mystery\n")
    genres_raw = input("     → ").strip()
    fav_genres = [g.strip().lower() for g in genres_raw.split(",") if g.strip()]

    # ── Q2: Favourite Languages ──
    print("\n  2️⃣  What languages do you prefer? (comma-separated)")
    print("     Examples: tamil, english, hindi, malayalam, telugu, korean\n")
    langs_raw = input("     → ").strip()
    fav_langs = [l.strip().lower() for l in langs_raw.split(",") if l.strip()]

    # ── Q3: Mood ──
    print("\n  3️⃣  What's your mood right now?")
    print("     1. Feel Good")
    print("     2. Dark")
    print("     3. Emotional")
    print("     4. Thriller")
    print("     5. Mass / Action\n")
    mood_choices = {
        "1": "feel good", "2": "dark", "3": "emotional",
        "4": "thriller", "5": "mass/action",
    }
    mood_input = input("     → Enter number (1-5): ").strip()
    mood = mood_choices.get(mood_input, "feel good")

    # ── Q4: Release Preference ──
    print("\n  4️⃣  Release preference?")
    print("     1. Latest movies (last 2 years)")
    print("     2. Any year")
    print("     3. Upcoming movies\n")
    release_input = input("     → Enter number (1-3): ").strip()
    release_pref = {"1": "latest", "2": "any", "3": "upcoming"}.get(release_input, "any")

    survey = {
        "genres": fav_genres,
        "languages": fav_langs,
        "mood": mood,
        "release_pref": release_pref,
    }

    # Summary
    print("\n" + "─" * 60)
    print("  ✓ Survey Complete!")
    print(f"    Genres   : {', '.join(fav_genres) or 'any'}")
    print(f"    Languages: {', '.join(fav_langs) or 'any'}")
    print(f"    Mood     : {mood}")
    print(f"    Release  : {release_pref}")
    print("─" * 60)

    return survey


# ═══════════════════════════════════════════════════════════════
# 3. FILTERING & FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════
def normalise_genres(val) -> str:
    """Convert genres field (list or string) to lowercase string."""
    if isinstance(val, list):
        return " ".join(str(g).lower() for g in val)
    if isinstance(val, str):
        return val.lower().replace(",", " ")
    return ""


def filter_by_release(df: pd.DataFrame, pref: str) -> pd.DataFrame:
    """Filter movies based on release preference."""
    if pref == "any":
        return df

    today = datetime.now()
    df = df.copy()
    df["release_date"] = pd.to_datetime(df["release_date"], errors="coerce")

    if pref == "latest":
        cutoff = today.replace(year=today.year - 2)
        df = df[df["release_date"] >= cutoff]
    elif pref == "upcoming":
        df = df[df["release_date"] >= today]

    if df.empty:
        print("  [INFO] No movies matched release filter — using full dataset.")
        return df

    return df


def filter_by_language(df: pd.DataFrame, languages: list) -> pd.DataFrame:
    """Soft-filter by language. Returns full dataset if nothing matches."""
    if not languages:
        return df

    # Convert display names to ISO codes
    iso_codes = set()
    for lang in languages:
        code = LANGUAGE_MAP.get(lang, lang)
        iso_codes.add(code)

    filtered = df[df["original_language"].isin(iso_codes)]

    if filtered.empty:
        print("  [INFO] No movies matched language filter — using full dataset.")
        return df

    return filtered


def build_survey_profile(survey: dict) -> str:
    """
    Create a synthetic 'user document' from survey answers so
    we can compute TF-IDF similarity against real movies.
    """
    parts = []

    # Genres (repeated for emphasis)
    genre_text = " ".join(survey["genres"]) if survey["genres"] else ""
    parts.append(genre_text)
    parts.append(genre_text)  # double weight

    # Mood keywords
    mood_kws = MOOD_KEYWORDS.get(survey["mood"], [])
    parts.append(" ".join(mood_kws))
    parts.append(" ".join(mood_kws))  # double weight

    return " ".join(parts)


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build combined text feature for TF-IDF."""
    df = df.copy()
    df["genres_text"] = df["genres"].apply(normalise_genres)
    df["overview"] = df["overview"].fillna("").astype(str)
    df["content"] = df["genres_text"] + " " + df["genres_text"] + " " + df["overview"]
    return df


# ═══════════════════════════════════════════════════════════════
# 4. RECOMMENDATION ENGINE
# ═══════════════════════════════════════════════════════════════
def generate_recommendations(df: pd.DataFrame, survey: dict, top_n: int = TOP_N) -> pd.DataFrame:
    """
    Full pipeline: filter → feature-engineer → TF-IDF → cosine
    similarity against the synthetic user profile.
    """
    print("\n  Building recommendation model...")

    # ── Step 1: Release filter ──
    df = filter_by_release(df, survey["release_pref"])
    if df.empty:
        print("  [ERROR] No movies after filtering.")
        return pd.DataFrame()

    # ── Step 2: Language filter ──
    df = filter_by_language(df, survey["languages"])
    if df.empty:
        print("  [ERROR] No movies after filtering.")
        return pd.DataFrame()

    df = df.reset_index(drop=True)
    print(f"  Candidate pool: {len(df)} movies")

    # ── Step 3: Feature engineering ──
    df = prepare_features(df)

    # ── Step 4: Build TF-IDF (movies + user profile) ──
    user_doc = build_survey_profile(survey)
    corpus = df["content"].tolist() + [user_doc]

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=10_000,
        ngram_range=(1, 2),
    )
    tfidf_matrix = vectorizer.fit_transform(corpus)
    print(f"  TF-IDF matrix: {tfidf_matrix.shape}")

    # ── Step 5: Cosine similarity (user profile = last row) ──
    user_vector = tfidf_matrix[-1]
    movie_vectors = tfidf_matrix[:-1]
    similarities = cosine_similarity(user_vector, movie_vectors).flatten()

    df["similarity_score"] = similarities

    # ── Step 6: Sort & return top N ──
    recs = (
        df.sort_values("similarity_score", ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )

    return recs


# ═══════════════════════════════════════════════════════════════
# 5. DISPLAY
# ═══════════════════════════════════════════════════════════════
def display_recommendations(recs: pd.DataFrame):
    """Pretty-print recommendations."""
    if recs.empty:
        print("\n  No recommendations found. Try different preferences.")
        return

    def fmt_genres(val):
        if isinstance(val, list):
            return ", ".join(str(g) for g in val)
        return str(val)

    print("\n" + "=" * 70)
    print("  🎬  YOUR PERSONALISED RECOMMENDATIONS")
    print("=" * 70)

    for i, row in recs.iterrows():
        score = row.get("similarity_score", 0)
        print(f"\n  {i + 1}. {row['title']}")
        print(f"     Language     : {row.get('original_language', 'N/A')}")
        print(f"     Genres       : {fmt_genres(row.get('genres', []))}")
        print(f"     Release Date : {row.get('release_date', 'N/A')}")
        print(f"     Rating       : {row.get('vote_average', 'N/A')}  ({row.get('vote_count', 0)} votes)")
        print(f"     Similarity   : {score:.4f}")

    print("\n" + "=" * 70)
    print(f"  Showing top {len(recs)} recommendations based on your survey.")
    print("=" * 70)


# ═══════════════════════════════════════════════════════════════
# 6. USER ONBOARDING & LOGIN
# ═══════════════════════════════════════════════════════════════
def onboard_new_user(df: pd.DataFrame) -> tuple[str, dict]:
    """
    Register a new user → run survey → build & save profile.

    Returns (user_id, survey_data).
    """
    print("\n" + "─" * 60)
    print("  📝  New User Registration")
    print("─" * 60)

    name = input("  Name  : ").strip()
    email = input("  Email : ").strip()
    password = input("  Password : ").strip()

    try:
        user_id = create_user(name, email, password)
    except ValueError as e:
        print(f"\n  [ERROR] {e}")
        sys.exit(1)

    print(f"\n  Welcome, {name}! Let's set up your preferences.")

    # Run the survey
    survey = run_survey()

    # Build TF-IDF profile vector from survey and save it
    user_doc = build_survey_profile(survey)

    # Build vectorizer on movie corpus to get a compatible vector
    df_feat = prepare_features(df)
    corpus = df_feat["content"].tolist() + [user_doc]

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=10_000,
        ngram_range=(1, 2),
    )
    tfidf_matrix = vectorizer.fit_transform(corpus)
    profile_vector = tfidf_matrix[-1].toarray().flatten().tolist()

    # Persist profile
    save_user_profile(user_id, survey, profile_vector)

    return user_id, survey


def login_existing_user() -> tuple[str, dict]:
    """
    Log in an existing user by email → fetch saved profile.

    Returns (user_id, survey_data).
    """
    print("\n" + "─" * 60)
    print("  🔑  Existing User Login")
    print("─" * 60)

    email = input("  Email : ").strip()

    user = get_user_by_email(email)
    if not user:
        print(f"\n  [ERROR] No account found for '{email}'.")
        sys.exit(1)

    user_id = user["user_id"]
    print(f"\n  Welcome back, {user['name']}!")

    profile = get_user_profile(user_id)
    if not profile:
        print("  [ERROR] No saved profile found. Please register again.")
        sys.exit(1)

    survey_data = profile["survey_data"]
    print(f"    Genres   : {', '.join(survey_data.get('genres', [])) or 'any'}")
    print(f"    Languages: {', '.join(survey_data.get('languages', [])) or 'any'}")
    print(f"    Mood     : {survey_data.get('mood', 'N/A')}")
    print(f"    Release  : {survey_data.get('release_pref', 'N/A')}")
    print("  Using your saved preferences to generate recommendations...")

    return user_id, survey_data


# ═══════════════════════════════════════════════════════════════
# 7. WATCH HISTORY RECORDING
# ═══════════════════════════════════════════════════════════════
def record_watch_history(user_id: str, recs: pd.DataFrame):
    """Save all recommended movies to the user's watch history."""
    if recs.empty:
        return

    print("\n  Saving recommendations to your watch history...")
    for _, row in recs.iterrows():
        movie_id = row.get("id") or row.get("movie_id") or row.get("tmdb_id", 0)
        if movie_id:
            save_user_history(user_id, int(movie_id))

    print(f"  [OK] {len(recs)} movies added to watch history.")


# ═══════════════════════════════════════════════════════════════
# 8. MAIN
# ═══════════════════════════════════════════════════════════════
def main():
    print("=" * 60)
    print("  CINESPHERE — Survey-Based Recommendation Engine")
    print("=" * 60)

    # Load movie data
    df = load_movies()

    # ── Ask: new or existing user ──
    print("\n  Are you a new user or existing user?")
    user_type = input("  → (new/existing): ").strip().lower()

    if user_type == "new":
        user_id, survey = onboard_new_user(df)
    elif user_type == "existing":
        user_id, survey = login_existing_user()
    else:
        print("  [ERROR] Invalid choice. Please enter 'new' or 'existing'.")
        sys.exit(1)

    # Generate recommendations using survey data (same ML pipeline)
    recs = generate_recommendations(df, survey, top_n=TOP_N)

    # Display
    display_recommendations(recs)

    # Save to watch history
    record_watch_history(user_id, recs)


if __name__ == "__main__":
    main()
