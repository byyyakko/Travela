"""Tests for /moderation endpoints — human-gated review flow."""
import json
import pytest
from unittest.mock import patch, MagicMock, call
from fastapi.testclient import TestClient

from main import app
from middleware.auth import require_auth

client = TestClient(app)

REPORTER_ID = "reporter-123"
REPORTED_ID = "reported-456"
TEST_REPORT_UUID = "aaaabbbb-cccc-dddd-eeee-ffffffffffff"

# Global auth override
app.dependency_overrides[require_auth] = lambda: REPORTER_ID


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


def _neon_mocks(fetchone_value=(TEST_REPORT_UUID,)):
    """Return (get_conn patch, put_conn patch). fetchone returns the report UUID by default."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = fetchone_value
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
        """Convenience wrapper — patches AI and DB, suppresses review email."""
        if verdict is None:
            verdict = _make_verdict()
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=profanity), \
             patch("routers.moderation._analyse_conversation", return_value=verdict), \
             patch("routers.moderation._send_review_email"):
            return client.post("/moderation/report", json=payload or self.BASE_PAYLOAD)

    # ── Status routing ────────────────────────────────────────────────────────

    def test_dismissed_report(self):
        """Low confidence → dismissed."""
        resp = self._post(verdict=_make_verdict(violation=False, confidence=0.2))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "dismissed"
        assert data["action_taken"] is False
        assert data["confidence"] == pytest.approx(0.2, abs=0.01)

    def test_pending_report(self):
        """Medium confidence → pending."""
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.65, recommendation="review"))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data["action_taken"] is False

    def test_flagged_for_review_high_confidence(self):
        """Confidence ≥ 0.85 → flagged_for_review (NOT auto-banned)."""
        resp = self._post(verdict=_make_verdict(
            violation=True, confidence=0.90, recommendation="ban", categories=["harassment"]
        ))
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "flagged_for_review"
        assert data["action_taken"] is False
        assert "harassment" in data["categories"]

    def test_flagged_for_review_on_recommendation_ban(self):
        """recommendation='ban' → flagged_for_review even below 0.85 threshold."""
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.80, recommendation="ban"))
        assert resp.status_code == 200
        assert resp.json()["status"] == "flagged_for_review"

    def test_action_taken_always_false(self):
        """action_taken is always False — no account is ever auto-banned."""
        cases = [
            _make_verdict(violation=True,  confidence=0.95, recommendation="ban"),
            _make_verdict(violation=True,  confidence=0.65, recommendation="review"),
            _make_verdict(violation=False, confidence=0.10, recommendation="dismiss"),
        ]
        for verdict in cases:
            resp = self._post(verdict=verdict)
            assert resp.json()["action_taken"] is False, \
                f"action_taken was True for conf={verdict['confidence']}"

    # ── Human-gated review email ──────────────────────────────────────────────

    def test_send_review_email_called_on_flagged(self):
        """When status=flagged_for_review, _send_review_email is called with the report_id."""
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation",
                   return_value=_make_verdict(violation=True, confidence=0.90, recommendation="ban")), \
             patch("routers.moderation._send_review_email") as mock_email:
            resp = client.post("/moderation/report", json=self.BASE_PAYLOAD)

        assert resp.status_code == 200
        mock_email.assert_called_once()
        assert mock_email.call_args[0][0] == TEST_REPORT_UUID

    def test_review_email_not_called_on_pending(self):
        """Pending reports do not trigger an admin email."""
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation",
                   return_value=_make_verdict(violation=True, confidence=0.65, recommendation="review")), \
             patch("routers.moderation._send_review_email") as mock_email:
            client.post("/moderation/report", json=self.BASE_PAYLOAD)

        mock_email.assert_not_called()

    def test_no_auto_ban_on_submit(self):
        """_ban_supabase_user must never be called during report submission."""
        get_p, put_p = _neon_mocks()
        with get_p, put_p, \
             patch("routers.moderation._has_profanity", return_value=False), \
             patch("routers.moderation._analyse_conversation",
                   return_value=_make_verdict(violation=True, confidence=0.95, recommendation="ban")), \
             patch("routers.moderation._send_review_email"), \
             patch("routers.moderation._ban_supabase_user") as mock_ban:
            resp = client.post("/moderation/report", json=self.BASE_PAYLOAD)

        assert resp.status_code == 200
        mock_ban.assert_not_called()

    # ── Profanity ─────────────────────────────────────────────────────────────

    def test_profanity_nudges_confidence(self):
        """Profanity flag adds 0.05 to confidence when base > 0."""
        resp = self._post(
            profanity=True,
            verdict=_make_verdict(violation=True, confidence=0.50, recommendation="review"),
        )
        assert resp.json()["confidence"] == pytest.approx(0.55, abs=0.01)

    def test_profanity_no_nudge_when_confidence_zero(self):
        """Profanity flag does NOT nudge confidence when base is 0."""
        resp = self._post(profanity=True, verdict=_make_verdict(violation=False, confidence=0.0))
        assert resp.json()["confidence"] == pytest.approx(0.0, abs=0.001)

    def test_profanity_flag_in_response(self):
        resp = self._post(profanity=True)
        assert resp.json()["profanity_flagged"] is True

    # ── Validation / auth ─────────────────────────────────────────────────────

    def test_report_without_messages(self):
        """No messages field still processes."""
        resp = self._post(payload={"reported_user_id": REPORTED_ID, "reason": "spam"})
        assert resp.status_code == 200

    def test_cannot_report_self(self):
        """Reporter cannot report themselves — returns 400."""
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

    def test_flagged_message_text(self):
        resp = self._post(verdict=_make_verdict(violation=True, confidence=0.90, recommendation="ban"))
        msg = resp.json()["message"].lower()
        assert "team" in msg or "shortly" in msg

    def test_report_with_description(self):
        payload = {**self.BASE_PAYLOAD, "description": "This person harassed me repeatedly."}
        resp = self._post(payload=payload)
        assert resp.status_code == 200

    def test_categories_returned_on_flagged(self):
        cats = ["sexual_harassment", "vulgar_language"]
        resp = self._post(verdict=_make_verdict(
            violation=True, confidence=0.95, recommendation="ban", categories=cats
        ))
        assert set(resp.json()["categories"]) == set(cats)


# ── /moderation/admin/decide ─────────────────────────────────────────────────

class TestAdminDecide:
    """GET /moderation/admin/decide"""

    REPORT_ID = TEST_REPORT_UUID

    def _report_row(self, status="flagged_for_review"):
        return (REPORTED_ID, "harassment", 0.90, status)

    def _decide_neon(self, row):
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.fetchone.return_value = row
        return (
            patch("routers.moderation.get_conn", return_value=mock_conn),
            patch("routers.moderation.put_conn"),
        )

    def _valid_token(self, action: str) -> str:
        from routers.moderation import _sign_action_token
        return _sign_action_token(self.REPORT_ID, action)

    def test_invalid_token_returns_403(self):
        resp = client.get(
            f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=ban&token=badtoken123"
        )
        assert resp.status_code == 403

    def test_invalid_action_returns_400(self):
        token = self._valid_token("ban")  # valid HMAC but for wrong action
        resp = client.get(
            f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=hack&token={token}"
        )
        assert resp.status_code == 400

    def test_ban_bans_user_and_returns_200(self):
        token = self._valid_token("ban")
        get_p, put_p = self._decide_neon(self._report_row())
        with get_p, put_p, \
             patch("routers.moderation._get_user_email", return_value="bad@example.com"), \
             patch("routers.moderation._ban_supabase_user") as mock_ban, \
             patch("routers.moderation._block_email") as mock_block, \
             patch("routers.moderation._update_report_status") as mock_update:
            resp = client.get(
                f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=ban&token={token}"
            )

        assert resp.status_code == 200
        mock_ban.assert_called_once_with(REPORTED_ID)
        mock_block.assert_called_once()
        mock_update.assert_called_once_with(self.REPORT_ID, "auto_banned")

    def test_dismiss_dismisses_and_returns_200(self):
        token = self._valid_token("dismiss")
        get_p, put_p = self._decide_neon(self._report_row())
        with get_p, put_p, \
             patch("routers.moderation._update_report_status") as mock_update:
            resp = client.get(
                f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=dismiss&token={token}"
            )

        assert resp.status_code == 200
        mock_update.assert_called_once_with(self.REPORT_ID, "dismissed")

    def test_dismiss_does_not_ban(self):
        token = self._valid_token("dismiss")
        get_p, put_p = self._decide_neon(self._report_row())
        with get_p, put_p, \
             patch("routers.moderation._ban_supabase_user") as mock_ban, \
             patch("routers.moderation._update_report_status"):
            client.get(
                f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=dismiss&token={token}"
            )

        mock_ban.assert_not_called()

    def test_already_banned_is_idempotent(self):
        """Clicking confirm twice should not re-ban."""
        token = self._valid_token("ban")
        get_p, put_p = self._decide_neon(self._report_row(status="auto_banned"))
        with get_p, put_p, \
             patch("routers.moderation._ban_supabase_user") as mock_ban:
            resp = client.get(
                f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=ban&token={token}"
            )

        assert resp.status_code == 200
        mock_ban.assert_not_called()

    def test_already_dismissed_is_idempotent(self):
        """Clicking dismiss twice returns 200 and doesn't call update again."""
        token = self._valid_token("dismiss")
        get_p, put_p = self._decide_neon(self._report_row(status="dismissed"))
        with get_p, put_p, \
             patch("routers.moderation._update_report_status") as mock_update:
            resp = client.get(
                f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=dismiss&token={token}"
            )

        assert resp.status_code == 200
        mock_update.assert_not_called()

    def test_report_not_found_returns_404(self):
        token = self._valid_token("ban")
        get_p, put_p = self._decide_neon(None)
        with get_p, put_p:
            resp = client.get(
                f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=ban&token={token}"
            )
        assert resp.status_code == 404

    def test_response_is_html(self):
        token = self._valid_token("ban")
        get_p, put_p = self._decide_neon(self._report_row())
        with get_p, put_p, \
             patch("routers.moderation._get_user_email", return_value=""), \
             patch("routers.moderation._ban_supabase_user"), \
             patch("routers.moderation._block_email"), \
             patch("routers.moderation._update_report_status"):
            resp = client.get(
                f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=ban&token={token}"
            )
        assert "text/html" in resp.headers.get("content-type", "")

    def test_ban_response_mentions_banned(self):
        token = self._valid_token("ban")
        get_p, put_p = self._decide_neon(self._report_row())
        with get_p, put_p, \
             patch("routers.moderation._get_user_email", return_value=""), \
             patch("routers.moderation._ban_supabase_user"), \
             patch("routers.moderation._block_email"), \
             patch("routers.moderation._update_report_status"):
            resp = client.get(
                f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=ban&token={token}"
            )
        assert "ban" in resp.text.lower() or "suspend" in resp.text.lower()

    def test_token_is_action_specific(self):
        """A ban token cannot be used for dismiss and vice versa."""
        ban_token = self._valid_token("ban")
        resp = client.get(
            f"/moderation/admin/decide?report_id={self.REPORT_ID}&action=dismiss&token={ban_token}"
        )
        assert resp.status_code == 403


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


class TestSignToken:
    """_sign_action_token / _verify_action_token helpers."""

    def test_valid_token_verifies(self):
        from routers.moderation import _sign_action_token, _verify_action_token
        token = _sign_action_token("rep-id-1", "ban")
        assert _verify_action_token("rep-id-1", "ban", token) is True

    def test_wrong_action_fails(self):
        from routers.moderation import _sign_action_token, _verify_action_token
        token = _sign_action_token("rep-id-1", "ban")
        assert _verify_action_token("rep-id-1", "dismiss", token) is False

    def test_wrong_report_id_fails(self):
        from routers.moderation import _sign_action_token, _verify_action_token
        token = _sign_action_token("rep-id-1", "ban")
        assert _verify_action_token("rep-id-DIFFERENT", "ban", token) is False

    def test_tampered_token_fails(self):
        from routers.moderation import _verify_action_token
        assert _verify_action_token("rep-id-1", "ban", "deadbeef" * 8) is False
