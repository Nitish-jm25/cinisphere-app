from fastapi import APIRouter
from app.schemas.recommendation_schema import (
    RecommendationRequest,
    RecommendationResponse
)
from app.services.recommendation_service import generate_recommendations

router = APIRouter()


@router.post("/recommend", response_model=RecommendationResponse)
def recommend_movies(request: RecommendationRequest):

    results = generate_recommendations(
        user_text=request.user_text,
        top_k=request.top_k
    )

    return RecommendationResponse(recommendations=results)