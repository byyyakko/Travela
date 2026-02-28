"""
model_service.py — Travela ML matching feature engineering v2.

12 interest categories, 55 features:
  - 17 user features  (5 profile + 12 category scores)
  - 17 candidate features (5 profile + 12 category scores)
  - 21 pairwise features (9 compatibility + 12 per-category overlaps)
"""

import os
import numpy as np
from datetime import date
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import xgboost as xgb

# ── Interest Taxonomy (12 categories) ──────────────────────────────────────

INTEREST_CATEGORIES: dict[str, list[str]] = {
    "cultural_heritage": [
        "museums", "history", "architecture", "temples", "heritage",
        "culture", "ancient sites", "ruins", "local culture", "historical",
        "monuments", "cathedrals", "castles", "palaces", "traditional",
        "art galleries", "colonial", "dynasties",
    ],
    "adventure_outdoor": [
        "hiking", "climbing", "camping", "diving", "skiing", "cycling",
        "surfing", "outdoors", "adventure", "rock climbing", "paragliding",
        "bungee jumping", "zip-lining", "trekking", "mountaineering",
        "caving", "rappelling",
    ],
    "food_culinary": [
        "street food", "local cuisine", "cooking", "fine dining",
        "food markets", "ramen", "tapas", "sake", "hidden bars",
        "food tours", "culinary", "restaurants", "coffee", "tea ceremonies",
        "food", "gastronomy", "wine", "craft beer", "food festival",
    ],
    "nature_wildlife": [
        "wildlife", "national parks", "forests", "birdwatching",
        "conservation", "safari", "nature", "jungle", "mountains",
        "waterfalls", "botanical gardens", "eco-tourism", "animal sanctuaries",
        "stargazing", "nature walks",
    ],
    "social_nightlife": [
        "nightlife", "clubbing", "concerts", "festivals", "parties",
        "bars", "live music", "social", "meetups", "pub crawls",
        "rooftop bars", "speakeasies",
    ],
    "arts_photography": [
        "photography", "art", "theater", "galleries", "music",
        "film", "vinyl", "street art", "opera", "dance",
        "crafts", "pottery", "design", "creative arts",
    ],
    "wellness_spiritual": [
        "yoga", "meditation", "pilgrimage", "shrines", "spa",
        "wellness", "retreat", "mindfulness", "spiritual", "ayurveda",
        "hot springs", "hammam", "detox", "reiki", "sound healing",
    ],
    "sports_fitness": [
        "sports", "running", "fitness", "martial arts", "gym",
        "swimming", "tennis", "volleyball", "football", "basketball",
        "crossfit", "triathlon", "cycling", "skateboarding",
    ],
    "beach_water": [
        "beach", "snorkeling", "sailing", "water sports", "scuba",
        "surfing", "kayaking", "paddleboarding", "island hopping",
        "diving", "yachting", "boat trips",
    ],
    "backpacking_budget": [
        "hostels", "budget travel", "off-the-beaten-path",
        "long-term travel", "hitchhiking", "backpacking", "couchsurfing",
        "digital nomad", "slow travel", "van life", "workaway",
    ],
    "luxury_travel": [
        "luxury hotels", "resorts", "fine dining", "vip experiences",
        "business class", "luxury", "five star", "spa resorts",
        "private tours", "yacht", "exclusive", "butler service",
    ],
    "volunteering_community": [
        "volunteering", "teaching", "conservation", "community service",
        "humanitarian", "ngo", "volunteer", "social work",
        "wildlife conservation", "teaching abroad", "community",
        "charity", "habitat for humanity",
    ],
}

CATEGORY_NAMES: list[str] = list(INTEREST_CATEGORIES.keys())

# ── Feature names (55 total) ────────────────────────────────────────────────

_USER_FEATURES = (
    ["user_age", "user_language_count", "user_bio_length",
     "user_profile_completeness", "user_is_verified"]
    + [f"user_{cat}" for cat in CATEGORY_NAMES]
)

_CAND_FEATURES = (
    ["cand_age", "cand_language_count", "cand_bio_length",
     "cand_profile_completeness", "cand_is_verified"]
    + [f"cand_{cat}" for cat in CATEGORY_NAMES]
)

_PAIR_FEATURES = (
    [
        "age_diff",
        "interest_overlap_jaccard",
        "interest_overlap_weighted",
        "shared_language_count",
        "has_shared_language",
        "bio_similarity",
        "same_city",
        "same_country",
        "niche_interest_bonus",
    ]
    + [f"category_overlap_{cat}" for cat in CATEGORY_NAMES]
)

FEATURE_NAMES_V2: list[str] = _USER_FEATURES + _CAND_FEATURES + _PAIR_FEATURES
# 17 + 17 + 21 = 55 features

