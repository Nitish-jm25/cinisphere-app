import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.append(str(BASE_DIR))

from app.api.routes import auth, recommendation, tailor_fit, tmdb
from app.api.routes.chat import router as chat_router
from app.api.routes.communities import router as communities_router
from app.api.routes.comments import router as comments_router
from app.api.routes.moderation import router as moderation_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.posts import router as posts_router
from app.api.routes.social_auth import router as social_auth_router
from app.api.routes.users import router as users_router
from app.core import dependencies
from app.core.config import settings
from app.db.sql import SessionLocal, init_db
from app.services.seed_service import seed_social_data

app = FastAPI(title="CINESPHERE API")

cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    settings.FRONTEND_BASE_URL,
]
cors_origins.extend(
    origin.strip()
    for origin in settings.BACKEND_CORS_ORIGINS.split(",")
    if origin.strip()
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(cors_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(recommendation.router, prefix="/api", tags=["Recommendation"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(tailor_fit.router, prefix="/api/tailor-fit", tags=["TailorFit"])
app.include_router(tmdb.router, prefix="/api/tmdb", tags=["TMDB"])

# New SQL/JWT social module endpoints
app.include_router(social_auth_router)
app.include_router(users_router)
app.include_router(posts_router)
app.include_router(comments_router)
app.include_router(communities_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(moderation_router)

# API-prefixed aliases for organized route grouping.
app.include_router(users_router, prefix="/api")
app.include_router(posts_router, prefix="/api")
app.include_router(communities_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(moderation_router, prefix="/api")
uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.on_event("startup")
def startup_event():
    init_db()
    db = SessionLocal()
    try:
        if settings.SOCIAL_SEED_ENABLED:
            seed_social_data(db)
    finally:
        db.close()
    print("Social SQL tables initialized")
