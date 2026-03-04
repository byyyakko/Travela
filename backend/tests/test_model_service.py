"""Tests for model_service.py — feature engineering pipeline."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from model_service import interests_to_scores, build_feature_vector, FEATURE_NAMES_V2, CATEGORY_NAMES


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


def test_feature_vector_has_correct_length():
    user = {
        "interests": ["museums"],
        "date_of_birth": "1995-01-01",
        "bio": "I love culture",
        "languages": ["English"],
        "location": "Tokyo, Japan",
        "is_verified": False,
    }
    cand = {
        "interests": ["history"],
        "date_of_birth": "1996-06-15",
        "bio": "History lover",
        "languages": ["English"],
        "location": "Tokyo, Japan",
        "is_verified": True,
    }
    vec = build_feature_vector(user, cand)
    assert len(vec) == len(FEATURE_NAMES_V2), f"Expected {len(FEATURE_NAMES_V2)}, got {len(vec)}"


def test_shared_language_detected():
    user = {"interests": [], "languages": ["English", "Japanese"]}
    cand = {"interests": [], "languages": ["Japanese", "Mandarin"]}
    vec = build_feature_vector(user, cand)
    idx = FEATURE_NAMES_V2.index("has_shared_language")
    assert vec[idx] == 1.0


def test_no_shared_language():
    user = {"interests": [], "languages": ["English"]}
    cand = {"interests": [], "languages": ["Mandarin"]}
    vec = build_feature_vector(user, cand)
    idx = FEATURE_NAMES_V2.index("has_shared_language")
    assert vec[idx] == 0.0


def test_same_city_detected():
    user = {"interests": [], "location": "Tokyo, Japan"}
    cand = {"interests": [], "location": "Tokyo, Japan"}
    vec = build_feature_vector(user, cand)
    idx = FEATURE_NAMES_V2.index("same_city")
    assert vec[idx] == 1.0


def test_different_city_same_country():
    user = {"interests": [], "location": "Tokyo, Japan"}
    cand = {"interests": [], "location": "Osaka, Japan"}
    vec = build_feature_vector(user, cand)
    same_city_idx = FEATURE_NAMES_V2.index("same_city")
    same_country_idx = FEATURE_NAMES_V2.index("same_country")
    assert vec[same_city_idx] == 0.0
    assert vec[same_country_idx] == 1.0


def test_bio_similarity_nonzero_for_similar_bios():
    user = {"interests": [], "bio": "I love exploring ancient temples and local culture"}
    cand = {"interests": [], "bio": "Ancient temples and cultural experiences are my passion"}
    vec = build_feature_vector(user, cand)
    idx = FEATURE_NAMES_V2.index("bio_similarity")
    assert vec[idx] > 0.1


def test_bio_similarity_zero_for_empty_bios():
    user = {"interests": [], "bio": ""}
    cand = {"interests": [], "bio": None}
    vec = build_feature_vector(user, cand)
    idx = FEATURE_NAMES_V2.index("bio_similarity")
    assert vec[idx] == 0.0


def test_12_categories_present():
    assert len(CATEGORY_NAMES) == 12


def test_all_feature_names_unique():
    assert len(FEATURE_NAMES_V2) == len(set(FEATURE_NAMES_V2)), "Duplicate feature names found"


def test_niche_bonus_for_shared_rare_interests():
    rare_interest = "birdwatching"
    user = {"interests": [rare_interest, "hiking"]}
    cand = {"interests": [rare_interest, "museums"]}
    vec = build_feature_vector(user, cand)
    idx = FEATURE_NAMES_V2.index("niche_interest_bonus")
    assert vec[idx] > 0.0
