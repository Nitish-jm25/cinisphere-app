from ml_engine.serving.hybrid_ranker import get_hybrid_recommendations
from ml_engine.serving.diversity_reranker import rerank_for_diversity
from functools import lru_cache


class MLService:
    def __init__(self):
        # Hybrid & diversity modules already load models internally
        pass

    @lru_cache(maxsize=500)
    def recommend(self, user_text: str, top_k: int = 20):
        ranked_ids = get_hybrid_recommendations(
            user_text=user_text,
            top_k=50
        )

        diversified_ids = rerank_for_diversity(
            ranked_ids,
            top_k=top_k
        )

        return diversified_ids