# ── Model loading ───────────────────────────────────────────────────────────

_MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
_MODEL_V2 = os.path.join(_MODEL_DIR, "travel_buddy_v2.json")
_MODEL_V1 = os.path.join(_MODEL_DIR, "travel_buddy.json")

model = xgb.XGBClassifier()
if os.path.exists(_MODEL_V2):
    model.load_model(_MODEL_V2)
else:
    model.load_model(_MODEL_V1)


# ── Helper: interest normalisation ─────────────────────────────────────────

def _norm(interest: str) -> str:
    return interest.strip().lower()


def _kw_match(interest_norm: str, keywords: list[str]) -> bool:
    return any(kw in interest_norm or interest_norm in kw for kw in keywords)


# ── Core feature functions ──────────────────────────────────────────────────

def interests_to_scores(interests: list[str] | None) -> dict[str, float]:
    """Map a list of user interests to 12 category scores (0–10)."""
    if not interests:
        return {cat: 5.0 for cat in CATEGORY_NAMES}

    normed = [_norm(i) for i in interests]
    total = len(normed)

    scores: dict[str, float] = {}
    for cat, keywords in INTEREST_CATEGORIES.items():
        count = sum(1 for i in normed if _kw_match(i, keywords))
        scores[cat] = min(10.0, (count / total) * 10 + 3) if total else 5.0

    return scores


def _calculate_age(dob: str | None) -> float:
    if not dob:
        return 25.0
    try:
        parts = dob.split("-")
        born = date(int(parts[0]), int(parts[1]), int(parts[2]))
        today = date.today()
        return float(
            today.year - born.year
            - ((today.month, today.day) < (born.month, born.day))
        )
    except Exception:
        return 25.0


def _jaccard(a: list[str] | None, b: list[str] | None) -> float:
    if not a or not b:
        return 0.0
    sa = {_norm(i) for i in a}
    sb = {_norm(i) for i in b}
    union = sa | sb
    return len(sa & sb) / len(union) if union else 0.0


def _weighted_overlap(
    user_interests: list[str] | None,
    cand_interests: list[str] | None,
    user_scores: dict[str, float],
) -> float:
    base = _jaccard(user_interests, cand_interests)
    top_score = max(user_scores.values()) if user_scores else 5.0
    weight = top_score / 10.0
    return min(1.0, base * (1.0 + weight))


def _language_features(
    user_langs: list[str] | None,
    cand_langs: list[str] | None,
) -> tuple[float, float]:
    if not user_langs or not cand_langs:
        return 0.0, 0.0
    ul = {l.strip().lower() for l in user_langs}
    cl = {l.strip().lower() for l in cand_langs}
    shared = ul & cl
    return float(len(shared)), float(1.0 if shared else 0.0)


def _bio_similarity(bio_a: str | None, bio_b: str | None) -> float:
    if not bio_a or not bio_b or len(bio_a) < 5 or len(bio_b) < 5:
        return 0.0
    try:
        vec = TfidfVectorizer(stop_words="english", max_features=200)
        mat = vec.fit_transform([bio_a, bio_b])
        score = cosine_similarity(mat[0:1], mat[1:2])[0][0]
        return float(max(0.0, score))
    except Exception:
        return 0.0


def _location_features(
    loc_a: str | None,
    loc_b: str | None,
) -> tuple[float, float]:
    if not loc_a or not loc_b:
        return 0.0, 0.0
    a = loc_a.strip().lower()
    b = loc_b.strip().lower()
    if a == b:
        return 1.0, 1.0
    a_parts = [p.strip() for p in a.split(",")]
    b_parts = [p.strip() for p in b.split(",")]
    same_country = float(a_parts[-1] == b_parts[-1])
    return 0.0, same_country


def _niche_bonus(
    user_interests: list[str] | None,
    cand_interests: list[str] | None,
) -> float:
    if not user_interests or not cand_interests:
        return 0.0
    shared = {_norm(i) for i in user_interests} & {_norm(i) for i in cand_interests}
    return min(1.0, len(shared) * 0.15)


def _profile_completeness(profile: dict) -> float:
    score = 0.0
    if profile.get("bio"):
        score += 0.25
    if profile.get("interests"):
        score += 0.25
    if profile.get("languages"):
        score += 0.20
    if profile.get("date_of_birth"):
        score += 0.15
    if profile.get("location"):
        score += 0.15
    return score


def _category_overlaps(
    user_interests: list[str] | None,
    cand_interests: list[str] | None,
) -> dict[str, float]:
    result: dict[str, float] = {}
    for cat, keywords in INTEREST_CATEGORIES.items():
        u_has = any(_kw_match(_norm(i), keywords) for i in (user_interests or []))
        c_has = any(_kw_match(_norm(i), keywords) for i in (cand_interests or []))
        result[cat] = 1.0 if (u_has and c_has) else 0.0
    return result


