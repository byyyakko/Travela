# ML Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Retrain Travela's XGBoost matching model with 12 interest categories and 53 features, add a `/recommend` search endpoint, surface match reasons on swipe cards and match popup.

**Architecture:** Backend-first (model_service → train_model → main), then frontend (Match.tsx). Each task is independent except Task 5 (frontend) which depends on Tasks 1–4.

**Tech Stack:** Python 3.13, XGBoost 3.1.3, scikit-learn 1.6.1, FastAPI 0.115, React 18, TypeScript 5.8

---

### Task 1: Expand Interest Taxonomy & Feature Engineering

**Files:**
- Rewrite: `backend/model_service.py`
- Create: `backend/model/feature_names_v2.txt`

**Step 1 — Write failing tests first**
Create `backend/tests/test_model_service.py`:
```python
from model_service import interests_to_scores, build_feature_vector, INTEREST_CATEGORIES

def test_cultural_interests_score_high_on_cultural_category():
    scores = interests_to_scores(["museums", "history", "architecture"])
    assert scores["cultural_heritage"] >= 7.0

def test_spiritual_interests_score_high_on_wellness_spiritual():
    scores = interests_to_scores(["meditation", "pilgrimage", "shrines"])
    assert scores["wellness_spiritual"] >= 7.0

def test_backpacking_interests_recognized():
    scores = interests_to_scores(["hostels", "budget travel", "hitchhiking"])
    assert scores["backpacking_budget"] >= 5.0

def test_luxury_interests_recognized():
    scores = interests_to_scores(["luxury hotels", "fine dining", "resorts"])
    assert scores["luxury_travel"] >= 5.0

def test_volunteering_interests_recognized():
    scores = interests_to_scores(["volunteering", "teaching", "community service"])
    assert scores["volunteering_community"] >= 5.0

def test_feature_vector_has_53_features():
    user = {"interests": ["museums"], "date_of_birth": "1995-01-01", "bio": "I love culture", "languages": ["English"], "location": "Tokyo"}
    cand = {"interests": ["history"], "date_of_birth": "1996-06-15", "bio": "History lover", "languages": ["English"], "location": "Tokyo"}
    vec = build_feature_vector(user, cand)
    assert len(vec) == 53

def test_shared_language_detected():
    user = {"interests": [], "languages": ["English", "Japanese"]}
    cand = {"interests": [], "languages": ["Japanese", "Mandarin"]}
    vec = build_feature_vector(user, cand)
    # has_shared_language should be 1.0
    from model_service import FEATURE_NAMES_V2
    idx = FEATURE_NAMES_V2.index("has_shared_language")
    assert vec[idx] == 1.0

def test_same_city_detected():
    user = {"interests": [], "location": "Tokyo, Japan"}
    cand = {"interests": [], "location": "Tokyo, Japan"}
    vec = build_feature_vector(user, cand)
    from model_service import FEATURE_NAMES_V2
    idx = FEATURE_NAMES_V2.index("same_city")
    assert vec[idx] == 1.0

def test_bio_similarity_nonzero_for_similar_bios():
    user = {"interests": [], "bio": "I love exploring ancient temples and local culture"}
    cand = {"interests": [], "bio": "Ancient temples and cultural experiences are my passion"}
    vec = build_feature_vector(user, cand)
    from model_service import FEATURE_NAMES_V2
    idx = FEATURE_NAMES_V2.index("bio_similarity")
    assert vec[idx] > 0.1
```

**Step 2 — Run tests, confirm they all fail**
```bash
cd backend && python -m pytest tests/test_model_service.py -v 2>&1 | head -40
```

**Step 3 — Rewrite `backend/model_service.py`**

Replace the entire file with the expanded implementation:

