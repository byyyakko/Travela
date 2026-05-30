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

def test_get_experiences_returns_list():
    r = client.get("/experiences")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_create_experience_missing_title_returns_422():
    r = client.post("/experiences", json={})
    assert r.status_code == 422
