from pydantic import BaseModel

from app.schemas.auth_schema import SurveyPayload
from app.schemas.recommendation_schema import MovieResponse


class TailorFitRequest(BaseModel):
    user_id: str
    survey: SurveyPayload
    top_k: int = 15
    similar_users_k: int = 5


class SimilarUser(BaseModel):
    user_id: str
    similarity: float
    name: str | None = None
    email: str | None = None


class TailorFitResponse(BaseModel):
    recommendations: list[MovieResponse]
    similar_users: list[SimilarUser]
