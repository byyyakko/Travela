"""Tests for supabase_client module."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

# A JWT-shaped fake key (three base64url segments) that passes Supabase's format check
FAKE_JWT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.fake_signature_here"


def test_get_supabase_own_returns_client_when_env_set(monkeypatch):
    monkeypatch.setenv("SUPABASE_OWN_URL", "https://pdnnpduahwpxynsfaxhj.supabase.co")
    monkeypatch.setenv("SUPABASE_OWN_SERVICE_KEY", FAKE_JWT_KEY)

    # Re-import after env vars are set
    import importlib
    import supabase_client
    importlib.reload(supabase_client)

    client = supabase_client.get_supabase_own()
    assert client is not None


def test_get_supabase_own_returns_none_when_env_missing(monkeypatch):
    monkeypatch.delenv("SUPABASE_OWN_URL", raising=False)
    monkeypatch.delenv("SUPABASE_OWN_SERVICE_KEY", raising=False)

    import importlib
    import supabase_client
    importlib.reload(supabase_client)

    client = supabase_client.get_supabase_own()
    assert client is None