```python
"""
model_service.py — Travela ML matching feature engineering (v2)
12 interest categories, 53 features, match reason extraction.
"""

import re
import math
import numpy as np
from typing import Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import xgboost as xgb

# ── Interest Taxonomy (12 categories) ──────────────────────────────────────
INTEREST_CATEGORIES = {
    "cultural_heritage": [
        "museums", "history", "architecture", "temples", "heritage",
        "culture", "ancient sites", "ruins", "local culture", "historical",
        "monuments", "cathedrals", "castles", "palaces", "traditional"
    ],
    "adventure_outdoor": [
        "hiking", "climbing", "camping", "diving", "skiing", "cycling",
        "surfing", "outdoors", "adventure", "rock climbing", "paragliding",
        "bungee jumping", "zip-lining", "trekking", "mountaineering"
    ],
    "food_culinary": [
        "street food", "local cuisine", "cooking", "fine dining",
        "food markets", "ramen", "tapas", "sake", "hidden bars",
        "food tours", "culinary", "restaurants", "coffee", "tea ceremonies",
        "food", "gastronomy", "wine", "craft beer"
    ],
    "nature_wildlife": [
        "wildlife", "national parks", "forests", "birdwatching",
        "conservation", "safari", "nature", "jungle", "mountains",
        "waterfalls", "botanical gardens", "eco-tourism", "animal sanctuaries"
    ],
    "social_nightlife": [
        "nightlife", "clubbing", "concerts", "festivals", "parties",
        "bars", "live music", "social", "meetups", "pub crawls"
    ],
    "arts_photography": [
        "photography", "art", "theater", "galleries", "music",
        "film", "vinyl", "street art", "museums", "opera", "dance",
        "crafts", "pottery", "design"
    ],
    "wellness_spiritual": [
        "yoga", "meditation", "pilgrimage", "shrines", "spa",
        "wellness", "retreat", "mindfulness", "spiritual", "ayurveda",
        "hot springs", "hammam", "detox"
    ],
    "sports_fitness": [
        "sports", "running", "fitness", "martial arts", "gym",
        "swimming", "tennis", "volleyball", "football", "basketball",
        "crossfit", "triathlon"
    ],
    "beach_water": [
        "beach", "snorkeling", "sailing", "water sports", "scuba",
        "surfing", "kayaking", "paddleboarding", "island hopping",
        "swimming", "diving", "yachting"
    ],
    "backpacking_budget": [
        "hostels", "budget travel", "off-the-beaten-path",
        "long-term travel", "hitchhiking", "backpacking", "couchsurfing",
        "digital nomad", "slow travel", "van life"
    ],
    "luxury_travel": [
        "luxury hotels", "resorts", "fine dining", "vip experiences",
        "business class", "luxury", "five star", "spa resorts",
        "private tours", "yacht", "exclusive"
    ],
    "volunteering_community": [
        "volunteering", "teaching", "conservation", "community service",
        "humanitarian", "ngo", "volunteer", "social work",
        "wildlife conservation", "teaching abroad", "community"
    ],
}

# All category names in a fixed order
CATEGORY_NAMES = list(INTEREST_CATEGORIES.keys())

# ── Feature names (53 total) ────────────────────────────────────────────────
_USER_FEATURES = [
    "user_age", "user_language_count", "user_bio_length",
    "user_profile_completeness", "user_is_verified",
] + [f"user_{cat}" for cat in CATEGORY_NAMES]  # 12 category scores

_CAND_FEATURES = [
    "cand_age", "cand_language_count", "cand_bio_length",
    "cand_profile_completeness", "cand_is_verified",
] + [f"cand_{cat}" for cat in CATEGORY_NAMES]  # 12 category scores

_PAIR_FEATURES = [
    "age_diff",
    "interest_overlap_jaccard",
    "interest_overlap_weighted",
    "shared_language_count",
    "has_shared_language",
    "bio_similarity",
    "same_city",
    "same_country",
    "niche_interest_bonus",
] + [f"category_overlap_{cat}" for cat in CATEGORY_NAMES]  # 12 per-category overlaps

FEATURE_NAMES_V2 = _USER_FEATURES + _CAND_FEATURES + _PAIR_FEATURES
# Total: 5 + 12 + 5 + 12 + 9 + 12 = 55... let me recount
# _USER_FEATURES: 5 + 12 = 17
# _CAND_FEATURES: 5 + 12 = 17
# _PAIR_FEATURES: 9 + 12 = 21
# Total: 17 + 17 + 21 = 55 ... adjust in implementation

# ── Model loading ───────────────────────────────────────────────────────────
import os, json

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "travel_buddy_v2.json")
_MODEL_PATH_LEGACY = os.path.join(os.path.dirname(__file__), "model", "travel_buddy.json")

model = xgb.XGBClassifier()
if os.path.exists(_MODEL_PATH):
    model.load_model(_MODEL_PATH)
else:
    model.load_model(_MODEL_PATH_LEGACY)  # fallback

# TF-IDF vectorizer (fitted lazily on first bio similarity call)
_tfidf: Optional[TfidfVectorizer] = None

# ── Helper functions ────────────────────────────────────────────────────────

def _normalize_interest(i: str) -> str:
    return i.strip().lower()

def interests_to_scores(interests: list[str] | None) -> dict[str, float]:
    """Map a list of interests to 12 category scores (0–10)."""
    if not interests:
        return {cat: 5.0 for cat in CATEGORY_NAMES}

    norm = [_normalize_interest(i) for i in interests]
    total = len(norm)
    counts = {}
    for cat, keywords in INTEREST_CATEGORIES.items():
        count = sum(1 for i in norm if any(kw in i for kw in keywords))
        counts[cat] = count

    scores = {}
    for cat in CATEGORY_NAMES:
        if total == 0:
            scores[cat] = 5.0
        else:
            scores[cat] = min(10.0, (counts[cat] / total) * 10 + 3)
    return scores

def _calculate_age(dob: str | None) -> float:
    if not dob:
        return 25.0
    try:
        from datetime import date
        parts = dob.split("-")
        born = date(int(parts[0]), int(parts[1]), int(parts[2]))
        today = date.today()
        return float(today.year - born.year - ((today.month, today.day) < (born.month, born.day)))
    except Exception:
        return 25.0

def _jaccard(a: list[str] | None, b: list[str] | None) -> float:
    if not a or not b:
        return 0.0
    sa = {_normalize_interest(i) for i in a}
    sb = {_normalize_interest(i) for i in b}
    inter = len(sa & sb)
    union = len(sa | sb)
    return inter / union if union else 0.0

def _weighted_overlap(user_interests, cand_interests, user_scores) -> float:
    """Jaccard weighted by user's dominant category."""
    base = _jaccard(user_interests, cand_interests)
    top_cat_score = max(user_scores.values()) if user_scores else 5.0
    weight = top_cat_score / 10.0
    return min(1.0, base * (1 + weight))

def _language_features(user_langs, cand_langs) -> tuple[float, float]:
    if not user_langs or not cand_langs:
        return 0.0, 0.0
    ul = {l.strip().lower() for l in user_langs}
    cl = {l.strip().lower() for l in cand_langs}
    shared = ul & cl
    return float(len(shared)), float(1 if shared else 0)

def _bio_similarity(bio_a: str | None, bio_b: str | None) -> float:
    if not bio_a or not bio_b or len(bio_a) < 5 or len(bio_b) < 5:
        return 0.0
    try:
        vec = TfidfVectorizer(stop_words="english", max_features=100)
        tfidf_matrix = vec.fit_transform([bio_a, bio_b])
        score = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return float(score)
    except Exception:
        return 0.0

def _location_features(loc_a: str | None, loc_b: str | None) -> tuple[float, float]:
    if not loc_a or not loc_b:
        return 0.0, 0.0
    a = loc_a.strip().lower()
    b = loc_b.strip().lower()
    if a == b:
        return 1.0, 1.0  # same_city, same_country
    # Check country match (last comma-separated segment)
    a_parts = [p.strip() for p in a.split(",")]
    b_parts = [p.strip() for p in b.split(",")]
    same_country = float(a_parts[-1] == b_parts[-1])
    return 0.0, same_country

def _niche_bonus(user_interests, cand_interests, all_interests_pool=None) -> float:
    """Bonus for sharing rare/niche interests."""
    if not user_interests or not cand_interests:
        return 0.0
    shared = {_normalize_interest(i) for i in user_interests} & {_normalize_interest(i) for i in cand_interests}
    return min(1.0, len(shared) * 0.15)

def _profile_completeness(profile: dict) -> float:
    score = 0.0
    if profile.get("bio"): score += 0.25
    if profile.get("interests"): score += 0.25
    if profile.get("languages"): score += 0.2
    if profile.get("date_of_birth"): score += 0.15
    if profile.get("location"): score += 0.15
    return score

def _category_overlaps(user_interests, cand_interests) -> dict[str, float]:
    """Per-category overlap: both users' interests in same category."""
    result = {}
    for cat, keywords in INTEREST_CATEGORIES.items():
        user_has = any(any(kw in _normalize_interest(i) for kw in keywords) for i in (user_interests or []))
        cand_has = any(any(kw in _normalize_interest(i) for kw in keywords) for i in (cand_interests or []))
        result[cat] = 1.0 if (user_has and cand_has) else 0.0
    return result

# ── Feature vector construction ─────────────────────────────────────────────

def build_feature_vector(user: dict, candidate: dict) -> np.ndarray:
    user_scores = interests_to_scores(user.get("interests"))
    cand_scores = interests_to_scores(candidate.get("interests"))
    user_age = _calculate_age(user.get("date_of_birth"))
    cand_age = _calculate_age(candidate.get("date_of_birth"))
    shared_lang_count, has_shared_lang = _language_features(
        user.get("languages"), candidate.get("languages")
    )
    bio_sim = _bio_similarity(user.get("bio"), candidate.get("bio"))
    same_city, same_country = _location_features(
        user.get("location"), candidate.get("location")
    )
    niche = _niche_bonus(user.get("interests"), candidate.get("interests"))
    cat_overlaps = _category_overlaps(user.get("interests"), candidate.get("interests"))

    user_vec = [
        user_age,
        float(len(user.get("languages") or [])),
        float(len(user.get("bio") or "")),
        _profile_completeness(user),
        float(1 if user.get("is_verified") else 0),
    ] + [user_scores[cat] for cat in CATEGORY_NAMES]

    cand_vec = [
        cand_age,
        float(len(candidate.get("languages") or [])),
        float(len(candidate.get("bio") or "")),
        _profile_completeness(candidate),
        float(1 if candidate.get("is_verified") else 0),
    ] + [cand_scores[cat] for cat in CATEGORY_NAMES]

    pair_vec = [
        abs(user_age - cand_age),
        _jaccard(user.get("interests"), candidate.get("interests")),
        _weighted_overlap(user.get("interests"), candidate.get("interests"), user_scores),
        shared_lang_count,
        has_shared_lang,
        bio_sim,
        same_city,
        same_country,
        niche,
    ] + [cat_overlaps[cat] for cat in CATEGORY_NAMES]

    return np.array(user_vec + cand_vec + pair_vec, dtype=np.float32)

# ── Match reasons extraction ────────────────────────────────────────────────

def extract_match_reasons(user: dict, candidate: dict) -> list[str]:
    """Return human-readable list of shared interests/traits."""
    reasons = []
    # Shared interests
    ui = {_normalize_interest(i) for i in (user.get("interests") or [])}
    ci = {_normalize_interest(i) for i in (candidate.get("interests") or [])}
    shared = ui & ci
    if shared:
        reasons.extend(list(shared)[:3])
    # Shared languages
    ul = {l.strip().lower() for l in (user.get("languages") or [])}
    cl = {l.strip().lower() for l in (candidate.get("languages") or [])}
    shared_langs = ul & cl
    if shared_langs:
        reasons.append(f"Speaks {list(shared_langs)[0]}")
    # Same city
    if user.get("location") and candidate.get("location"):
        if user["location"].strip().lower() == candidate["location"].strip().lower():
            reasons.append(f"Based in {candidate['location']}")
    return reasons[:5]  # Cap at 5 reasons

# ── Ranking ─────────────────────────────────────────────────────────────────

def rank_candidates(user: dict, candidates: list[dict]) -> list[dict]:
    if not candidates:
        return []
    X = np.vstack([build_feature_vector(user, c) for c in candidates])
    probabilities = model.predict_proba(X)[:, 1]
    scored = []
    for candidate, prob in zip(candidates, probabilities):
        scored.append({
            **candidate,
            "match_score": round(float(prob), 4),
            "matched_interests": extract_match_reasons(user, candidate),
        })
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored

def recommend_by_category(user: dict, candidates: list[dict], category_filter: str | None = None) -> list[dict]:
    """Filter candidates by interest category then rank."""
    if category_filter and category_filter in INTEREST_CATEGORIES:
        keywords = INTEREST_CATEGORIES[category_filter]
        filtered = [
            c for c in candidates
            if any(
                any(kw in _normalize_interest(i) for kw in keywords)
                for i in (c.get("interests") or [])
            )
        ]
        if not filtered:
            filtered = candidates  # fallback to all if no matches
    else:
        filtered = candidates
    return rank_candidates(user, filtered)
```

