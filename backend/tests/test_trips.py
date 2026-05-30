"""Tests for /trips CRUD endpoints."""
import pytest
from fastapi.testclient import TestClient
from main import app
from middleware.auth import require_auth

client = TestClient(app)

@pytest.fixture(autouse=True, scope="module")
def _auth_override():
    app.dependency_overrides[require_auth] = lambda: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    yield
    app.dependency_overrides.pop(require_auth, None)

def test_get_trips_returns_list():
    r = client.get("/trips")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_get_history_returns_list():
    r = client.get("/trips/history")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_create_trip_missing_required_fields_returns_422():
    r = client.post("/trips", json={})
    assert r.status_code == 422

def test_create_trip_returns_id():
    r = client.post("/trips", json={"name": "Test Trip", "country": "JP"})
    assert r.status_code == 200
    data = r.json()
    assert "id" in data

def test_delete_nonexistent_trip_returns_404():
    r = client.delete("/trips/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404

def test_get_items_for_nonexistent_trip_returns_list():
    r = client.get("/trips/00000000-0000-0000-0000-000000000000/items")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_save_history_returns_id():
    r = client.post("/trips/history", json={"title": "Test History", "prompt": "3 days in Tokyo"})
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
