import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.append(str(BASE_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import recommendation

app = FastAPI(title="CINESPHERE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    recommendation.router,
    prefix="/api",
    tags=["Recommendation"]
)