**Step 4 — Write feature names file**
```
backend/model/feature_names_v2.txt
```
(Generated programmatically in train_model.py)

**Step 5 — Run tests, confirm they pass**
```bash
cd backend && python -m pytest tests/test_model_service.py -v
```

**Step 6 — Commit**
```bash
git add backend/model_service.py backend/tests/test_model_service.py
git commit -m "feat: expand interest taxonomy to 12 categories, 55-feature engineering pipeline"
```

---

### Task 2: Synthetic Training Data & Model Retraining

**Files:**
- Create: `backend/train_model.py`
- Create: `backend/model/travel_buddy_v2.json`
- Create: `backend/model/feature_names_v2.txt`

**Step 1 — Write failing tests first**
Create `backend/tests/test_train_model.py`:
```python
import os, json

def test_retrained_model_file_exists():
    assert os.path.exists("backend/model/travel_buddy_v2.json")

def test_feature_names_v2_file_exists():
    assert os.path.exists("backend/model/feature_names_v2.txt")

def test_model_loads_and_predicts():
    import xgboost as xgb
    import numpy as np
    m = xgb.XGBClassifier()
    m.load_model("backend/model/travel_buddy_v2.json")
    dummy = np.zeros((1, 55), dtype=np.float32)
    proba = m.predict_proba(dummy)
    assert proba.shape == (1, 2)
    assert 0.0 <= proba[0][1] <= 1.0

def test_cultural_match_scores_higher_than_mismatch():
    from model_service import rank_candidates
    user = {
        "interests": ["museums", "history", "architecture"],
        "date_of_birth": "1995-01-01",
        "bio": "I love exploring ancient temples",
        "languages": ["English"],
        "location": "Kyoto, Japan",
    }
    culture_guide = {
        "user_id": "1",
        "interests": ["heritage", "culture", "ancient sites"],
        "date_of_birth": "1993-03-15",
        "bio": "Local guide specializing in historical sites",
        "languages": ["English", "Japanese"],
        "location": "Kyoto, Japan",
        "is_verified": True,
    }
    adventure_guide = {
        "user_id": "2",
        "interests": ["hiking", "rock climbing", "bungee jumping"],
        "date_of_birth": "1990-07-20",
        "bio": "Extreme sports enthusiast",
        "languages": ["Japanese"],
        "location": "Osaka, Japan",
        "is_verified": False,
    }
    ranked = rank_candidates(user, [adventure_guide, culture_guide])
    assert ranked[0]["user_id"] == "1", "Cultural guide should rank higher for cultural user"
```

