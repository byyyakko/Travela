"""Tests for Supabase JWT auth middleware."""

import base64
import json
import time

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from middleware import auth
from middleware.auth import require_auth


def _b64(data: dict) -> str:
    return base64.urlsafe_b64encode(
        json.dumps(data, separators=(",", ":")).encode()
    ).decode().rstrip("=")


def _token(sub: str = "user-123", exp: int | None = None) -> str:
    exp = exp if exp is not None else int(time.time()) + 300
    return f"{_b64({'alg': 'none', 'typ': 'JWT'})}.{_b64({'sub': sub, 'exp': exp})}.sig"


def _token_with_issuer(sub: str = "user-123") -> str:
    return (
        f"{_b64({'alg': 'none', 'typ': 'JWT'})}."
        f"{_b64({'sub': sub, 'exp': int(time.time()) + 300, 'iss': 'https://example.supabase.co/auth/v1'})}."
        "sig"
    )


class _MockResponse:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body


class _MockAsyncClient:
    response = _MockResponse(200, {"id": "user-123"})
    requested_headers = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def get(self, _url, headers):
        type(self).requested_headers = headers
        return type(self).response


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")
    monkeypatch.setattr(auth.httpx, "AsyncClient", _MockAsyncClient)
    _MockAsyncClient.response = _MockResponse(200, {"id": "user-123"})
    _MockAsyncClient.requested_headers = None

    app = FastAPI()

    @app.get("/protected")
    async def protected(user_id: str = Depends(require_auth)):
        return {"user_id": user_id}

    return TestClient(app)


def test_accepts_token_verified_by_supabase(client):
    r = client.get("/protected", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 200
    assert r.json() == {"user_id": "user-123"}
    assert _MockAsyncClient.requested_headers["apikey"] == "anon-key"


def test_rejects_forged_token_when_supabase_rejects_it(client):
    _MockAsyncClient.response = _MockResponse(401, {})
    r = client.get("/protected", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"


def test_rejects_token_when_supabase_user_mismatches_payload(client):
    _MockAsyncClient.response = _MockResponse(200, {"id": "different-user"})
    r = client.get("/protected", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"


def test_rejects_expired_token_before_supabase_call(client):
    r = client.get(
        "/protected",
        headers={"Authorization": f"Bearer {_token(exp=int(time.time()) - 1)}"},
    )
    assert r.status_code == 401
    assert r.json()["detail"] == "Token expired"
    assert _MockAsyncClient.requested_headers is None


def test_uses_jwt_issuer_when_auth_env_url_missing(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_OWN_URL", raising=False)
    r = client.get("/protected", headers={"Authorization": f"Bearer {_token_with_issuer()}"})
    assert r.status_code == 200


def test_missing_auth_config_without_issuer_is_invalid_token(client, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_OWN_URL", raising=False)
    r = client.get("/protected", headers={"Authorization": f"Bearer {_token()}"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"
