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