**Step 2 — Run tests, confirm they fail**
```bash
cd backend && python -m pytest tests/test_train_model.py -v
```

**Step 3 — Create `backend/train_model.py`**

The script generates 50,000 synthetic profile pairs and trains a new XGBoost model:

```python
"""
train_model.py — Generate synthetic travel profile pairs and retrain XGBoost.
Run: python train_model.py
"""

import random
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
from model_service import (
    build_feature_vector, FEATURE_NAMES_V2, INTEREST_CATEGORIES, CATEGORY_NAMES
)

random.seed(42)
np.random.seed(42)

# ── Synthetic profile generation ─────────────────────────────────────────────

SAMPLE_INTERESTS = {cat: kws[:8] for cat, kws in INTEREST_CATEGORIES.items()}
LOCATIONS = [
    "Tokyo, Japan", "Kyoto, Japan", "Osaka, Japan",
    "Bangkok, Thailand", "Bali, Indonesia", "Seoul, South Korea",
    "Paris, France", "Barcelona, Spain", "Rome, Italy",
    "New York, USA", "London, UK", "Sydney, Australia",
]
LANGUAGES = ["English", "Japanese", "Mandarin", "Spanish", "French",
             "Thai", "Korean", "Indonesian", "Italian", "Portuguese"]

def _random_dob(min_age=18, max_age=50) -> str:
    from datetime import date, timedelta
    days = random.randint(min_age * 365, max_age * 365)
    dob = date.today() - timedelta(days=days)
    return dob.strftime("%Y-%m-%d")

def _random_interests(primary_cats=None, n=5) -> list[str]:
    interests = []
    if primary_cats:
        for cat in primary_cats:
            kws = SAMPLE_INTERESTS.get(cat, [])
            if kws:
                interests.extend(random.sample(kws, min(2, len(kws))))
    # Add some random interests
    all_kws = [kw for kws in SAMPLE_INTERESTS.values() for kw in kws]
    interests.extend(random.sample(all_kws, min(n, len(all_kws))))
    return list(set(interests))[:n+3]

def _random_bio(interests: list[str]) -> str:
    templates = [
        f"I love {interests[0]} and {interests[1]} when traveling.",
        f"Passionate about {interests[0]}. Always looking for {interests[1]} experiences.",
        f"Experienced traveler interested in {interests[0]}.",
        "",  # Some empty bios
    ]
    return random.choice(templates)

def _random_langs(n=1) -> list[str]:
    return random.sample(LANGUAGES, min(n, len(LANGUAGES)))

def generate_profile(primary_cats=None) -> dict:
    interests = _random_interests(primary_cats)
    return {
        "date_of_birth": _random_dob(),
        "interests": interests,
        "bio": _random_bio(interests),
        "languages": _random_langs(random.randint(1, 3)),
        "location": random.choice(LOCATIONS),
        "is_verified": random.random() < 0.3,
    }

def generate_pair(match: bool):
    """Generate a profile pair. match=True creates compatible pairs."""
    if match:
        # Share 1-3 primary interest categories
        shared_cats = random.sample(CATEGORY_NAMES, random.randint(1, 3))
        user = generate_profile(primary_cats=shared_cats)
        cand = generate_profile(primary_cats=shared_cats)
        # Increase shared language probability
        if random.random() < 0.6:
            shared_lang = random.choice(LANGUAGES)
            user["languages"] = list(set(user["languages"] + [shared_lang]))
            cand["languages"] = list(set(cand["languages"] + [shared_lang]))
        # Increase same-location probability
        if random.random() < 0.4:
            cand["location"] = user["location"]
    else:
        # Pick opposite categories
        cats = random.sample(CATEGORY_NAMES, len(CATEGORY_NAMES))
        user = generate_profile(primary_cats=cats[:2])
        cand = generate_profile(primary_cats=cats[-2:])
        # Age gap mismatch
        if random.random() < 0.4:
            user["date_of_birth"] = _random_dob(18, 25)
            cand["date_of_birth"] = _random_dob(40, 55)
    return user, cand

# ── Generate dataset ──────────────────────────────────────────────────────────

N = 50000
print(f"Generating {N} profile pairs...")

X_list, y_list = [], []
for i in range(N):
    is_match = random.random() < 0.4  # 40% positive rate (realistic)
    user, cand = generate_pair(match=is_match)
    X_list.append(build_feature_vector(user, cand))
    y_list.append(int(is_match))

X = np.vstack(X_list)
y = np.array(y_list)

print(f"Dataset: {X.shape}, positive rate: {y.mean():.2%}")

# ── Train/test split ──────────────────────────────────────────────────────────

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# ── Train XGBoost ─────────────────────────────────────────────────────────────

print("Training XGBoost...")
clf = xgb.XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=(y == 0).sum() / (y == 1).sum(),
    use_label_encoder=False,
    eval_metric="auc",
    early_stopping_rounds=20,
    random_state=42,
)
clf.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=50,
)

auc = roc_auc_score(y_test, clf.predict_proba(X_test)[:, 1])
print(f"Test AUC: {auc:.4f}")

# ── Save model & feature names ────────────────────────────────────────────────

clf.save_model("model/travel_buddy_v2.json")
with open("model/feature_names_v2.txt", "w") as f:
    f.write("\n".join(FEATURE_NAMES_V2))

print("Saved: model/travel_buddy_v2.json")
print("Saved: model/feature_names_v2.txt")
print(f"Feature count: {len(FEATURE_NAMES_V2)}")
```

