from fastapi import APIRouter, HTTPException

from app.schemas.tailor_fit_schema import TailorFitRequest, TailorFitResponse
from app.services.tailor_fit_service import recommend_tailor_fit

router = APIRouter()


@router.post("/recommend", response_model=TailorFitResponse)
def tailor_fit_recommend(payload: TailorFitRequest):
    try:
        return recommend_tailor_fit(
            user_id=payload.user_id,
            survey=payload.survey.model_dump(),
            top_k=payload.top_k,
            similar_users_k=payload.similar_users_k,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
