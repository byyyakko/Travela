"""FastAPI backend for Travela compatibility ranking — v2."""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from model_service import rank_candidates, recommend_by_category
from supabase_client import get_supabase_own

app = FastAPI(title="Travela Match API", version="2.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


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


class RankRequest(BaseModel):
    user: Profile
    candidates: list[Profile]


class RecommendRequest(BaseModel):
    user: Profile
    candidates: list[Profile]
    category_filter: Optional[str] = None
    limit: int = 50


class AnalyticsEvent(BaseModel):
    event_type: str
    page: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    event_data: Optional[dict] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/rank")
def rank(req: RankRequest):
    """Rank candidates by compatibility with the user. Returns match_score and matched_interests."""
    user_dict = req.user.model_dump()
    candidate_dicts = [c.model_dump() for c in req.candidates]
    try:
        ranked = rank_candidates(user_dict, candidate_dicts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ranking failed: {e}")
    return {"ranked": ranked}


@app.post("/recommend")
def recommend(req: RecommendRequest):
    """Filter candidates by interest category then rank. Supports category_filter and limit."""
    user_dict = req.user.model_dump()
    candidate_dicts = [c.model_dump() for c in req.candidates]
    try:
        ranked = recommend_by_category(user_dict, candidate_dicts, req.category_filter)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {e}")
    return {"ranked": ranked[: req.limit]}


@app.post("/analytics")
def track_analytics(event: AnalyticsEvent):
    """Write an analytics event to the new Supabase project via service role key."""
    sb = get_supabase_own()
    if sb is None:
        return {"status": "ok", "note": "supabase not configured"}
    try:
        sb.table("analytics_events").insert({
            "user_id": event.user_id,
            "event_type": event.event_type,
            "event_data": event.event_data or {},
            "page": event.page,
            "session_id": event.session_id,
        }).execute()
    except Exception as e:
        # Non-fatal — analytics failures should never break the app
        print(f"[analytics] write failed: {e}")
    return {"status": "ok"}