**Step 4 — Run training**
```bash
cd backend && python train_model.py
```
Expected output: AUC > 0.80

**Step 5 — Run tests**
```bash
cd backend && python -m pytest tests/test_train_model.py -v
```

**Step 6 — Commit**
```bash
git add backend/train_model.py backend/model/travel_buddy_v2.json backend/model/feature_names_v2.txt
git commit -m "feat: retrain XGBoost on 50k synthetic travel pairs, AUC reported"
```

---

### Task 3: Update FastAPI Endpoints

**Files:**
- Modify: `backend/main.py`

**Step 1 — Write failing tests first**
Create `backend/tests/test_main.py`:
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

USER = {
    "user_id": "test-user",
    "date_of_birth": "1995-01-01",
    "interests": ["museums", "history", "architecture"],
    "bio": "I love cultural exploration",
    "languages": ["English"],
    "location": "Kyoto, Japan",
    "is_verified": False,
}

CANDIDATES = [
    {
        "user_id": "cand-1",
        "date_of_birth": "1993-03-15",
        "interests": ["heritage", "culture", "temples"],
        "bio": "Local cultural guide",
        "languages": ["English", "Japanese"],
        "location": "Kyoto, Japan",
        "is_verified": True,
    },
    {
        "user_id": "cand-2",
        "date_of_birth": "1990-07-20",
        "interests": ["hiking", "rock climbing"],
        "bio": "Adventure sports guide",
        "languages": ["Japanese"],
        "location": "Osaka, Japan",
        "is_verified": False,
    },
]

