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

def test_auth_link_unknown_email_returns_not_linked():
    r = client.post("/profiles/auth/link", json={"email": "nobody@example.com"})
    assert r.status_code == 200
    assert r.json()["linked"] is False

def test_auth_link_missing_email_returns_422():
    r = client.post("/profiles/auth/link", json={})
    assert r.status_code == 422
