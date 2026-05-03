"""Tests for /moderation endpoints — auto-ban flow."""
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from middleware.auth import require_auth

client = TestClient(app)

REPORTER_ID = "reporter-123"
REPORTED_ID = "reported-456"

@pytest.fixture(autouse=True, scope="module")
def _auth_override():
    app.dependency_overrides[require_auth] = lambda: REPORTER_ID
    yield
    app.dependency_overrides.pop(require_auth, None)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_verdict(violation=False, confidence=0.0, recommendation="dismiss", categories=None):
    return {
        "violation": violation,
        "severity": "none" if not violation else "high",
        "confidence": confidence,
        "categories": categories or [],
        "evidence_quotes": [],
        "recommendation": recommendation,
    }


def _neon_mocks():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value = mock_cursor
    return (
        patch("routers.moderation.get_conn", return_value=mock_conn),
        patch("routers.moderation.put_conn"),
    )


# ── /moderation/report ────────────────────────────────────────────────────────

class TestSubmitReport:
    """POST /moderation/report"""

    BASE_PAYLOAD = {
        "reported_user_id": REPORTED_ID,
        "reason": "harassment",
        "messages": [
            {"sender_id": REPORTED_ID, "content": "You're terrible"},
            {"sender_id": REPORTER_ID, "content": "Please stop"},
        ],
    }

    def _post(self, payload=None, *, profanity=False, verdict=None):
        if verdict is None:
            verdict = _make_verdict()
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=profanity), \
             patch("routers.moderation._analyse_conversation", return_value=verdict), \
             patch("routers.moderation._ban_supabase_user"), \
             patch("routers.moderation._get_user_email", return_value="reported@example.com"), \
             patch("routers.moderation._block_email"):
            return client.post("/moderation/report", json=payload or self.BASE_PAYLOAD)

    # ── Status routing ────────────────────────────────────────────────────────

    def test_dismissed_report(self):
        resp = self._post(verdict=_make_verdict(violation=False, confidence=0.2))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "dismissed"
        assert data["action_taken"] is False
        assert data["confidence"] == pytest.approx(0.2, abs=0.01)

    def test_pending_report(self):
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.65, recommendation="review"))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data["action_taken"] is False

    def test_auto_ban_high_confidence(self):
        """Confidence >= 0.85 → auto_banned immediately."""
        resp = self._post(verdict=_make_verdict(
            violation=True, confidence=0.90, recommendation="ban", categories=["harassment"]
        ))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "auto_banned"
        assert data["action_taken"] is True
        assert "harassment" in data["categories"]

    def test_auto_ban_on_recommendation_ban(self):
        """recommendation='ban' → auto_banned even below 0.85 threshold."""
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.80, recommendation="ban"))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "auto_banned"
        assert data["action_taken"] is True

    def test_action_taken_false_for_non_ban(self):
        cases = [
            _make_verdict(violation=True,  confidence=0.65, recommendation="review"),
            _make_verdict(violation=False, confidence=0.10, recommendation="dismiss"),
        ]
        for verdict in cases:
            resp = self._post(verdict=verdict)
            assert resp.json()["action_taken"] is False, \
                f"action_taken was True for conf={verdict['confidence']}"

    # ── Ban functions called ──────────────────────────────────────────────────

    def test_ban_functions_called_on_high_confidence(self):
        """_ban_supabase_user and _block_email must be called for auto_banned reports."""
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation",
                   return_value=_make_verdict(violation=True, confidence=0.90, recommendation="ban")), \
             patch("routers.moderation._get_user_email", return_value="bad@example.com"), \
             patch("routers.moderation._ban_supabase_user") as mock_ban, \
             patch("routers.moderation._block_email") as mock_block:
            resp = client.post("/moderation/report", json=self.BASE_PAYLOAD)

        assert resp.status_code == 200
        mock_ban.assert_called_once_with(REPORTED_ID)
        mock_block.assert_called_once()

    def test_ban_functions_not_called_on_pending(self):
        """Pending reports must not trigger a ban."""
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation",
                   return_value=_make_verdict(violation=True, confidence=0.65, recommendation="review")), \
             patch("routers.moderation._ban_supabase_user") as mock_ban, \
             patch("routers.moderation._get_user_email", return_value=""), \
             patch("routers.moderation._block_email") as mock_block:
            client.post("/moderation/report", json=self.BASE_PAYLOAD)

        mock_ban.assert_not_called()
        mock_block.assert_not_called()

    # ── Profanity ─────────────────────────────────────────────────────────────

    def test_profanity_nudges_confidence(self):
        resp = self._post(
            profanity=True,
            verdict=_make_verdict(violation=True, confidence=0.50, recommendation="review"),
        )
        assert resp.json()["confidence"] == pytest.approx(0.55, abs=0.01)

    def test_profanity_no_nudge_when_confidence_zero(self):
        resp = self._post(profanity=True, verdict=_make_verdict(violation=False, confidence=0.0))
        assert resp.json()["confidence"] == pytest.approx(0.0, abs=0.001)

    def test_profanity_flag_in_response(self):
        resp = self._post(profanity=True)
        assert resp.json()["profanity_flagged"] is True

    # ── Validation / auth ─────────────────────────────────────────────────────

    def test_report_without_messages(self):
        resp = self._post(payload={"reported_user_id": REPORTED_ID, "reason": "spam"})
        assert resp.status_code == 200

    def test_cannot_report_self(self):
        payload = {**self.BASE_PAYLOAD, "reported_user_id": REPORTER_ID}
        prev = app.dependency_overrides.get(require_auth)
        app.dependency_overrides[require_auth] = lambda: REPORTER_ID
        try:
            resp = self._post(payload=payload)
        finally:
            if prev is not None:
                app.dependency_overrides[require_auth] = prev
            else:
                app.dependency_overrides[require_auth] = lambda: REPORTER_ID
        assert resp.status_code == 400

    def test_missing_reason_returns_error(self):
        resp = self._post(payload={**self.BASE_PAYLOAD, "reason": ""})
        assert resp.status_code in (400, 422)

    def test_missing_reported_user_returns_422(self):
        resp = self._post(payload={"reason": "harassment"})
        assert resp.status_code == 422

    # ── Response shape ────────────────────────────────────────────────────────

    def test_response_has_required_fields(self):
        resp = self._post()
        assert resp.status_code == 200
        data = resp.json()
        for field in ("status", "action_taken", "confidence", "profanity_flagged", "categories", "message"):
            assert field in data, f"Missing field: {field}"

    def test_dismissed_message_text(self):
        resp = self._post(verdict=_make_verdict(confidence=0.1))
        assert "logged" in resp.json()["message"].lower()

    def test_pending_message_text(self):
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.65, recommendation="review"))
        assert "review" in resp.json()["message"].lower()

    def test_auto_banned_message_text(self):
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.90, recommendation="ban"))
        msg = resp.json()["message"].lower()
        assert "banned" in msg or "guidelines" in msg

    def test_report_with_description(self):
        payload = {**self.BASE_PAYLOAD, "description": "This person harassed me repeatedly."}
        resp = self._post(payload=payload)
        assert resp.status_code == 200

    def test_categories_returned_on_auto_banned(self):
        cats = ["sexual_harassment", "vulgar_language"]
        resp = self._post(verdict=_make_verdict(
            violation=True, confidence=0.95, recommendation="ban", categories=cats
        ))
        assert set(resp.json()["categories"]) == set(cats)


