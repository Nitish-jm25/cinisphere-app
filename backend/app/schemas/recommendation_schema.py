from pydantic import BaseModel
from typing import List


class RecommendationRequest(BaseModel):
    user_text: str
    top_k: int = 20


class RecommendationResponse(BaseModel):
    recommendations: List[int]