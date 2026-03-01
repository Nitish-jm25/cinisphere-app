"""
CINESPHERE — Diversity Reranker (Serving Layer)
Greedy genre-diversity reranking for hybrid recommendations.
"""

import sys
import logging
import time
from pathlib import Path
from collections import Counter

# ─── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Import mongo_ml_loader from offline_pipeline ───────────────
SCRIPT_DIR = Path(__file__).resolve().parent
OFFLINE_DIR = SCRIPT_DIR.parent / "offline_pipeline"

if str(OFFLINE_DIR) not in sys.path:
    sys.path.insert(0, str(OFFLINE_DIR))

from mongo_ml_loader import load_movies_from_mongo  # noqa: E402

# ─── Diversity Config ───────────────────────────────────────────
PENALTY_PER_REPEAT = 0.15       # penalty added per repeated genre
MAX_PENALTY = 0.6               # cap so good movies aren't buried


# ─── Load Genre Metadata Once ──────────────────────────────────
def _build_genre_map(df) -> dict:
    """
    Build {movie_id_str: set_of_genre_strings} from the raw DataFrame.
    Handles both list-of-dicts (TMDB) and comma/space-separated strings.
    """
    genre_map = {}

    for _, row in df.iterrows():
        mid = str(row.get("movie_id", ""))
        if not mid:
            continue

        raw = row.get("genres", "")

        if isinstance(raw, list):
            genres = set(
                item.get("name", "").strip().lower()
                if isinstance(item, dict) else str(item).strip().lower()
                for item in raw
            )
        else:
            genres = set(
                g.strip().lower()
                for g in str(raw).replace(",", " ").split()
                if g.strip()
            )

        genres.discard("")
        genre_map[mid] = genres

    return genre_map


logger.info("Loading genre metadata for diversity reranker …")

_raw_df = load_movies_from_mongo()

if _raw_df.empty:
    logger.error("No movies loaded — genre_map will be empty.")
    _genre_map: dict = {}
else:
    _genre_map = _build_genre_map(_raw_df)
    logger.info("Genre map built — %d movies mapped", len(_genre_map))

del _raw_df


# ─── Greedy Diversity Reranker ──────────────────────────────────
def rerank_for_diversity(
    ranked_movie_ids: list,
    top_k: int = 20,
) -> list:
    """
    Greedy reranking: iteratively pick the next movie that maximises
    its positional score minus a penalty for genres already selected.

    Positional score = 1 - (rank / N)  so first item ≈ 1.0, last ≈ 0.0.

    Returns a list of top_k movie_id strings.
    """
    n = len(ranked_movie_ids)
    if n == 0:
        return []

    # Pre-compute positional scores (higher = better original rank)
    pos_scores = {mid: 1.0 - (i / n) for i, mid in enumerate(ranked_movie_ids)}

    selected: list = []
    selected_genres: Counter = Counter()
    remaining = set(ranked_movie_ids)

    for _ in range(min(top_k, n)):
        best_id = None
        best_score = -float("inf")

        for mid in remaining:
            base = pos_scores[mid]

            # Compute penalty from genre overlap with already-selected movies
            genres = _genre_map.get(mid, set())
            if genres:
                overlap = sum(selected_genres[g] for g in genres)
                penalty = min(overlap * PENALTY_PER_REPEAT, MAX_PENALTY)
            else:
                penalty = 0.0

            score = base - penalty

            if score > best_score:
                best_score = score
                best_id = mid

        if best_id is None:
            break

        selected.append(best_id)
        remaining.discard(best_id)

        # Update genre counts
        for g in _genre_map.get(best_id, set()):
            selected_genres[g] += 1

    return selected


# ─── CLI Entry ─────────────────────────────────────────────────
if __name__ == "__main__":
    from hybrid_ranker import get_hybrid_recommendations

    sample_text = (
        "I love sci-fi movies with time travel and space exploration. "
        "I also enjoy thriller and mystery films with plot twists."
    )

    print("── Diversity Reranker — Quick Test ────────────")
    print(f"  Query: {sample_text[:70]}…\n")

    # Step 1: Get hybrid-ranked IDs
    hybrid_ids = get_hybrid_recommendations(sample_text, top_k=30)

    # Step 2: Rerank for diversity
    t0 = time.perf_counter()
    diverse_ids = rerank_for_diversity(hybrid_ids, top_k=10)
    elapsed = (time.perf_counter() - t0) * 1000

    print(f"  Top {len(diverse_ids)} diverse movie IDs (in {elapsed:.1f} ms):")
    all_genres = set()
    for rank, mid in enumerate(diverse_ids, 1):
        genres = _genre_map.get(mid, set())
        all_genres.update(genres)
        print(f"    {rank:2d}. movie_id={mid:<10s}  genres={genres}")

    print(f"\n  Distinct genres in top {len(diverse_ids)}: {len(all_genres)} → {all_genres}")