# ── /moderation/check-banned ─────────────────────────────────────────────────

class TestCheckBanned:
    """POST /moderation/check-banned"""

    def test_returns_false_when_not_banned(self):
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.fetchone.return_value = None
        with patch("routers.moderation.get_conn", return_value=mock_conn), \
             patch("routers.moderation.put_conn"), \
             patch("os.environ.get", return_value="postgresql://fake"):
            resp = client.post("/moderation/check-banned", json={"email": "clean@example.com"})
        assert resp.status_code == 200
        assert resp.json()["banned"] is False

    def test_returns_true_when_banned(self):
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.fetchone.return_value = ("banned@example.com",)
        with patch("routers.moderation.get_conn", return_value=mock_conn), \
             patch("routers.moderation.put_conn"), \
             patch("os.environ.get", return_value="postgresql://fake"):
            resp = client.post("/moderation/check-banned", json={"email": "banned@example.com"})
        assert resp.status_code == 200
        assert resp.json()["banned"] is True

    def test_email_lowercased(self):
        captured = []

        def fake_execute(sql, params):
            captured.append(params)

        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = fake_execute
        mock_conn.cursor.return_value.fetchone.return_value = None
        with patch("routers.moderation.get_conn", return_value=mock_conn), \
             patch("routers.moderation.put_conn"), \
             patch("os.environ.get", return_value="postgresql://fake"):
            client.post("/moderation/check-banned", json={"email": "UPPER@EXAMPLE.COM"})
        assert captured[0][0] == "upper@example.com"

    def test_no_neon_returns_false(self):
        with patch("os.environ.get", return_value=None):
            resp = client.post("/moderation/check-banned", json={"email": "any@example.com"})
        assert resp.status_code == 200
        assert resp.json()["banned"] is False

    def test_no_auth_required(self):
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.fetchone.return_value = None
        with patch("routers.moderation.get_conn", return_value=mock_conn), \
             patch("routers.moderation.put_conn"), \
             patch("os.environ.get", return_value="postgresql://fake"):
            resp = client.post("/moderation/check-banned", json={"email": "new@example.com"})
        assert resp.status_code == 200

    def test_db_error_returns_false(self):
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = Exception("DB down")
        with patch("routers.moderation.get_conn", return_value=mock_conn), \
             patch("routers.moderation.put_conn"), \
             patch("os.environ.get", return_value="postgresql://fake"):
            resp = client.post("/moderation/check-banned", json={"email": "test@example.com"})
        assert resp.status_code == 200
        assert resp.json()["banned"] is False


