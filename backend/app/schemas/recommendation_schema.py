from pydantic import BaseModel
from typing import List, Optional


class RecommendationRequest(BaseModel):
    user_text: str
    top_k: int = 10


class MovieResponse(BaseModel):
    movie_id: int
    title: str
    poster_path: Optional[str] = None
    overview: Optional[str] = None
    vote_average: Optional[float] = None
    release_date: Optional[str] = None
    genres: Optional[List[str]] = None
    popularity: Optional[float] = None


class RecommendationResponse(BaseModel):
    recommendations: List[MovieResponse]