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

def test_auth_link_returns_409_if_profile_linked_to_different_user(monkeypatch):
    """POST /profiles/auth/link should return 409 if email resolves to a profile already linked to a different UUID."""
    import routers.profiles as prof_module
    original_get_conn = prof_module.get_conn

    class FakeCursor:
        def execute(self, sql, params=None):
            pass
        def fetchone(self):
            # Return a profile_id and a DIFFERENT user_id
            return ("some-profile-id", "ffffffff-ffff-ffff-ffff-ffffffffffff")

    class FakeConn:
        def cursor(self): return FakeCursor()
        def rollback(self): pass
        def commit(self): pass

    def fake_get_conn():
        return FakeConn()

    monkeypatch.setattr(prof_module, "get_conn", fake_get_conn)
    monkeypatch.setattr(prof_module, "put_conn", lambda c: None)

    r = client.post("/profiles/auth/link", json={"email": "other@example.com"})
    assert r.status_code == 409
