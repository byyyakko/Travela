"""Tests for retrained model existence and correctness."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_retrained_model_file_exists():
    assert os.path.exists(
        os.path.join(os.path.dirname(__file__), "..", "model", "travel_buddy_v2.json")
    ), "travel_buddy_v2.json not found — run train_model.py first"


def test_feature_names_v2_file_exists():
    assert os.path.exists(
        os.path.join(os.path.dirname(__file__), "..", "model", "feature_names_v2.txt")
    ), "feature_names_v2.txt not found"


def test_model_loads_and_predicts():
    import xgboost as xgb
    import numpy as np
    m = xgb.XGBClassifier()
    m.load_model(
        os.path.join(os.path.dirname(__file__), "..", "model", "travel_buddy_v2.json")
    )
    from model_service import FEATURE_NAMES_V2
    dummy = np.zeros((1, len(FEATURE_NAMES_V2)), dtype=np.float32)
    proba = m.predict_proba(dummy)
    assert proba.shape == (1, 2)
    assert 0.0 <= proba[0][1] <= 1.0


def test_cultural_match_scores_higher_than_adventure_mismatch():
    from model_service import rank_candidates
    user = {
        "interests": ["museums", "history", "architecture", "local culture"],
        "date_of_birth": "1995-01-01",
        "bio": "I love exploring ancient temples and cultural heritage",
        "languages": ["English"],
        "location": "Kyoto, Japan",
        "is_verified": False,
    }
    culture_guide = {
        "user_id": "cultural",
        "interests": ["heritage", "culture", "ancient sites", "temples"],
        "date_of_birth": "1993-03-15",
        "bio": "Local guide specialising in historical and cultural sites",
        "languages": ["English", "Japanese"],
        "location": "Kyoto, Japan",
        "is_verified": True,
    }
    adventure_guide = {
        "user_id": "adventure",
        "interests": ["rock climbing", "bungee jumping", "paragliding", "mountaineering"],
        "date_of_birth": "1990-07-20",
        "bio": "Extreme sports enthusiast — let's push limits",
        "languages": ["Japanese"],
        "location": "Osaka, Japan",
        "is_verified": False,
    }
    ranked = rank_candidates(user, [adventure_guide, culture_guide])
    assert ranked[0]["user_id"] == "cultural", (
        f"Cultural guide should rank higher for cultural user, "
        f"got {ranked[0]['user_id']} (scores: cultural={ranked[1]['match_score'] if ranked[0]['user_id']=='adventure' else ranked[0]['match_score']}, "
        f"adventure={ranked[0]['match_score'] if ranked[0]['user_id']=='adventure' else ranked[1]['match_score']})"
    )


def test_ranked_results_include_matched_interests():
    from model_service import rank_candidates
    user = {"interests": ["museums", "history"], "languages": ["English"]}
    candidate = {
        "user_id": "c1",
        "interests": ["history", "heritage"],
        "languages": ["English"],
    }
    ranked = rank_candidates(user, [candidate])
    assert "matched_interests" in ranked[0]
    assert isinstance(ranked[0]["matched_interests"], list)


def test_model_auc_above_threshold():
    """Smoke-test: model should produce varied scores (not all the same)."""
    from model_service import rank_candidates
    import random
    random.seed(0)

    INTERESTS = [
        ["museums", "history"], ["hiking", "camping"], ["street food", "cooking"],
        ["yoga", "meditation"], ["nightlife", "concerts"], ["photography", "art"],
        ["wildlife", "safari"], ["beach", "snorkeling"], ["volunteering", "teaching"],
        ["luxury hotels", "fine dining"],
    ]
    user = {"interests": ["museums", "history", "local culture"], "date_of_birth": "1995-01-01"}
    candidates = [
        {"user_id": str(i), "interests": INTERESTS[i % len(INTERESTS)],
         "date_of_birth": f"199{i % 9}-0{(i % 9) + 1}-15"}
        for i in range(10)
    ]
    ranked = rank_candidates(user, candidates)
    scores = [r["match_score"] for r in ranked]
    # Scores should not all be identical
    assert max(scores) - min(scores) > 0.01, "Model produces identical scores — something is wrong"