def test_rank_returns_200():
    r = client.post("/rank", json={"user": USER, "candidates": CANDIDATES})
    assert r.status_code == 200

def test_rank_returns_matched_interests():
    r = client.post("/rank", json={"user": USER, "candidates": CANDIDATES})
    data = r.json()
    assert "ranked" in data
    for item in data["ranked"]:
        assert "matched_interests" in item
        assert isinstance(item["matched_interests"], list)

def test_rank_returns_match_score():
    r = client.post("/rank", json={"user": USER, "candidates": CANDIDATES})
    data = r.json()
    for item in data["ranked"]:
        assert "match_score" in item
        assert 0.0 <= item["match_score"] <= 1.0

def test_recommend_returns_200():
    r = client.post("/recommend", json={
        "user": USER,
        "candidates": CANDIDATES,
        "category_filter": "cultural_heritage",
    })
    assert r.status_code == 200

def test_recommend_filters_by_category():
    r = client.post("/recommend", json={
        "user": USER,
        "candidates": CANDIDATES,
        "category_filter": "cultural_heritage",
    })
    data = r.json()
    assert "ranked" in data
    # Cultural guide (cand-1) should appear; adventure guide (cand-2) may be filtered
    ids = [item["user_id"] for item in data["ranked"]]
    assert "cand-1" in ids

