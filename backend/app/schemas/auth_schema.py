from pydantic import BaseModel, EmailStr


class SurveyPayload(BaseModel):
    mood: str
    language: str
    movie_type: str
    release_pref: str = "any"


class SignUpRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    survey: SurveyPayload | None = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user_id: str
    name: str
    email: EmailStr
    has_profile: bool
