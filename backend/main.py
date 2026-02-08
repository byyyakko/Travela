"""FastAPI backend for Travela compatibility ranking."""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model_service import rank_candidates

app = FastAPI(title="Travela Match API", version="1.0.0")

# CORS — allow the frontend origin (Lovable preview + production)
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# -- Request / Response schemas --------------------------------------------

class Profile(BaseModel):
    user_id: str
    display_name: str | None = None
    date_of_birth: str | None = None
    interests: list[str] | None = None
    location: str | None = None
    bio: str | None = None
    is_local: bool | None = None
    is_verified: bool | None = None
    avatar_url: str | None = None

class RankRequest(BaseModel):
    user: Profile
    candidates: list[Profile]

class ScoredProfile(Profile):
    match_score: float

class RankResponse(BaseModel):
    ranked: list[ScoredProfile]


# -- Endpoints --------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/rank", response_model=RankResponse)
def rank(req: RankRequest):
    """
    Rank candidate profiles by compatibility with the requesting user.
    Returns candidates sorted by match_score (highest first).
    """
    if not req.candidates:
        return RankResponse(ranked=[])

    user_dict = req.user.model_dump()
    candidate_dicts = [c.model_dump() for c in req.candidates]

    try:
        ranked = rank_candidates(user_dict, candidate_dicts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ranking failed: {str(e)}")

    return RankResponse(ranked=ranked)