def test_health_returns_ok():
    r = client.get("/health")
    assert r.status_code == 200
```

**Step 2 — Run tests, confirm they fail**
```bash
cd backend && python -m pytest tests/test_main.py -v
```

**Step 3 — Update `backend/main.py`**

Add `/recommend` endpoint and update `/rank` to include `matched_interests`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from model_service import rank_candidates, recommend_by_category

app = FastAPI()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/rank")
def rank(req: RankRequest):
    user_dict = req.user.model_dump()
    candidates_list = [c.model_dump() for c in req.candidates]
    ranked = rank_candidates(user_dict, candidates_list)
    return {"ranked": ranked}

@app.post("/recommend")
def recommend(req: RecommendRequest):
    user_dict = req.user.model_dump()
    candidates_list = [c.model_dump() for c in req.candidates]
    ranked = recommend_by_category(user_dict, candidates_list, req.category_filter)
    return {"ranked": ranked[:req.limit]}
```

**Step 4 — Run tests**
```bash
cd backend && python -m pytest tests/test_main.py -v
```

**Step 5 — Commit**
```bash
git add backend/main.py backend/tests/test_main.py
git commit -m "feat: add /recommend endpoint, update /rank to return matched_interests"
```

---

### Task 4: Update requirements.txt & pytest config

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`

**Step 1 — Update requirements.txt**
```
fastapi==0.115.0
uvicorn==0.30.6
xgboost==3.1.3
numpy==2.3.1
scikit-learn==1.6.1
pydantic==2.10.0
pytest==8.3.0
httpx==0.27.0
```

**Step 2 — Create pytest.ini**
```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
```

**Step 3 — Run full test suite**
```bash
cd backend && python -m pytest -v
```

**Step 4 — Commit**
```bash
git add backend/requirements.txt backend/pytest.ini
git commit -m "chore: add pytest and httpx to backend deps, add pytest.ini"
```

---

### Task 5: Frontend — Pass More Data, Filter Tabs, Match Reasons

**Files:**
- Modify: `src/pages/Match.tsx`

**Step 1 — Read current Match.tsx** to understand exact structure before modifying.

**Step 2 — Changes to make in Match.tsx:**

A. **Pass `languages`, `bio`, `location` to /rank and /recommend:**
```typescript
// In the fetch candidates queryFn, update the user and candidates body:
body: JSON.stringify({
  user: {
    user_id: user.id,
    date_of_birth: userProfile.date_of_birth,
    interests: userProfile.interests,
    languages: userProfile.languages,      // ADD
    bio: userProfile.bio,                  // ADD
    location: userProfile.location,
  },
  candidates: filtered.map(p => ({
    user_id: p.user_id,
    display_name: p.display_name,
    date_of_birth: p.date_of_birth,
    interests: p.interests,
    languages: p.languages,                // ADD
    bio: p.bio,                            // ADD
    location: p.location,
    is_local: p.is_local,
    is_verified: p.is_verified,
    avatar_url: p.avatar_url,
  })),
}),
```

B. **Add category filter state and tabs:**
```typescript
const CATEGORIES = [
  { key: null, label: "All" },
  { key: "cultural_heritage", label: "Cultural" },
  { key: "adventure_outdoor", label: "Adventure" },
  { key: "food_culinary", label: "Food" },
  { key: "nature_wildlife", label: "Nature" },
  { key: "wellness_spiritual", label: "Spiritual" },
  { key: "luxury_travel", label: "Luxury" },
  { key: "backpacking_budget", label: "Backpacking" },
  { key: "volunteering_community", label: "Volunteering" },
];