# ── Internal helpers ──────────────────────────────────────────────────────────

class TestProfanityScan:

    def test_only_scans_reported_user_messages(self):
        from routers.moderation import MessageItem, _profanity_scan_messages
        msgs = [
            MessageItem(sender_id="reporter", content="you bastard"),
            MessageItem(sender_id="reported", content="Clean message"),
        ]
        with patch("routers.moderation._has_profanity", return_value=False) as mock_check:
            _profanity_scan_messages(msgs, reporter_id="reporter")
        mock_check.assert_called_once_with("Clean message")

    def test_caps_at_20_messages(self):
        from routers.moderation import MessageItem, _profanity_scan_messages
        msgs = [MessageItem(sender_id="reported", content=f"msg {i}") for i in range(30)]
        with patch("routers.moderation._has_profanity", return_value=False) as mock_check:
            _profanity_scan_messages(msgs, reporter_id="reporter")
        assert mock_check.call_count == 20

    def test_returns_true_on_first_profane_message(self):
        from routers.moderation import MessageItem, _profanity_scan_messages
        msgs = [
            MessageItem(sender_id="reported", content="clean"),
            MessageItem(sender_id="reported", content="profane word"),
        ]
        with patch("routers.moderation._has_profanity", side_effect=[False, True]):
            assert _profanity_scan_messages(msgs, reporter_id="reporter") is True

    def test_returns_false_when_no_profanity(self):
        from routers.moderation import MessageItem, _profanity_scan_messages
        msgs = [MessageItem(sender_id="reported", content="nice message")]
        with patch("routers.moderation._has_profanity", return_value=False):
            assert _profanity_scan_messages(msgs, reporter_id="reporter") is False


class TestAnalyseConversation:

    def test_returns_default_on_json_parse_failure(self):
        from routers.moderation import _analyse_conversation
        mock_resp = MagicMock()
        mock_resp.content = [MagicMock(text="not valid json")]
        mock_claude = MagicMock()
        mock_claude.messages.create.return_value = mock_resp
        with patch("routers.moderation.get_claude", return_value=mock_claude):
            result = _analyse_conversation([], "harassment", "reporter")
        assert result["violation"] is False
        assert result["confidence"] == 0.0
        assert result["recommendation"] == "dismiss"

    def test_labels_messages_correctly(self):
        from routers.moderation import MessageItem, _analyse_conversation
        msgs = [
            MessageItem(sender_id="reporter-id", content="help"),
            MessageItem(sender_id="other-id",    content="bad stuff"),
        ]
        mock_resp = MagicMock()
        mock_resp.content = [MagicMock(text=json.dumps({
            "violation": False, "severity": "none", "confidence": 0.0,
            "categories": [], "evidence_quotes": [], "recommendation": "dismiss",
        }))]
        mock_claude = MagicMock()
        mock_claude.messages.create.return_value = mock_resp
        with patch("routers.moderation.get_claude", return_value=mock_claude):
            _analyse_conversation(msgs, "harassment", "reporter-id")
        prompt_text = mock_claude.messages.create.call_args[1]["messages"][0]["content"]
        assert "Reporter: help" in prompt_text
        assert "Reported User: bad stuff" in prompt_text

    def test_only_uses_last_50_messages(self):
        from routers.moderation import MessageItem, _analyse_conversation
        msgs = [MessageItem(sender_id="other", content=f"msg {i}") for i in range(60)]
        mock_resp = MagicMock()
        mock_resp.content = [MagicMock(text=json.dumps({
            "violation": False, "severity": "none", "confidence": 0.0,
            "categories": [], "evidence_quotes": [], "recommendation": "dismiss",
        }))]
        mock_claude = MagicMock()
        mock_claude.messages.create.return_value = mock_resp
        with patch("routers.moderation.get_claude", return_value=mock_claude):
            _analyse_conversation(msgs, "harassment", "reporter")
        prompt_text = mock_claude.messages.create.call_args[1]["messages"][0]["content"]
        assert "msg 9\n" not in prompt_text
        assert "msg 10" in prompt_text
        assert "msg 59" in prompt_text
