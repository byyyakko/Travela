"""Tests for auth webhook re-linking logic."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

NEW_USER_PAYLOAD = {
    "type": "user.created",
    "record": {"id": "new-uuid-9999", "email": "alice@example.com"}
}


def test_webhook_returns_ok_on_unknown_type():
    r = client.post("/webhooks/auth", json={"type": "user.deleted", "record": {}})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_webhook_user_created_returns_ok():
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    mock_cur.fetchone.return_value = None
    with patch("psycopg2.connect", return_value=mock_conn):
        r = client.post("/webhooks/auth", json=NEW_USER_PAYLOAD)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_webhook_relinks_existing_profile_by_email():
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    mock_cur.fetchone.return_value = ("old-uuid-1234",)
    with patch("psycopg2.connect", return_value=mock_conn):
        r = client.post("/webhooks/auth", json=NEW_USER_PAYLOAD)
    assert r.status_code == 200
    calls = [str(call) for call in mock_cur.execute.call_args_list]
    assert any("UPDATE" in c for c in calls)


def test_webhook_inserts_new_profile_when_no_match():
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    mock_cur.fetchone.return_value = None
    with patch("psycopg2.connect", return_value=mock_conn):
        r = client.post("/webhooks/auth", json=NEW_USER_PAYLOAD)
    assert r.status_code == 200
    calls = [str(call) for call in mock_cur.execute.call_args_list]
    assert any("INSERT" in c for c in calls)
