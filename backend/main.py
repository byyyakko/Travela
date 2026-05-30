"""FastAPI backend for Travela compatibility ranking — v2."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from psycopg2.extras import Json

from model_service import rank_candidates, recommend_by_category
from db import get_conn, put_conn
from middleware.auth import require_auth
from routers.ai import router as ai_router
from routers.webhooks import router as webhooks_router
from routers.utils import router as utils_router
from routers.auth_rate import router as auth_rate_router
from routers.moderation import router as moderation_router, ensure_moderation_tables
from routers.profiles import router as profiles_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_moderation_tables()
    yield

app = FastAPI(title="Travela Match API", version="2.0.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "https://travela.asherethankoh2103.workers.dev",
    "http://localhost:8080",
    "http://localhost:5173",
    "capacitor://localhost",
    "https://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)
app.include_router(webhooks_router)
app.include_router(utils_router)
app.include_router(auth_rate_router)
app.include_router(moderation_router)
app.include_router(profiles_router)

MAX_CANDIDATES = 200


# ── Schemas ─────────────────────────────────────────────────────────────────

class Profile(BaseModel):
    user_id: Optional[str] = None
    display_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    interests: Optional[list[str]] = None
    bio: Optional[str] = None
    languages: Optional[list[str]] = None
    location: Optional[str] = None
    is_local: Optional[bool] = None
    is_verified: Optional[bool] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = None


class RankRequest(BaseModel):
    user: Profile
    candidates: list[Profile]
    same_gender_only: bool = False


class RecommendRequest(BaseModel):
    user: Profile
    candidates: list[Profile]
    category_filter: Optional[str] = None
    limit: int = 50
    same_gender_only: bool = False


class AnalyticsEvent(BaseModel):
    event_type: str
    page: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    event_data: Optional[dict] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

_FILTERABLE_GENDERS = {"male", "female", "non_binary"}

def _apply_gender_filter(user: Profile, candidates: list[Profile]) -> list[Profile]:
    """Remove candidates whose gender differs from the user's.
    Candidates with no gender set or 'prefer_not_to_say' are always included.
    Filter is a no-op when user gender is unset or 'prefer_not_to_say'."""
    user_gender = user.gender
    if not user_gender or user_gender not in _FILTERABLE_GENDERS:
        return candidates
    return [c for c in candidates if not c.gender or c.gender not in _FILTERABLE_GENDERS or c.gender == user_gender]


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/rank")
def rank(req: RankRequest, _: str = Depends(require_auth)):
    """Rank candidates by compatibility with the user. Returns match_score and matched_interests."""
    if len(req.candidates) > MAX_CANDIDATES:
        raise HTTPException(status_code=422, detail=f"Too many candidates: max {MAX_CANDIDATES}")
    candidates = req.candidates
    if req.same_gender_only:
        candidates = _apply_gender_filter(req.user, candidates)
    user_dict = req.user.model_dump()
    candidate_dicts = [c.model_dump() for c in candidates]
    try:
        ranked = rank_candidates(user_dict, candidate_dicts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ranking failed: {e}")
    return {"ranked": ranked}


@app.post("/recommend")
def recommend(req: RecommendRequest, _: str = Depends(require_auth)):
    """Filter candidates by gender and/or interest category, then rank."""
    if len(req.candidates) > MAX_CANDIDATES:
        raise HTTPException(status_code=422, detail=f"Too many candidates: max {MAX_CANDIDATES}")
    candidates = req.candidates
    if req.same_gender_only:
        candidates = _apply_gender_filter(req.user, candidates)
    user_dict = req.user.model_dump()
    candidate_dicts = [c.model_dump() for c in candidates]
    try:
        ranked = recommend_by_category(user_dict, candidate_dicts, req.category_filter)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {e}")
    return {"ranked": ranked[: req.limit]}


@app.post("/analytics")
def track_analytics(event: AnalyticsEvent):
    """Write an analytics event to Neon."""
    if not os.getenv("NEON_DATABASE_URL"):
        return {"status": "ok", "note": "neon not configured"}
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO public.analytics_events
                (user_id, event_type, event_data, page, session_id)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                event.user_id,
                event.event_type,
                Json(event.event_data or {}),
                event.page,
                event.session_id,
            ),
        )
        conn.commit()
    except Exception as e:
        print(f"[analytics] write failed: {e}")
    finally:
        if conn is not None:
            put_conn(conn)
    return {"status": "ok"}
