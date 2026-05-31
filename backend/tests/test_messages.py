"""Tests for /conversations REST endpoints."""
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


def test_get_conversations_returns_list():
    r = client.get("/conversations")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_conversation_missing_other_user_returns_422():
    r = client.post("/conversations", json={})
    assert r.status_code == 422


def test_create_conversation_with_self_returns_400():
    r = client.post(
        "/conversations",
        json={"other_user_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"},
    )
    assert r.status_code == 400


def test_patch_nonexistent_conversation_returns_404():
    r = client.patch(
        "/conversations/00000000-0000-0000-0000-000000000000",
        json={"accepted": True},
    )
    assert r.status_code == 404


def test_list_messages_nonexistent_conversation_returns_403():
    r = client.get("/conversations/00000000-0000-0000-0000-000000000000/messages")
    assert r.status_code == 403


def test_send_message_to_nonexistent_conversation_returns_403():
    r = client.post(
        "/conversations/00000000-0000-0000-0000-000000000000/messages",
        json={"content": "hello"},
    )
    assert r.status_code == 403


def test_send_message_missing_content_returns_422():
    r = client.post(
        "/conversations/00000000-0000-0000-0000-000000000000/messages",
        json={},
    )
    assert r.status_code == 422
