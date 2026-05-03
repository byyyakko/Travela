"""Tests for /moderation endpoints."""
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from middleware.auth import require_auth

client = TestClient(app)

REPORTER_ID = "reporter-123"
REPORTED_ID = "reported-456"

# Global auth override — all tests run as REPORTER_ID unless overridden
app.dependency_overrides[require_auth] = lambda: REPORTER_ID


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_verdict(violation=False, confidence=0.0, recommendation="dismiss", categories=None):
    return {
        "violation": violation,
        "severity": "none" if not violation else "high",
        "confidence": confidence,
        "categories": categories or [],
        "evidence_quotes": [],
        "recommendation": recommendation,
    }


def _neon_mocks(banned_row=None):
    """Return (get_conn patch, put_conn patch) with sensible cursor defaults."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = banned_row
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
             patch("routers.moderation._analyse_conversation", return_value=verdict):
            return client.post("/moderation/report", json=payload or self.BASE_PAYLOAD)

    def test_dismissed_report(self):
        """Low confidence → dismissed, no ban."""
        resp = self._post(verdict=_make_verdict(violation=False, confidence=0.2))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "dismissed"
        assert data["action_taken"] is False
        assert data["confidence"] == pytest.approx(0.2, abs=0.01)

    def test_pending_report(self):
        """Medium confidence → pending, no ban."""
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.65, recommendation="review"))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data["action_taken"] is False

    def test_auto_ban_high_confidence(self):
        """Confidence >= 0.85 → auto_banned, ban helpers called."""
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation",
                   return_value=_make_verdict(violation=True, confidence=0.90,
                                              recommendation="ban", categories=["harassment"])), \
             patch("routers.moderation._get_user_email", return_value="bad@example.com") as mock_email, \
             patch("routers.moderation._ban_supabase_user") as mock_ban, \
             patch("routers.moderation._block_email") as mock_block:
            resp = client.post("/moderation/report", json=self.BASE_PAYLOAD)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "auto_banned"
        assert data["action_taken"] is True
        assert "harassment" in data["categories"]
        mock_email.assert_called_once_with(REPORTED_ID)
        mock_ban.assert_called_once_with(REPORTED_ID)
        mock_block.assert_called_once()

    def test_auto_ban_on_recommendation_ban(self):
        """recommendation='ban' triggers auto-ban even below 0.85 threshold."""
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation",
                   return_value=_make_verdict(violation=True, confidence=0.80, recommendation="ban")), \
             patch("routers.moderation._get_user_email", return_value=""), \
             patch("routers.moderation._ban_supabase_user") as mock_ban, \
             patch("routers.moderation._block_email"):
            resp = client.post("/moderation/report", json=self.BASE_PAYLOAD)

        assert resp.status_code == 200
        assert resp.json()["status"] == "auto_banned"
        mock_ban.assert_called_once()

    def test_profanity_nudges_confidence(self):
        """Profanity flag adds 0.05 to confidence when base > 0."""
        resp = self._post(
            profanity=True,
            verdict=_make_verdict(violation=True, confidence=0.50, recommendation="review"),
        )
        assert resp.json()["confidence"] == pytest.approx(0.55, abs=0.01)

    def test_profanity_no_nudge_when_confidence_zero(self):
        """Profanity flag must NOT nudge confidence when base confidence is 0."""
        resp = self._post(profanity=True, verdict=_make_verdict(violation=False, confidence=0.0))
        assert resp.json()["confidence"] == pytest.approx(0.0, abs=0.001)

    def test_profanity_flag_in_response(self):
        """profanity_flagged echoed back correctly."""
        resp = self._post(profanity=True)
        assert resp.json()["profanity_flagged"] is True

    def test_report_without_messages(self):
        """Report with no messages still processes."""
        payload = {"reported_user_id": REPORTED_ID, "reason": "spam"}
        resp = self._post(payload=payload)
        assert resp.status_code == 200

    def test_cannot_report_self(self):
        """Reporter cannot report themselves — returns 400."""
        payload = {**self.BASE_PAYLOAD, "reported_user_id": REPORTER_ID}
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation", return_value=_make_verdict()):
            resp = client.post("/moderation/report", json=payload)
        assert resp.status_code == 400

    def test_missing_reason_returns_error(self):
        """Empty reason field is rejected."""
        payload = {**self.BASE_PAYLOAD, "reason": ""}
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation", return_value=_make_verdict()):
            resp = client.post("/moderation/report", json=payload)
        assert resp.status_code in (400, 422)

    def test_missing_reported_user_returns_422(self):
        """Missing reported_user_id field returns 422 (Pydantic validation)."""
        payload = {"reason": "harassment"}
        resp = self._post(payload=payload)
        assert resp.status_code == 422

    def test_response_has_required_fields(self):
        """Response always includes all required fields."""
        resp = self._post()
        assert resp.status_code == 200
        data = resp.json()
        for field in ("status", "action_taken", "confidence", "profanity_flagged", "categories", "message"):
            assert field in data, f"Missing field: {field}"

    def test_dismissed_message_text(self):
        """Dismissed report returns the correct message text."""
        resp = self._post(verdict=_make_verdict(confidence=0.1))
        assert resp.status_code == 200
        assert "logged" in resp.json()["message"].lower()

    def test_pending_message_text(self):
        """Pending report returns the review message text."""
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.65, recommendation="review"))
        assert "review" in resp.json()["message"].lower()

    def test_report_with_description(self):
        """Optional description is accepted without error."""
        payload = {**self.BASE_PAYLOAD, "description": "This person harassed me repeatedly."}
        resp = self._post(payload=payload)
        assert resp.status_code == 200

    def test_categories_returned_on_ban(self):
        """Violation categories are included in the auto-ban response."""
        get_p, put_p = _neon_mocks()
        cats = ["sexual_harassment", "vulgar_language"]
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation",
                   return_value=_make_verdict(violation=True, confidence=0.95,
                                              recommendation="ban", categories=cats)), \
             patch("routers.moderation._get_user_email", return_value=""), \
             patch("routers.moderation._ban_supabase_user"), \
             patch("routers.moderation._block_email"):
            resp = client.post("/moderation/report", json=self.BASE_PAYLOAD)

        assert set(resp.json()["categories"]) == set(cats)


# ── /moderation/check-banned ─────────────────────────────────────────────────

class TestCheckBanned:
    """POST /moderation/check-banned"""

    def test_returns_false_when_not_banned(self):
        """Unknown email returns banned=false."""
        get_p, put_p = _neon_mocks(banned_row=None)
        with get_p, put_p, patch("os.environ.get", return_value="postgresql://fake"):
            resp = client.post("/moderation/check-banned", json={"email": "clean@example.com"})
        assert resp.status_code == 200
        assert resp.json()["banned"] is False

    def test_returns_true_when_banned(self):
        """Banned email returns banned=true."""
        get_p, put_p = _neon_mocks(banned_row=("banned@example.com",))
        with get_p, put_p, patch("os.environ.get", return_value="postgresql://fake"):
            resp = client.post("/moderation/check-banned", json={"email": "banned@example.com"})
        assert resp.status_code == 200
        assert resp.json()["banned"] is True

    def test_email_lowercased(self):
        """Email lookup is case-insensitive (stored lowercase)."""
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
        """When NEON_DATABASE_URL is not set, returns banned=false (safe default)."""
        with patch("os.environ.get", return_value=None):
            resp = client.post("/moderation/check-banned", json={"email": "any@example.com"})
        assert resp.status_code == 200
        assert resp.json()["banned"] is False

    def test_no_auth_required(self):
        """check-banned is a public endpoint — no auth header needed."""
        get_p, put_p = _neon_mocks(banned_row=None)
        with get_p, put_p, patch("os.environ.get", return_value="postgresql://fake"):
            resp = client.post("/moderation/check-banned", json={"email": "new@example.com"})
        assert resp.status_code == 200

    def test_db_error_returns_false(self):
        """DB exception returns banned=false (safe default)."""
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.execute.side_effect = Exception("DB down")
        with patch("routers.moderation.get_conn", return_value=mock_conn), \
             patch("routers.moderation.put_conn"), \
             patch("os.environ.get", return_value="postgresql://fake"):
            resp = client.post("/moderation/check-banned", json={"email": "test@example.com"})
        assert resp.status_code == 200
        assert resp.json()["banned"] is False


# ── Internal helper unit tests ────────────────────────────────────────────────

class TestProfanityScan:
    """_profanity_scan_messages helper."""

    def test_only_scans_reported_user_messages(self):
        """Only messages from the reported user (not reporter) are scanned."""
        from routers.moderation import MessageItem, _profanity_scan_messages

        msgs = [
            MessageItem(sender_id="reporter", content="You're awful"),
            MessageItem(sender_id="reported", content="Clean message"),
        ]
        with patch("routers.moderation._has_profanity", return_value=False) as mock_check:
            _profanity_scan_messages(msgs, reporter_id="reporter")

        mock_check.assert_called_once_with("Clean message")

    def test_caps_at_20_messages(self):
        """Only first 20 reported-user messages are scanned."""
        from routers.moderation import MessageItem, _profanity_scan_messages

        msgs = [MessageItem(sender_id="reported", content=f"msg {i}") for i in range(30)]
        with patch("routers.moderation._has_profanity", return_value=False) as mock_check:
            _profanity_scan_messages(msgs, reporter_id="reporter")

        assert mock_check.call_count == 20

    def test_returns_true_on_first_profane_message(self):
        """Returns True as soon as any message is profane."""
        from routers.moderation import MessageItem, _profanity_scan_messages

        msgs = [
            MessageItem(sender_id="reported", content="clean"),
            MessageItem(sender_id="reported", content="profane word"),
        ]
        with patch("routers.moderation._has_profanity", side_effect=[False, True]):
            result = _profanity_scan_messages(msgs, reporter_id="reporter")

        assert result is True

    def test_returns_false_when_no_profanity(self):
        """Returns False when no messages are profane."""
        from routers.moderation import MessageItem, _profanity_scan_messages

        msgs = [MessageItem(sender_id="reported", content="nice message")]
        with patch("routers.moderation._has_profanity", return_value=False):
            result = _profanity_scan_messages(msgs, reporter_id="reporter")

        assert result is False


class TestAnalyseConversation:
    """_analyse_conversation helper."""

    def test_returns_default_on_json_parse_failure(self):
        """Malformed AI response returns safe default dict."""
        from routers.moderation import MessageItem, _analyse_conversation

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
        """Reporter messages labelled 'Reporter', others labelled 'Reported User'."""
        from routers.moderation import MessageItem, _analyse_conversation

        msgs = [
            MessageItem(sender_id="reporter-id", content="help"),
            MessageItem(sender_id="other-id", content="bad stuff"),
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
        """Only the last 50 messages are included in the prompt."""
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
        assert "msg 9\n" not in prompt_text   # msg 9 (index 9) is excluded
        assert "msg 10" in prompt_text      # msg 10 (index 10) is the first kept
        assert "msg 59" in prompt_text      # last message included
