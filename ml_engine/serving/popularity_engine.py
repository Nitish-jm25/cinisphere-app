"""
CINESPHERE — Popularity & Freshness Engine (Serving Layer)
Precomputes normalized scores at import time.
"""

import sys
import logging
import math
from datetime import datetime
from pathlib import Path

import numpy as np

# ─── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Import mongo_ml_loader from offline_pipeline ───────────────
SCRIPT_DIR = Path(__file__).resolve().parent                  # serving/
OFFLINE_DIR = SCRIPT_DIR.parent / "offline_pipeline"          # offline_pipeline/

if str(OFFLINE_DIR) not in sys.path:
    sys.path.insert(0, str(OFFLINE_DIR))

from mongo_ml_loader import load_movies_from_mongo  # noqa: E402


# ─── Score Computation ──────────────────────────────────────────
def _compute_scores(df) -> tuple:
    """
    Compute popularity_scores and freshness_scores from a DataFrame.
    Returns two dicts: {movie_id: float}.
    """
    current_year = datetime.now().year

    # ── Extract required columns with safe defaults ─────────
    movie_ids = df["movie_id"].astype(str).values if "movie_id" in df.columns else [str(i) for i in range(len(df))]
    vote_avg = df["vote_average"].fillna(0).values if "vote_average" in df.columns else np.zeros(len(df))
    vote_cnt = df["vote_count"].fillna(0).values if "vote_count" in df.columns else np.zeros(len(df))

    # Parse release year (vectorized)
    if "release_date" in df.columns:
        years = (
            df["release_date"]
            .astype(str)
            .str[:4]
            .apply(lambda y: int(y) if y.isdigit() and 1900 <= int(y) <= current_year + 1 else current_year - 10)
            .values
        )
    else:
        years = np.full(len(df), current_year - 10)

    # ── Popularity: vote_average * log(1 + vote_count) ──────
    raw_pop = vote_avg * np.log1p(vote_cnt)

    pop_min, pop_max = raw_pop.min(), raw_pop.max()
    if pop_max > pop_min:
        norm_pop = (raw_pop - pop_min) / (pop_max - pop_min)
    else:
        norm_pop = np.zeros_like(raw_pop)

    # ── Freshness: based on year difference from current year ─
    year_diff = current_year - years
    max_diff = year_diff.max() if year_diff.max() > 0 else 1

    # Invert so newer = higher score, then normalize 0–1
    raw_fresh = 1.0 - (year_diff / max_diff)

    fresh_min, fresh_max = raw_fresh.min(), raw_fresh.max()
    if fresh_max > fresh_min:
        norm_fresh = (raw_fresh - fresh_min) / (fresh_max - fresh_min)
    else:
        norm_fresh = np.ones_like(raw_fresh)

    # ── Build dicts ─────────────────────────────────────────
    pop_scores = {mid: float(round(s, 6)) for mid, s in zip(movie_ids, norm_pop)}
    fresh_scores = {mid: float(round(s, 6)) for mid, s in zip(movie_ids, norm_fresh)}

    return pop_scores, fresh_scores


# ─── Load Once at Import ────────────────────────────────────────
logger.info("Loading movie metadata for popularity engine …")

_raw_df = load_movies_from_mongo()

if _raw_df.empty:
    logger.error("No movies loaded — popularity_scores and freshness_scores will be empty.")
    popularity_scores: dict = {}
    freshness_scores: dict = {}
else:
    popularity_scores, freshness_scores = _compute_scores(_raw_df)
    logger.info(
        "Popularity engine ready — %d movies scored",
        len(popularity_scores),
    )

# Free the raw DataFrame (not needed after scoring)
del _raw_df


# ─── Accessors ──────────────────────────────────────────────────
def get_popularity_score(movie_id: str) -> float:
    """Return normalized popularity score for a movie, or 0.0 if unknown."""
    return popularity_scores.get(str(movie_id), 0.0)


def get_freshness_score(movie_id: str) -> float:
    """Return normalized freshness score for a movie, or 0.0 if unknown."""
    return freshness_scores.get(str(movie_id), 0.0)


# ─── CLI Entry ─────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n── Popularity Engine — Summary ─────────────────")
    print(f"  Movies scored  : {len(popularity_scores)}")

    if popularity_scores:
        # Top 10 by popularity
        top_pop = sorted(popularity_scores.items(), key=lambda x: x[1], reverse=True)[:10]
        print("\n  Top 10 by Popularity Score:")
        for rank, (mid, score) in enumerate(top_pop, 1):
            fresh = freshness_scores.get(mid, 0.0)
            print(f"    {rank:2d}. movie_id={mid:<10s}  pop={score:.4f}  fresh={fresh:.4f}")

        # Top 10 by freshness
        top_fresh = sorted(freshness_scores.items(), key=lambda x: x[1], reverse=True)[:10]
        print("\n  Top 10 by Freshness Score:")
        for rank, (mid, score) in enumerate(top_fresh, 1):
            pop = popularity_scores.get(mid, 0.0)
            print(f"    {rank:2d}. movie_id={mid:<10s}  fresh={score:.4f}  pop={pop:.4f}")