# ── Feature vector ──────────────────────────────────────────────────────────

def build_feature_vector(user: dict, candidate: dict) -> np.ndarray:
    """Build a 55-element feature vector for a user–candidate pair."""
    u_scores = interests_to_scores(user.get("interests"))
    c_scores = interests_to_scores(candidate.get("interests"))
    u_age = _calculate_age(user.get("date_of_birth"))
    c_age = _calculate_age(candidate.get("date_of_birth"))
    shared_lang_count, has_shared_lang = _language_features(
        user.get("languages"), candidate.get("languages")
    )
    bio_sim = _bio_similarity(user.get("bio"), candidate.get("bio"))
    same_city, same_country = _location_features(
        user.get("location"), candidate.get("location")
    )
    niche = _niche_bonus(user.get("interests"), candidate.get("interests"))
    cat_overlaps = _category_overlaps(
        user.get("interests"), candidate.get("interests")
    )

    user_vec = [
        u_age,
        float(len(user.get("languages") or [])),
        float(len(user.get("bio") or "")),
        _profile_completeness(user),
        float(1.0 if user.get("is_verified") else 0.0),
    ] + [u_scores[cat] for cat in CATEGORY_NAMES]

    cand_vec = [
        c_age,
        float(len(candidate.get("languages") or [])),
        float(len(candidate.get("bio") or "")),
        _profile_completeness(candidate),
        float(1.0 if candidate.get("is_verified") else 0.0),
    ] + [c_scores[cat] for cat in CATEGORY_NAMES]

    pair_vec = [
        abs(u_age - c_age),
        _jaccard(user.get("interests"), candidate.get("interests")),
        _weighted_overlap(user.get("interests"), candidate.get("interests"), u_scores),
        shared_lang_count,
        has_shared_lang,
        bio_sim,
        same_city,
        same_country,
        niche,
    ] + [cat_overlaps[cat] for cat in CATEGORY_NAMES]

    return np.array(user_vec + cand_vec + pair_vec, dtype=np.float32)


# ── Match reason extraction ─────────────────────────────────────────────────

def extract_match_reasons(user: dict, candidate: dict) -> list[str]:
    """Return up to 5 human-readable shared traits between user and candidate."""
    reasons: list[str] = []

    # Shared raw interests
    ui = {_norm(i) for i in (user.get("interests") or [])}
    ci = {_norm(i) for i in (candidate.get("interests") or [])}
    for interest in sorted(ui & ci)[:3]:
        reasons.append(interest.title())

    # Shared interest categories
    cat_overlaps = _category_overlaps(
        user.get("interests"), candidate.get("interests")
    )
    for cat, val in cat_overlaps.items():
        if val == 1.0 and len(reasons) < 4:
            label = cat.replace("_", " ").title()
            entry = f"Both love {label}"
            if entry not in reasons:
                reasons.append(entry)

    # Shared language
    ul = {l.strip().lower() for l in (user.get("languages") or [])}
    cl = {l.strip().lower() for l in (candidate.get("languages") or [])}
    for lang in sorted(ul & cl):
        if len(reasons) < 5:
            reasons.append(f"Speaks {lang.title()}")

    # Same city
    if user.get("location") and candidate.get("location"):
        if user["location"].strip().lower() == candidate["location"].strip().lower():
            if len(reasons) < 5:
                reasons.append(f"Based in {candidate['location']}")

    return reasons[:5]


# ── Ranking ─────────────────────────────────────────────────────────────────

def rank_candidates(user: dict, candidates: list[dict]) -> list[dict]:
    """Score and sort candidates by XGBoost match probability."""
    if not candidates:
        return []
    X = np.vstack([build_feature_vector(user, c) for c in candidates])
    probs = model.predict_proba(X)[:, 1]
    scored = [
        {
            **c,
            "match_score": round(float(p), 4),
            "matched_interests": extract_match_reasons(user, c),
        }
        for c, p in zip(candidates, probs)
    ]
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored


def recommend_by_category(
    user: dict,
    candidates: list[dict],
    category_filter: str | None = None,
) -> list[dict]:
    """Filter candidates by interest category then rank."""
    if category_filter and category_filter in INTEREST_CATEGORIES:
        keywords = INTEREST_CATEGORIES[category_filter]
        filtered = [
            c for c in candidates
            if any(
                _kw_match(_norm(i), keywords)
                for i in (c.get("interests") or [])
            )
        ]
        candidates = filtered or candidates  # fallback to all if none matched
    return rank_candidates(user, candidates)
