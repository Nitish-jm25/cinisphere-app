"""
CINESPHERE — Hybrid Ranker (Serving Layer)
Blends content similarity, popularity, and freshness scores.
"""

import logging
import time

import numpy as np

from .content_recommender import compute_user_vector_from_text, compute_all_content_scores
from .popularity_engine import popularity_scores, freshness_scores

# ─── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Weights ────────────────────────────────────────────────────
W_CONTENT   = 0.6
W_POPULARITY = 0.3
W_FRESHNESS  = 0.1


# ─── Hybrid Recommendations ────────────────────────────────────
def get_hybrid_recommendations(user_text: str, top_k: int = 20) -> list:
    """
    Produce top_k movie_ids ranked by:
        final = 0.6·content + 0.3·popularity + 0.1·freshness

    All scoring is vectorized via numpy for low latency.
    """
    # 1. User vector
    user_vector = compute_user_vector_from_text(user_text)

    # 2. Content scores (dense 1-D array, one per movie row)
    content_scores, row_to_movie = compute_all_content_scores(user_vector)
    n_movies = len(content_scores)

    # 3. Build aligned popularity & freshness arrays
    pop_arr = np.zeros(n_movies, dtype=np.float32)
    fresh_arr = np.zeros(n_movies, dtype=np.float32)

    for row_idx in range(n_movies):
        mid = row_to_movie.get(row_idx)
        if mid is not None:
            pop_arr[row_idx] = popularity_scores.get(mid, 0.0)
            fresh_arr[row_idx] = freshness_scores.get(mid, 0.0)

    # 4. Weighted blend (vectorized)
    final_scores = (
        W_CONTENT * content_scores
        + W_POPULARITY * pop_arr
        + W_FRESHNESS * fresh_arr
    )

    # 5. Top-k via argpartition (O(n) average)
    if top_k < n_movies:
        top_indices = np.argpartition(final_scores, -top_k)[-top_k:]
    else:
        top_indices = np.arange(n_movies)

    # Sort the top_k by descending final score
    top_indices = top_indices[np.argsort(final_scores[top_indices])[::-1]]

    # 6. Map to movie_ids
    results = [
        row_to_movie[int(i)]
        for i in top_indices
        if int(i) in row_to_movie
    ]

    return results


# ─── CLI Entry ─────────────────────────────────────────────────
if __name__ == "__main__":
    sample_text = (
        "I love sci-fi movies with time travel and space exploration. "
        "I also enjoy thriller and mystery films with plot twists."
    )

    print("── Hybrid Ranker — Quick Test ─────────────────")
    print(f"  Weights : content={W_CONTENT}, pop={W_POPULARITY}, fresh={W_FRESHNESS}")
    print(f"  Query   : {sample_text[:70]}…\n")

    t0 = time.perf_counter()
    recs = get_hybrid_recommendations(sample_text, top_k=10)
    elapsed = (time.perf_counter() - t0) * 1000

    print(f"  Top {len(recs)} movie IDs (in {elapsed:.1f} ms):")
    for rank, mid in enumerate(recs, 1):
        pop = popularity_scores.get(mid, 0.0)
        fresh = freshness_scores.get(mid, 0.0)
        print(f"    {rank:2d}. movie_id={mid:<10s}  pop={pop:.4f}  fresh={fresh:.4f}")
