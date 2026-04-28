"""Tests for /auth/email-rate-limit endpoint."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

PAYLOAD = {"email": "test@example.com", "action": "reset_password"}


def _mock_conn(last_attempt_seconds_ago=None, count=0):
    """Helper: returns a mock psycopg2 connection."""
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    if last_attempt_seconds_ago is None:
        mock_cur.fetchone.return_value = None  # no prior record
    else:
        from datetime import datetime, timezone, timedelta
        ts = datetime.now(timezone.utc) - timedelta(seconds=last_attempt_seconds_ago)
        mock_cur.fetchone.return_value = (ts, count)
    return mock_conn, mock_cur


def test_first_request_is_allowed():
    conn, _ = _mock_conn(last_attempt_seconds_ago=None)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json=PAYLOAD)
    assert r.status_code == 200
    assert r.json()["allowed"] is True


def test_request_within_cooldown_is_blocked():
    conn, _ = _mock_conn(last_attempt_seconds_ago=10, count=1)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json=PAYLOAD)
    assert r.status_code == 429
    assert "retry_after" in r.json()


def test_request_after_cooldown_is_allowed():
    conn, _ = _mock_conn(last_attempt_seconds_ago=70, count=1)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json=PAYLOAD)
    assert r.status_code == 200
    assert r.json()["allowed"] is True


def test_missing_email_rejected():
    r = client.post("/auth/email-rate-limit", json={"action": "reset_password"})
    assert r.status_code == 422


def test_missing_action_rejected():
    r = client.post("/auth/email-rate-limit", json={"email": "test@example.com"})
    assert r.status_code == 422


def test_signup_action_allowed():
    conn, _ = _mock_conn(last_attempt_seconds_ago=None)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json={"email": "new@example.com", "action": "signup"})
    assert r.status_code == 200


def test_resend_action_blocked_within_cooldown():
    conn, _ = _mock_conn(last_attempt_seconds_ago=5, count=1)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json={"email": "test@example.com", "action": "resend_verification"})
    assert r.status_code == 429
