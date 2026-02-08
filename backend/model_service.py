"""Load the trained XGBoost model and score user pairs."""

import os
import numpy as np
import xgboost as xgb

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")

# Load model once at import time
_model = xgb.XGBClassifier()
_model.load_model(os.path.join(MODEL_DIR, "travel_buddy.json"))

with open(os.path.join(MODEL_DIR, "feature_names.txt")) as f:
    _feature_names = [line.strip() for line in f if line.strip()]


# Map Travela profile interests to the model's travel-style scores.
# Each interest keyword is assigned to one or more style categories.
INTEREST_MAP = {
    # adventure_score
    "hiking": "adventure", "surfing": "adventure", "sports": "adventure",
    "diving": "adventure", "climbing": "adventure", "cycling": "adventure",
    "running": "adventure", "fitness": "adventure", "outdoors": "adventure",
    "adventure": "adventure", "camping": "adventure", "skiing": "adventure",
    # cultural_score
    "museums": "cultural", "art": "cultural", "theater": "cultural",
    "history": "cultural", "architecture": "cultural", "temples": "cultural",
    "culture": "cultural", "heritage": "cultural", "literature": "cultural",
    # social_score
    "nightlife": "social", "clubbing": "social", "dining": "social",
    "concerts": "social", "parties": "social", "festivals": "social",
    "street food": "social", "food": "social", "cooking": "social",
    "local cuisine": "social", "tapas": "social", "ramen": "social",
    "hidden bars": "social", "sake": "social",
    # relaxed_score
    "reading": "relaxed", "yoga": "relaxed", "meditation": "relaxed",
    "movies": "relaxed", "photography": "relaxed", "music": "relaxed",
    "shopping": "relaxed", "wellness": "relaxed", "spa": "relaxed",
    "flamenco": "relaxed", "vinyl": "relaxed",
}


def _interests_to_scores(interests: list[str] | None) -> dict:
    """Convert a list of interest strings to adventure/cultural/social/relaxed scores (0-10)."""
    counts = {"adventure": 0, "cultural": 0, "social": 0, "relaxed": 0}
    total = 0

    for interest in (interests or []):
        key = interest.lower().strip()
        category = INTEREST_MAP.get(key)
        if category:
            counts[category] += 1
            total += 1

    if total == 0:
        return {
            "adventure_score": 5.0,
            "cultural_score": 5.0,
            "social_score": 5.0,
            "relaxed_score": 5.0,
        }

    # Scale to 0-10 based on proportion of interests in each category
    max_per = max(total, 1)
    return {
        "adventure_score": min(10, (counts["adventure"] / max_per) * 10 + 3),
        "cultural_score":  min(10, (counts["cultural"]  / max_per) * 10 + 3),
        "social_score":    min(10, (counts["social"]    / max_per) * 10 + 3),
        "relaxed_score":   min(10, (counts["relaxed"]   / max_per) * 10 + 3),
    }


def _calculate_age(date_of_birth: str | None) -> float:
    """Calculate age from ISO date string, default 25 if missing."""
    if not date_of_birth:
        return 25.0
    from datetime import date
    try:
        dob = date.fromisoformat(date_of_birth)
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return float(age)
    except (ValueError, TypeError):
        return 25.0


def _interest_overlap(a_interests: list[str] | None, b_interests: list[str] | None) -> float:
    """Compute interest overlap as a correlation-like score (-1 to 1)."""
    set_a = {i.lower().strip() for i in (a_interests or [])}
    set_b = {i.lower().strip() for i in (b_interests or [])}
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    # Map Jaccard (0-1) to correlation-like range (-1 to 1)
    return (intersection / union) * 2 - 1 if union > 0 else 0.0


def build_feature_vector(user: dict, candidate: dict) -> np.ndarray:
    """
    Build a feature vector for one (user, candidate) pair.
    Maps Travela profile fields to the 32 features the model expects.
    """
    user_scores = _interests_to_scores(user.get("interests"))
    cand_scores = _interests_to_scores(candidate.get("interests"))

    user_age = _calculate_age(user.get("date_of_birth"))
    cand_age = _calculate_age(candidate.get("date_of_birth"))

    interest_corr = _interest_overlap(user.get("interests"), candidate.get("interests"))

    # Build feature dict matching the 32 training features
    features = {
        # Demographics (use user's values as the "person" side)
        "age_filled": user_age,
        "gender_encoded": 0,        # gender not collected in Travela profiles
        "field_filled": 0,           # field not collected
        "race_filled": 0,            # race not collected

        # Travel style scores (user's own scores)
        "adventure_score": user_scores["adventure_score"],
        "cultural_score":  user_scores["cultural_score"],
        "social_score":    user_scores["social_score"],
        "relaxed_score":   user_scores["relaxed_score"],

        # Behavioral
        "exphappy_filled": 5.0,      # neutral default

        # Pairwise features
        "age_diff": abs(user_age - cand_age),
        "same_race": 0,              # not collected
        "interest_corr_filled": interest_corr,

        # Partner ratings — approximate from interest overlap & profile completeness
        # Higher overlap → higher perceived ratings
        "attractive_partner":        5 + interest_corr * 2,
        "sincere_partner":           5 + interest_corr * 2,
        "intelligence_partner":      5 + interest_corr * 1.5,
        "funny_partner":             5 + interest_corr * 1.5,
        "ambition_partner":          5 + interest_corr * 1,
        "shared_interests_partner":  5 + interest_corr * 3,

        # How partner rates user (symmetric approximation)
        "attractive_o":              5 + interest_corr * 2,
        "sinsere_o":                 5 + interest_corr * 2,
        "intelligence_o":            5 + interest_corr * 1.5,
        "funny_o":                   5 + interest_corr * 1.5,
        "ambitous_o":                5 + interest_corr * 1,
        "shared_interests_o":        5 + interest_corr * 3,

        # Preference features (neutral defaults)
        "attractive_important":      15.0,
        "sincere_important":         15.0,
        "intellicence_important":    15.0,
        "funny_important":           20.0,
        "ambtition_important":       10.0,
        "shared_interests_important": 15.0,

        # Like / guess (use interest overlap as proxy)
        "like": 5 + interest_corr * 3,
        "guess_prob_liked": 5 + interest_corr * 2,
    }

    # Build array in the exact feature order the model expects
    return np.array([features.get(f, 0.0) for f in _feature_names], dtype=np.float32)


def rank_candidates(user: dict, candidates: list[dict]) -> list[dict]:
    """
    Score each candidate against the user and return candidates
    sorted by match probability (highest first).
    """
    if not candidates:
        return []

    # Build feature matrix (one row per candidate)
    X = np.vstack([build_feature_vector(user, c) for c in candidates])

    # Predict match probabilities
    probabilities = _model.predict_proba(X)[:, 1]

    # Attach scores and sort
    scored = []
    for candidate, prob in zip(candidates, probabilities):
        scored.append({
            **candidate,
            "match_score": round(float(prob), 4),
        })

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored
