from fastapi import APIRouter, HTTPException, Request

from app.schemas.auth_schema import AuthResponse, SignInRequest, SignUpRequest
from app.services.auth_service import sign_in, sign_up

router = APIRouter()


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignUpRequest, request: Request):
    try:
        result = sign_up(
            name=payload.name,
            email=payload.email,
            password=payload.password,
            survey=payload.survey.model_dump() if payload.survey else None,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/signin", response_model=AuthResponse)
def signin(payload: SignInRequest, request: Request):
    result = sign_in(
        email=payload.email,
        password=payload.password,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return result
