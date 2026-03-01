import sys
from pathlib import Path

from ml_engine.serving.hybrid_ranker import get_hybrid_recommendations
from ml_engine.serving.diversity_reranker import rerank_with_diversity

def generate_recommendations(user_text: str, top_k: int = 20):

    ranked_ids = get_hybrid_recommendations(
        user_text=user_text,
        top_k=50  # extra before diversity
    )

    diversified = rerank_with_diversity(
        ranked_ids,
        top_k=top_k
    )

    return diversified