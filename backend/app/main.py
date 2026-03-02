import sys
from pathlib import Path

# ─── Add Project Root to Python Path ───────────────────────────
BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.append(str(BASE_DIR))

# ─── Imports (After Path Fix) ───────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import recommendation
from app.services.ml_service import MLService
from app.core import dependencies


# ─── App Initialization ─────────────────────────────────────────
app = FastAPI(title="CINESPHERE API")


# ─── CORS Configuration ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routes ─────────────────────────────────────────────────────
app.include_router(
    recommendation.router,
    prefix="/api",
    tags=["Recommendation"],
)


# ─── Health Check ───────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok"}


# ─── Startup Event ──────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    dependencies.ml_service = MLService()
    print("ML Service initialized")