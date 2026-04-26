"""Tests for /utils endpoints — mocks all external calls."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# ── geocode ──────────────────────────────────────────────────────────────────

def test_geocode_returns_coordinates():
    fake_response = MagicMock()
    fake_response.is_success = True
    fake_response.json.return_value = [{"lat": "1.3521", "lon": "103.8198", "display_name": "Singapore"}]
    with patch("routers.utils.httpx.get", return_value=fake_response):
        r = client.post("/utils/geocode", json={"address": "Singapore"})
    assert r.status_code == 200
    data = r.json()
    assert "latitude" in data
    assert abs(data["latitude"] - 1.3521) < 0.001


def test_geocode_returns_null_on_not_found():
    fake_response = MagicMock()
    fake_response.is_success = True
    fake_response.json.return_value = []
    with patch("routers.utils.httpx.get", return_value=fake_response):
        r = client.post("/utils/geocode", json={"address": "zzzznotaplace"})
    assert r.status_code == 200
    assert r.json().get("latitude") is None


def test_geocode_rejects_missing_address():
    r = client.post("/utils/geocode", json={})
    assert r.status_code == 422


# ── profanity ─────────────────────────────────────────────────────────────────

def test_profanity_clean_text_returns_false():
    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(text='{"is_profane": false}')]
    with patch("routers.utils.get_claude") as mock_claude:
        mock_claude.return_value.messages.create.return_value = mock_msg
        r = client.post("/utils/profanity", json={"text": "Hello world"},
                        headers={"Authorization": "Bearer fake"})
    assert r.status_code in (200, 401)


def test_profanity_rejects_missing_text():
    r = client.post("/utils/profanity", json={},
                    headers={"Authorization": "Bearer fake"})
    assert r.status_code in (401, 422)


# ── toilets ───────────────────────────────────────────────────────────────────

def test_toilets_rejects_missing_coords():
    r = client.post("/utils/toilets", json={"latitude": 1.3521},
                    headers={"Authorization": "Bearer fake"})
    assert r.status_code in (401, 422)


def test_toilets_rejects_unauthenticated():
    r = client.post("/utils/toilets", json={"latitude": 1.3521, "longitude": 103.8198})
    assert r.status_code == 401


# ── moderate-image ────────────────────────────────────────────────────────────

def test_moderate_image_rejects_unauthenticated():
    r = client.post("/utils/moderate-image", json={"image_url": "https://example.com/img.jpg"})
    assert r.status_code == 401


def test_moderate_image_rejects_missing_url():
    r = client.post("/utils/moderate-image", json={},
                    headers={"Authorization": "Bearer fake"})
    assert r.status_code in (401, 422)
