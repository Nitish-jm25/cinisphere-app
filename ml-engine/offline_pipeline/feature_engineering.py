"""
CINESPHERE — Feature Engineering Module (Offline Pipeline)
Enterprise-optimized version.
"""

import re
import logging
import time
from typing import Union, List

import pandas as pd

from mongo_ml_loader import load_movies_from_mongo

# ─── Logging Configuration ─────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Adaptive Thresholds ───────────────────────────────────────
BASE_MIN_VOTE_COUNT = 20      # safer for 3k dataset
BASE_MIN_POPULARITY = 2

# ─── Column Validation ─────────────────────────────────────────
def validate_columns(df: pd.DataFrame) -> pd.DataFrame:
    defaults = {
        "vote_count": 0,
        "popularity": 0.0,
        "overview": "",
        "genres": "",
        "keywords": "",
        "original_language": "",
    }

    for col, default in defaults.items():
        if col not in df.columns:
            logger.warning("Missing column: %s — adding default.", col)
            df[col] = default

    return df


# ─── Null Filling ───────────────────────────────────────────────
def fill_nulls(df: pd.DataFrame) -> pd.DataFrame:
    text_cols = ["overview", "genres", "keywords", "original_language"]
    for col in text_cols:
        df[col] = df[col].fillna("")
    return df


# ─── Filtering (Vectorized) ────────────────────────────────────
def filter_movies(df: pd.DataFrame) -> pd.DataFrame:
    total_before = len(df)

    # Adaptive thresholds for small dataset
    min_vote = BASE_MIN_VOTE_COUNT
    min_pop = BASE_MIN_POPULARITY

    mask = (
        (df["vote_count"] > min_vote)
        & (df["popularity"] > min_pop)
        & (df["overview"].str.strip() != "")
        & (df["genres"].astype(str).str.strip() != "")
    )

    df_filtered = df.loc[mask].copy()

    total_after = len(df_filtered)
    pct = (total_after / total_before * 100) if total_before else 0

    logger.info(
        "Filtering complete — %d → %d movies retained (%.1f%%)",
        total_before,
        total_after,
        pct,
    )

    return df_filtered


# ─── Normalize Genre / Keyword ─────────────────────────────────
def _extract_names(field: Union[str, List[dict], list]) -> str:
    if isinstance(field, list):
        return " ".join(
            item.get("name", "") if isinstance(item, dict) else str(item)
            for item in field
        )
    return str(field)


# ─── Combined Text Builder ─────────────────────────────────────
def build_combined_text(df: pd.DataFrame) -> pd.DataFrame:
    logger.info("Building combined_text column …")

    df["genres"] = df["genres"].apply(_extract_names)
    df["keywords"] = df["keywords"].apply(_extract_names)

    df["combined_text"] = (
        df["genres"].astype(str)
        + " "
        + df["keywords"].astype(str)
        + " "
        + df["overview"].astype(str)
        + " "
        + df["original_language"].astype(str)
    )

    return df


# ─── Vectorized Text Cleaning ───────────────────────────────────
def clean_text_column(series: pd.Series) -> pd.Series:
    return (
        series.str.lower()
        .str.replace(r"[^a-z0-9\s]", " ", regex=True)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )


# ─── Orchestrator ───────────────────────────────────────────────
def run_feature_engineering() -> pd.DataFrame:
    t0 = time.perf_counter()

    logger.info("═══ CINESPHERE Feature Engineering Pipeline ═══")

    raw_df = load_movies_from_mongo()
    if raw_df.empty:
        logger.error("No data returned from MongoDB.")
        return pd.DataFrame()

    logger.info("Loaded %d raw movies", len(raw_df))

    raw_df = validate_columns(raw_df)
    raw_df = fill_nulls(raw_df)

    df = filter_movies(raw_df)
    if df.empty:
        logger.warning("All movies filtered out.")
        return pd.DataFrame()

    df = build_combined_text(df)

    logger.info("Cleaning text for %d movies …", len(df))
    df["combined_text"] = clean_text_column(df["combined_text"])

    df.reset_index(drop=True, inplace=True)

    elapsed = time.perf_counter() - t0
    logger.info(
        "Pipeline complete — %d movies processed in %.2f s",
        len(df),
        elapsed,
    )

    return df


# ─── CLI Entry ─────────────────────────────────────────────────
if __name__ == "__main__":
    df = run_feature_engineering()

    if df.empty:
        logger.error("Pipeline returned empty DataFrame.")
    else:
        print("\n── DataFrame Overview ──────────────────────────")
        print(f"  Shape   : {df.shape}")
        print(f"  Columns : {list(df.columns)}")
        print(f"\n── Sample combined_text ────────────────────────")

        for i, row in df.head(3).iterrows():
            print(f"\n  [{row.get('title', f'Row {i}')}]")
            print(f"  {row['combined_text'][:120]}…")