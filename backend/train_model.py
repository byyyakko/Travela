"""
train_model.py — Generate synthetic travel profile pairs and retrain XGBoost v2.

Usage:
    cd backend && python train_model.py

Outputs:
    model/travel_buddy_v2.json   — retrained XGBoost model
    model/feature_names_v2.txt   — feature name list (55 features)
"""

import random
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

from model_service import (
    build_feature_vector,
    FEATURE_NAMES_V2,
    INTEREST_CATEGORIES,
    CATEGORY_NAMES,
)

random.seed(42)
np.random.seed(42)

# ── Synthetic data vocabulary ───────────────────────────────────────────────

_INTEREST_POOL: dict[str, list[str]] = {
    cat: kws[:10] for cat, kws in INTEREST_CATEGORIES.items()
}

LOCATIONS = [
    "Tokyo, Japan", "Kyoto, Japan", "Osaka, Japan",
    "Bangkok, Thailand", "Bali, Indonesia", "Seoul, South Korea",
    "Paris, France", "Barcelona, Spain", "Rome, Italy",
    "New York, USA", "London, UK", "Sydney, Australia",
    "Chiang Mai, Thailand", "Lisbon, Portugal", "Amsterdam, Netherlands",
    "Mexico City, Mexico", "Buenos Aires, Argentina", "Cape Town, South Africa",
]

LANGUAGES = [
    "English", "Japanese", "Mandarin", "Spanish", "French",
    "Thai", "Korean", "Indonesian", "Italian", "Portuguese",
    "German", "Arabic",
]

BIO_TEMPLATES = [
    "I love {a} and {b} when exploring new places.",
    "Passionate about {a}. Always looking for authentic {b} experiences.",
    "Experienced traveler — big fan of {a} and anything {b}-related.",
    "My ideal trip involves {a}, great food, and meeting locals.",
    "I'm all about {a}. Currently exploring {b} culture.",
    "",  # ~10% empty bios
    "",
]


def _random_dob(min_age: int = 18, max_age: int = 52) -> str:
    from datetime import date, timedelta
    days = random.randint(min_age * 365, max_age * 365)
    dob = date.today() - timedelta(days=days)
    return dob.strftime("%Y-%m-%d")


def _random_interests(primary_cats: list[str] | None = None, n: int = 5) -> list[str]:
    result: list[str] = []
    if primary_cats:
        for cat in primary_cats:
            pool = _INTEREST_POOL.get(cat, [])
            if pool:
                result.extend(random.sample(pool, min(2, len(pool))))
    # Pad with random interests from any category
    all_kws = [kw for kws in _INTEREST_POOL.values() for kw in kws]
    extras = random.sample(all_kws, min(n, len(all_kws)))
    result.extend(extras)
    return list(dict.fromkeys(result))[:n + 3]  # deduplicate, cap


def _random_bio(interests: list[str]) -> str:
    template = random.choice(BIO_TEMPLATES)
    if not template or len(interests) < 2:
        return ""
    return template.format(a=interests[0], b=interests[1])


def _random_langs(n_min: int = 1, n_max: int = 3) -> list[str]:
    return random.sample(LANGUAGES, random.randint(n_min, min(n_max, len(LANGUAGES))))


def _generate_profile(primary_cats: list[str] | None = None) -> dict:
    interests = _random_interests(primary_cats)
    return {
        "date_of_birth": _random_dob(),
        "interests": interests,
        "bio": _random_bio(interests),
        "languages": _random_langs(),
        "location": random.choice(LOCATIONS),
        "is_verified": random.random() < 0.25,
    }


def _generate_pair(match: bool) -> tuple[dict, dict]:
    """
    match=True  → compatible pair (shared categories, likely shared language/city)
    match=False → incompatible pair (opposing interests, possible age gap)
    """
    if match:
        n_shared = random.randint(1, 3)
        shared_cats = random.sample(CATEGORY_NAMES, n_shared)
        user = _generate_profile(primary_cats=shared_cats)
        cand = _generate_profile(primary_cats=shared_cats)
        # 60% chance of shared language
        if random.random() < 0.60:
            shared_lang = random.choice(LANGUAGES)
            user["languages"] = list({*user["languages"], shared_lang})
            cand["languages"] = list({*cand["languages"], shared_lang})
        # 35% chance of same city
        if random.random() < 0.35:
            cand["location"] = user["location"]
    else:
        # Pick two non-overlapping category groups
        shuffled = random.sample(CATEGORY_NAMES, len(CATEGORY_NAMES))
        user = _generate_profile(primary_cats=shuffled[:2])
        cand = _generate_profile(primary_cats=shuffled[-2:])
        # Age mismatch in 40% of negative pairs
        if random.random() < 0.40:
            user["date_of_birth"] = _random_dob(18, 26)
            cand["date_of_birth"] = _random_dob(40, 55)
    return user, cand


# ── Generate dataset ──────────────────────────────────────────────────────────

N = 50_000
POSITIVE_RATE = 0.40  # realistic match rate

print(f"Generating {N:,} profile pairs (positive rate: {POSITIVE_RATE:.0%})...")

X_list: list[np.ndarray] = []
y_list: list[int] = []

for i in range(N):
    is_match = random.random() < POSITIVE_RATE
    user, cand = _generate_pair(match=is_match)
    X_list.append(build_feature_vector(user, cand))
    y_list.append(int(is_match))

X = np.vstack(X_list)
y = np.array(y_list, dtype=np.int32)

print(f"Dataset shape: {X.shape}")
print(f"Positive rate: {y.mean():.2%}")

# ── Train / test split ────────────────────────────────────────────────────────

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

# ── Train XGBoost ─────────────────────────────────────────────────────────────

neg_count = int((y_train == 0).sum())
pos_count = int((y_train == 1).sum())
scale_pos = neg_count / pos_count

print(f"\nTraining XGBoost (scale_pos_weight={scale_pos:.2f})...")

clf = xgb.XGBClassifier(
    n_estimators=400,
    max_depth=6,
    learning_rate=0.04,
    subsample=0.80,
    colsample_bytree=0.80,
    min_child_weight=5,
    gamma=0.1,
    reg_alpha=0.1,
    reg_lambda=1.0,
    scale_pos_weight=scale_pos,
    eval_metric="auc",
    early_stopping_rounds=30,
    random_state=42,
    verbosity=0,
)

clf.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=50,
)

test_auc = roc_auc_score(y_test, clf.predict_proba(X_test)[:, 1])
print(f"\nTest AUC: {test_auc:.4f}")
if test_auc < 0.75:
    print("WARNING: AUC below 0.75 — check feature engineering")

# ── Save outputs ──────────────────────────────────────────────────────────────

import os

model_dir = os.path.join(os.path.dirname(__file__), "model")
os.makedirs(model_dir, exist_ok=True)

model_path = os.path.join(model_dir, "travel_buddy_v2.json")
feature_path = os.path.join(model_dir, "feature_names_v2.txt")

clf.save_model(model_path)
with open(feature_path, "w") as f:
    f.write("\n".join(FEATURE_NAMES_V2))

print(f"\nSaved model  → {model_path}")
print(f"Saved features → {feature_path}")
print(f"Feature count: {len(FEATURE_NAMES_V2)}")
print("\nDone.")
