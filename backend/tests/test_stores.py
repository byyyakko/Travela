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

def test_get_my_store_returns_200_or_404():
    r = client.get("/stores/me")
    assert r.status_code in (200, 404)

def test_create_store_missing_name_returns_422():
    r = client.post("/stores", json={})
    assert r.status_code == 422
