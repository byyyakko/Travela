"""Tests for /posts CRUD endpoints."""
import pytest
from fastapi.testclient import TestClient
from main import app
from middleware.auth import require_auth

client = TestClient(app)

_FAKE_USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"


@pytest.fixture(autouse=True, scope="module")
def _auth_override():
    app.dependency_overrides[require_auth] = lambda: _FAKE_USER
    yield
    app.dependency_overrides.pop(require_auth, None)


def test_get_posts_returns_list():
    r = client.get("/posts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_post_missing_content_returns_422():
    r = client.post("/posts", json={})
    assert r.status_code == 422


def test_create_post_returns_id():
    r = client.post("/posts", json={"content": "test post from migration"})
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
    assert "created_at" in data


def test_create_post_with_all_fields():
    r = client.post(
        "/posts",
        json={
            "content": "full post",
            "image_url": "https://example.com/img.jpg",
            "image_urls": ["https://example.com/a.jpg", "https://example.com/b.jpg"],
            "location_tag": "Singapore",
            "category": "adventure_outdoor",
        },
    )
    assert r.status_code == 200
    assert "id" in r.json()


def test_toggle_like_invalid_uuid_returns_500():
    r = client.post("/posts/not-a-uuid/likes")
    assert r.status_code == 500


def test_toggle_bookmark_invalid_uuid_returns_500():
    r = client.post("/posts/not-a-uuid/bookmarks")
    assert r.status_code == 500


def test_add_comment_missing_content_returns_422():
    r = client.post("/posts/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/comments", json={})
    assert r.status_code == 422


def test_list_comments_invalid_uuid_returns_500():
    r = client.get("/posts/not-a-uuid/comments")
    assert r.status_code == 500
