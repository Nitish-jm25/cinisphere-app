"""
CINESPHERE — Content-Based Recommender (Serving Layer)
Pure sparse TF-IDF similarity, optimized for low latency.
"""

import json
import logging
import time
from pathlib import Path

import numpy as np
import joblib
from scipy import sparse

# ─── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Paths ──────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent          # serving/
MODELS_DIR = SCRIPT_DIR.parent / "models"             # ml-engine/models/

VECTORIZER_PATH = MODELS_DIR / "tfidf_vectorizer.pkl"
MATRIX_PATH = MODELS_DIR / "movie_matrix.npz"
INDEX_MAP_PATH = MODELS_DIR / "movie_index_mapping.json"

# ─── Load Artifacts at Import Time ──────────────────────────────
logger.info("Loading TF-IDF artifacts …")

_vectorizer = joblib.load(VECTORIZER_PATH)
_movie_matrix = sparse.load_npz(MATRIX_PATH)

with open(INDEX_MAP_PATH, "r", encoding="utf-8") as _f:
    _index_to_movie: dict = json.load(_f)       # {"movie_id": row_idx}

# Build reverse map: row_idx → movie_id (once at startup)
_row_to_movie = {int(idx): mid for mid, idx in _index_to_movie.items()}

logger.info(
    "Artifacts loaded — matrix %s (sparse), %d movies indexed",
    _movie_matrix.shape,
    len(_row_to_movie),
)


# ─── User Vector ───────────────────────────────────────────────
def compute_user_vector_from_text(text: str):
    """
    Transform raw user text into a TF-IDF sparse vector
    using the pre-fitted vectorizer.
    Returns a sparse matrix of shape (1, n_features).
    """
    return _vectorizer.transform([text])


# ─── Recommendations ───────────────────────────────────────────
def get_content_recommendations(user_vector, top_k: int = 20) -> list:
    """
    Compute cosine similarity between *user_vector* and every movie
    using sparse dot product (no sklearn overhead).

    Returns a list of top_k movie_id strings, sorted by
    descending similarity.
    """
    # Sparse dot: (n_movies, n_feat) · (n_feat, 1) → (n_movies, 1)
    scores = _movie_matrix.dot(user_vector.T)

    # Convert to dense 1-D array for ranking
    if sparse.issparse(scores):
        scores = np.asarray(scores.todense()).ravel()
    else:
        scores = np.asarray(scores).ravel()

    # Partial argsort — only need top_k indices (O(n) average)
    if top_k < len(scores):
        top_indices = np.argpartition(scores, -top_k)[-top_k:]
    else:
        top_indices = np.arange(len(scores))

    # Sort the top_k by descending score
    top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

    # Map row indices → movie_ids
    results = [_row_to_movie[int(i)] for i in top_indices if int(i) in _row_to_movie]

    return results


# ─── Full Score Array (for hybrid ranker) ──────────────────────
def compute_all_content_scores(user_vector) -> tuple:
    """
    Return (scores_array, row_to_movie_dict) where scores_array
    is a dense 1-D numpy float array of cosine similarities for
    every movie in the matrix.
    """
    raw = _movie_matrix.dot(user_vector.T)
    if sparse.issparse(raw):
        scores = np.asarray(raw.todense()).ravel()
    else:
        scores = np.asarray(raw).ravel()
    return scores, _row_to_movie


# ─── CLI Entry ─────────────────────────────────────────────────
if __name__ == "__main__":
    sample_text = (
        "I love sci-fi movies with time travel and space exploration. "
        "I also enjoy thriller and mystery films with plot twists."
    )

    print("── Content Recommender — Quick Test ───────────")
    print(f"  Query: {sample_text[:80]}…\n")

    t0 = time.perf_counter()
    vec = compute_user_vector_from_text(sample_text)
    recs = get_content_recommendations(vec, top_k=10)
    elapsed = (time.perf_counter() - t0) * 1000

    print(f"  Top {len(recs)} movie IDs (in {elapsed:.1f} ms):")
    for rank, mid in enumerate(recs, 1):
        print(f"    {rank:2d}. {mid}")
