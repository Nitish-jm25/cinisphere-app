"""
CINESPHERE — TF-IDF Vector Pipeline (Offline)
Sparse, scalable, production-ready version.
"""

import json
import logging
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

from feature_engineering import run_feature_engineering

# ─── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Paths ──────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
MODELS_DIR = SCRIPT_DIR.parent / "models"

VECTORIZER_PATH = MODELS_DIR / "tfidf_vectorizer.pkl"
MATRIX_PATH = MODELS_DIR / "movie_matrix.npz"   # 🔥 changed to sparse
INDEX_MAP_PATH = MODELS_DIR / "movie_index_mapping.json"

# ─── TF-IDF Config ─────────────────────────────────────────────
MAX_FEATURES = 10_000
STOP_WORDS = "english"

# ─── Vectorization ─────────────────────────────────────────────
def build_tfidf_matrix(corpus: pd.Series):
    logger.info(
        "Fitting TF-IDF — max_features=%d, stop_words='%s' …",
        MAX_FEATURES,
        STOP_WORDS,
    )

    vectorizer = TfidfVectorizer(
        max_features=MAX_FEATURES,
        stop_words=STOP_WORDS,
        dtype=np.float32,   # memory efficient
    )

    tfidf_sparse = vectorizer.fit_transform(corpus)

    logger.info("TF-IDF shape: %s (sparse)", tfidf_sparse.shape)

    return vectorizer, tfidf_sparse


# ─── Index Mapping ──────────────────────────────────────────────
def build_index_mapping(df: pd.DataFrame) -> dict:
    if "movie_id" in df.columns:
        return {str(mid): idx for idx, mid in enumerate(df["movie_id"])}
    else:
        logger.warning("No 'movie_id' column — using row indices.")
        return {str(idx): idx for idx in range(len(df))}


# ─── Save Artifacts ─────────────────────────────────────────────
def save_artifacts(vectorizer, matrix, index_map: dict) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # 1️⃣ Save vectorizer
    joblib.dump(vectorizer, VECTORIZER_PATH)
    logger.info("Saved vectorizer → %s", VECTORIZER_PATH.name)

    # 2️⃣ Save sparse matrix safely
    sparse.save_npz(MATRIX_PATH, matrix)
    size_mb = os.path.getsize(MATRIX_PATH) / (1024 * 1024)
    logger.info("Saved sparse matrix → %s (%.1f MB)", MATRIX_PATH.name, size_mb)

    # 3️⃣ Save index mapping
    with open(INDEX_MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(index_map, f)
    logger.info("Saved index map → %s (%d entries)", INDEX_MAP_PATH.name, len(index_map))


# ─── Load Saved Artifacts ───────────────────────────────────────
def load_saved_vectors():
    for p in (VECTORIZER_PATH, MATRIX_PATH, INDEX_MAP_PATH):
        if not p.exists():
            raise FileNotFoundError(f"Missing artifact: {p}")

    vectorizer = joblib.load(VECTORIZER_PATH)
    matrix = sparse.load_npz(MATRIX_PATH)

    with open(INDEX_MAP_PATH, "r", encoding="utf-8") as f:
        index_map = json.load(f)

    logger.info(
        "Loaded artifacts — matrix %s (sparse), %d index entries",
        matrix.shape,
        len(index_map),
    )

    return vectorizer, matrix, index_map


# ─── Orchestrator ───────────────────────────────────────────────
def run_vector_pipeline():
    t0 = time.perf_counter()

    logger.info("═══ CINESPHERE Vector Pipeline (Sparse Mode) ═══")

    df = run_feature_engineering()
    if df.empty:
        logger.error("Feature engineering returned empty DataFrame.")
        return

    vectorizer, matrix = build_tfidf_matrix(df["combined_text"])
    index_map = build_index_mapping(df)

    save_artifacts(vectorizer, matrix, index_map)

    elapsed = time.perf_counter() - t0
    logger.info(
        "Vector pipeline complete — %d movies vectorized in %.2f s",
        len(df),
        elapsed,
    )


# ─── CLI Entry ─────────────────────────────────────────────────
if __name__ == "__main__":
    run_vector_pipeline()

    # Verification
    try:
        vec, mat, idx = load_saved_vectors()
        print("\n── Verification ───────────────────────────────")
        print(f"  Matrix shape   : {mat.shape}")
        print(f"  Matrix type    : {type(mat)}")
        print(f"  Index entries  : {len(idx)}")
        print(f"  Vocab size     : {len(vec.vocabulary_)}")
    except FileNotFoundError as e:
        logger.error("Verification failed: %s", e)