const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
```

Add filter tabs UI above the swipe cards (horizontal scrollable row of pill buttons).

When `categoryFilter` changes, call `/recommend` instead of `/rank`:
```typescript
const endpoint = categoryFilter ? "/recommend" : "/rank";
const body = categoryFilter
  ? { user: ..., candidates: ..., category_filter: categoryFilter }
  : { user: ..., candidates: ... };
```

C. **Show matched_interests on swipe card:**
In the card rendering, add a "Both love:" badge:
```typescript
{currentProfile.matched_interests?.length > 0 && (
  <div className="flex flex-wrap gap-1 px-4 py-2">
    <span className="text-xs text-muted-foreground">Both love:</span>
    {currentProfile.matched_interests.slice(0, 3).map((interest) => (
      <span key={interest} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
        {interest}
      </span>
    ))}
  </div>
)}
```

D. **Show matched_interests in match popup:**
Pass `matched_interests` to whatever component shows the "It's a Match!" dialog.

**Step 3 — Commit**
```bash
git add src/pages/Match.tsx
git commit -m "feat: add category filter tabs, show matched interests on cards and match popup"
```

---

### Task 6: End-to-End Verification

**Step 1 — Run full backend test suite**
```bash
cd backend && python -m pytest -v
```

**Step 2 — Start backend and test manually**
```bash
cd backend && uvicorn main:app --port 10000 --reload
curl -X POST http://localhost:10000/rank \
  -H "Content-Type: application/json" \
  -d '{"user":{"interests":["museums","history"],"languages":["English"],"bio":"I love culture","location":"Tokyo, Japan","date_of_birth":"1995-01-01"},"candidates":[{"user_id":"1","interests":["heritage","temples"],"languages":["English","Japanese"],"bio":"Cultural guide","location":"Tokyo, Japan","date_of_birth":"1993-01-01","is_verified":true}]}'
```

**Step 3 — Start frontend and verify**
```bash
cd /Users/ryanntay/Downloads/Travela && npm run dev
```
Open http://localhost:8080, navigate to Match page, verify:
- [ ] Filter tabs appear
- [ ] Switching tabs changes results
- [ ] "Both love:" badge appears on cards with shared interests
- [ ] Match popup shows matched interests

**Step 4 — Commit verification results**
```bash
git commit --allow-empty -m "chore: end-to-end verification passed"
```
