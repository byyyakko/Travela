"""Tests for FastAPI endpoints — /rank and /recommend."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

USER = {
    "user_id": "test-user",
    "date_of_birth": "1995-01-01",
    "interests": ["museums", "history", "architecture", "local culture"],
    "bio": "I love cultural exploration and historical sites",
    "languages": ["English"],
    "location": "Kyoto, Japan",
    "is_verified": False,
}

CANDIDATES = [
    {
        "user_id": "cultural-guide",
        "date_of_birth": "1993-03-15",
        "interests": ["heritage", "culture", "temples", "ancient sites"],
        "bio": "Local cultural guide with 10 years experience",
        "languages": ["English", "Japanese"],
        "location": "Kyoto, Japan",
        "is_verified": True,
    },
    {
        "user_id": "adventure-guide",
        "date_of_birth": "1990-07-20",
        "interests": ["rock climbing", "bungee jumping", "paragliding"],
        "bio": "Extreme sports guide — adrenaline is my religion",
        "languages": ["Japanese"],
        "location": "Osaka, Japan",
        "is_verified": False,
    },
    {
        "user_id": "spiritual-guide",
        "date_of_birth": "1988-11-05",
        "interests": ["meditation", "pilgrimage", "shrines", "yoga"],
        "bio": "Spiritual guide leading temple walks and meditation retreats",
        "languages": ["English", "Japanese"],
        "location": "Kyoto, Japan",
        "is_verified": True,
    },
]


def test_health_returns_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_rank_returns_200():
    r = client.post("/rank", json={"user": USER, "candidates": CANDIDATES})
    assert r.status_code == 200


def test_rank_returns_ranked_list():
    r = client.post("/rank", json={"user": USER, "candidates": CANDIDATES})
    data = r.json()
    assert "ranked" in data
    assert len(data["ranked"]) == 3


def test_rank_returns_match_score():
    r = client.post("/rank", json={"user": USER, "candidates": CANDIDATES})
    for item in r.json()["ranked"]:
        assert "match_score" in item
        assert 0.0 <= item["match_score"] <= 1.0


def test_rank_returns_matched_interests():
    r = client.post("/rank", json={"user": USER, "candidates": CANDIDATES})
    for item in r.json()["ranked"]:
        assert "matched_interests" in item
        assert isinstance(item["matched_interests"], list)


def test_rank_cultural_guide_ranks_higher_than_adventure():
    r = client.post("/rank", json={"user": USER, "candidates": CANDIDATES})
    ranked = r.json()["ranked"]
    ids = [item["user_id"] for item in ranked]
    assert ids.index("cultural-guide") < ids.index("adventure-guide"), (
        "Cultural guide should rank higher than adventure guide for a cultural traveler"
    )


def test_recommend_returns_200():
    r = client.post("/recommend", json={
        "user": USER,
        "candidates": CANDIDATES,
        "category_filter": "cultural_heritage",
    })
    assert r.status_code == 200


def test_recommend_filters_by_cultural_category():
    r = client.post("/recommend", json={
        "user": USER,
        "candidates": CANDIDATES,
        "category_filter": "cultural_heritage",
    })
    data = r.json()
    ids = [item["user_id"] for item in data["ranked"]]
    assert "cultural-guide" in ids, "Cultural guide should appear in cultural filter results"
    assert "adventure-guide" not in ids, "Adventure guide should be filtered out for cultural filter"


def test_recommend_filters_by_spiritual_category():
    r = client.post("/recommend", json={
        "user": USER,
        "candidates": CANDIDATES,
        "category_filter": "wellness_spiritual",
    })
    data = r.json()
    ids = [item["user_id"] for item in data["ranked"]]
    assert "spiritual-guide" in ids


def test_recommend_no_filter_returns_all_ranked():
    r = client.post("/recommend", json={
        "user": USER,
        "candidates": CANDIDATES,
    })
    assert len(r.json()["ranked"]) == 3


def test_recommend_respects_limit():
    r = client.post("/recommend", json={
        "user": USER,
        "candidates": CANDIDATES,
        "limit": 1,
    })
    assert len(r.json()["ranked"]) == 1


def test_rank_handles_empty_candidates():
    r = client.post("/rank", json={"user": USER, "candidates": []})
    assert r.status_code == 200
    assert r.json()["ranked"] == []


def test_rank_handles_missing_optional_fields():
    minimal_user = {"user_id": "u1"}
    minimal_cand = [{"user_id": "c1"}]
    r = client.post("/rank", json={"user": minimal_user, "candidates": minimal_cand})
    assert r.status_code == 200


def test_analytics_returns_200_without_supabase(monkeypatch):
    """When Supabase is not configured, /analytics returns 200 but logs a warning."""
    monkeypatch.delenv("SUPABASE_OWN_URL", raising=False)
    monkeypatch.delenv("SUPABASE_OWN_SERVICE_KEY", raising=False)

    r = client.post("/analytics", json={
        "event_type": "page_view",
        "page": "/match",
        "session_id": "test-session",
        "user_id": None,
        "event_data": {}
    })
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_analytics_rejects_missing_event_type():
    r = client.post("/analytics", json={
        "page": "/match",
        "session_id": "test-session",
    })
    assert r.status_code == 422


# ── Gender filter fixtures ────────────────────────────────────────────────────

FEMALE_USER = {
    "user_id": "female-user",
    "date_of_birth": "1995-01-01",
    "interests": ["museums", "history"],
    "bio": "Traveler",
    "languages": ["English"],
    "location": "Tokyo, Japan",
    "gender": "female",
}

FEMALE_CANDIDATE = {
    "user_id": "female-cand",
    "date_of_birth": "1993-03-15",
    "interests": ["museums", "culture"],
    "bio": "Local guide",
    "languages": ["English", "Japanese"],
    "location": "Tokyo, Japan",
    "gender": "female",
}

MALE_CANDIDATE = {
    "user_id": "male-cand",
    "date_of_birth": "1990-07-20",
    "interests": ["museums", "culture"],
    "bio": "Adventure guide",
    "languages": ["English"],
    "location": "Tokyo, Japan",
    "gender": "male",
}

UNSET_GENDER_CANDIDATE = {
    "user_id": "unset-cand",
    "date_of_birth": "1992-05-10",
    "interests": ["museums"],
    "bio": "Guide",
    "languages": ["English"],
    "location": "Tokyo, Japan",
    # no gender field
}


class TestGenderFilter:
    """POST /rank and /recommend with same_gender_only flag."""

    def test_rank_without_flag_returns_all_candidates(self):
        """same_gender_only defaults False — all candidates returned."""
        r = client.post("/rank", json={
            "user": FEMALE_USER,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" in ids

    def test_rank_same_gender_only_excludes_other_gender(self):
        """same_gender_only=True filters out candidates of a different gender."""
        r = client.post("/rank", json={
            "user": FEMALE_USER,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" not in ids

    def test_rank_same_gender_only_includes_unset_gender_candidates(self):
        """Candidates with no gender set are included even when same_gender_only=True."""
        r = client.post("/rank", json={
            "user": FEMALE_USER,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE, UNSET_GENDER_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "unset-cand" in ids
        assert "male-cand" not in ids

    def test_rank_user_with_no_gender_skips_filter(self):
        """If the user has no gender set, same_gender_only is a no-op."""
        user_no_gender = {**FEMALE_USER, "gender": None}
        r = client.post("/rank", json={
            "user": user_no_gender,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" in ids

    def test_rank_prefer_not_to_say_skips_filter(self):
        """User gender='prefer_not_to_say' means same_gender_only is a no-op."""
        user_pnts = {**FEMALE_USER, "gender": "prefer_not_to_say"}
        r = client.post("/rank", json={
            "user": user_pnts,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" in ids

    def test_recommend_same_gender_only_filters_candidates(self):
        """same_gender_only works identically on /recommend."""
        r = client.post("/recommend", json={
            "user": FEMALE_USER,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" not in ids

    def test_recommend_gender_filter_and_category_filter_combine(self):
        """Both filters apply independently — AND logic."""
        cand_wrong_gender_right_category = {
            **MALE_CANDIDATE,
            "user_id": "male-culture",
            "interests": ["museums", "heritage", "culture"],
        }
        cand_right_gender_wrong_category = {
            **FEMALE_CANDIDATE,
            "user_id": "female-adventure",
            "interests": ["rock climbing", "bungee jumping"],
        }
        cand_right_both = {
            **FEMALE_CANDIDATE,
            "user_id": "female-culture",
            "interests": ["museums", "heritage", "culture"],
        }
        r = client.post("/recommend", json={
            "user": FEMALE_USER,
            "candidates": [
                cand_wrong_gender_right_category,
                cand_right_gender_wrong_category,
                cand_right_both,
            ],
            "same_gender_only": True,
            "category_filter": "cultural_heritage",
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-culture" in ids
        assert "male-culture" not in ids
