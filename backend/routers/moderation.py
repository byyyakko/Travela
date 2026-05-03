"""
Content moderation — report submission, AI verdict, and human-gated account banning.

Flow:
  1. Frontend submits report with conversation messages snapshot
  2. Claude Haiku runs quick profanity pre-scan on each message
  3. Claude Sonnet analyses full conversation for harassment/violations
  4. confidence >= 0.85 OR recommendation=="ban"
       → status = "flagged_for_review"
       → admin email sent to ADMIN_EMAIL with one-click confirm/dismiss links
  5. confidence 0.50–0.84 → "pending" (logged for manual review)
  6. confidence < 0.50    → "dismissed"

  Admin confirms via GET /moderation/admin/decide?report_id=…&action=ban&token=…
  Only then is the Supabase account banned and email blocked.
"""
import os
import json
import hmac
import hashlib
import httpx
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from middleware.auth import require_auth
from db import get_conn, put_conn
from routers.ai import get_claude

router = APIRouter(prefix="/moderation", tags=["moderation"])

AUTO_BAN_THRESHOLD = 0.85
FLAG_THRESHOLD     = 0.50
ADMIN_EMAIL        = "travelatheworld1123@gmail.com"


# ── Schemas ───────────────────────────────────────────────────────────────────

class MessageItem(BaseModel):
    sender_id: str
    content: str
    created_at: Optional[str] = None


class ReportRequest(BaseModel):
    reported_user_id: str
    conversation_id: Optional[str] = None
    messages: list[MessageItem] = []
    reason: str
    description: Optional[str] = None


class CheckBannedRequest(BaseModel):
    email: str


# ── Table bootstrap ───────────────────────────────────────────────────────────

def _ensure_tables():
    neon_url = os.environ.get("NEON_DATABASE_URL")
    if not neon_url:
        return
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public.reports (
                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                reporter_id      TEXT NOT NULL,
                reported_user_id TEXT NOT NULL,
                conversation_id  TEXT,
                messages_snapshot JSONB,
                reason           TEXT NOT NULL,
                description      TEXT,
                ai_verdict       BOOLEAN,
                ai_confidence    FLOAT,
                ai_categories    TEXT[],
                ai_evidence      JSONB,
                status           TEXT DEFAULT 'pending',
                created_at       TIMESTAMPTZ DEFAULT now()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public.banned_emails (
                email         TEXT PRIMARY KEY,
                user_id       TEXT,
                reason        TEXT,
                ai_confidence FLOAT,
                banned_at     TIMESTAMPTZ DEFAULT now()
            )
        """)
        conn.commit()
        cur.close()
    except Exception:
        pass
    finally:
        put_conn(conn)


_ensure_tables()


# ── HMAC token helpers (sign/verify admin decision URLs) ─────────────────────

def _sign_action_token(report_id: str, action: str) -> str:
    secret = os.environ.get("ADMIN_REVIEW_SECRET", "travela-review-secret").encode()
    msg = f"{report_id}:{action}".encode()
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def _verify_action_token(report_id: str, action: str, token: str) -> bool:
    expected = _sign_action_token(report_id, action)
    return hmac.compare_digest(expected, token)


# ── Profanity pre-scan (Claude Haiku) ────────────────────────────────────────

def _has_profanity(text: str) -> bool:
    if not text.strip():
        return False
    claude = get_claude()
    resp = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=20,
        system='Content moderation classifier. Respond ONLY with {"is_profane": true} or {"is_profane": false}.',
        messages=[{"role": "user", "content": text[:500]}],
    )
    raw = resp.content[0].text.strip()
    try:
        return json.loads(raw).get("is_profane", False)
    except Exception:
        return "true" in raw.lower()


def _profanity_scan_messages(messages: list[MessageItem], reporter_id: str) -> bool:
    reported_msgs = [m for m in messages if m.sender_id != reporter_id][:20]
    return any(_has_profanity(m.content) for m in reported_msgs)


# ── Deep Claude Sonnet analysis ───────────────────────────────────────────────

_MODERATION_SYSTEM = """You are a content moderation AI for Travela, a travel social app connecting travellers with locals.
Analyse the conversation for violations:
- Sexual harassment or explicit sexual content directed at someone
- Vulgar, threatening, or abusive language
- Hate speech or discrimination (race, gender, nationality, religion)
- Sustained harassment or bullying behaviour

Label each message sender as "Reporter" or "Reported User" — only judge the Reported User's messages.

Return ONLY valid JSON — no markdown, no explanation:
{"violation": false, "severity": "none", "confidence": 0.0, "categories": [], "evidence_quotes": [], "recommendation": "dismiss"}

Fields:
- violation: true | false
- severity: "none" | "low" | "medium" | "high"
- confidence: 0.0 – 1.0 (certainty that a violation occurred)
- categories: array from ["sexual_harassment", "vulgar_language", "threats", "hate_speech", "harassment", "spam"]
- evidence_quotes: up to 3 direct quotes from Reported User messages that constitute evidence
- recommendation: "ban" | "review" | "dismiss"
"""


def _analyse_conversation(messages: list[MessageItem], reason: str, reporter_id: str) -> dict:
    formatted = []
    for m in messages[-50:]:
        label = "Reporter" if m.sender_id == reporter_id else "Reported User"
        formatted.append(f"{label}: {m.content}")

    conversation_text = "\n".join(formatted) if formatted else "(no messages provided)"

    claude = get_claude()
    resp = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        system=_MODERATION_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"Report reason: {reason}\n\nConversation:\n{conversation_text}",
        }],
    )
    raw = resp.content[0].text.strip()
    try:
        return json.loads(raw)
    except Exception:
        return {
            "violation": False, "severity": "none", "confidence": 0.0,
            "categories": [], "evidence_quotes": [], "recommendation": "dismiss",
        }


# ── Supabase helpers ──────────────────────────────────────────────────────────

def _supabase_headers() -> dict:
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_OWN_SERVICE_KEY", "")
    return {"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"}


def _get_user_email(user_id: str) -> str:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("SUPABASE_OWN_URL", "")
    if not url:
        return ""
    try:
        resp = httpx.get(
            f"{url}/auth/v1/admin/users/{user_id}",
            headers=_supabase_headers(),
            timeout=10,
        )
        if resp.is_success:
            return resp.json().get("email", "")
    except Exception:
        pass
    return ""


def _ban_supabase_user(user_id: str):
    url = os.environ.get("SUPABASE_URL") or os.environ.get("SUPABASE_OWN_URL", "")
    if not url:
        return
    try:
        httpx.patch(
            f"{url}/auth/v1/admin/users/{user_id}",
            headers=_supabase_headers(),
            json={"ban_duration": "876000h"},
            timeout=10,
        )
    except Exception:
        pass


def _block_email(user_id: str, email: str, reason: str, confidence: float):
    if not email:
        return
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.banned_emails (email, user_id, reason, ai_confidence)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (email) DO NOTHING""",
            (email.lower(), user_id, reason, confidence),
        )
        conn.commit()
        cur.close()
    except Exception:
        pass
    finally:
        put_conn(conn)


# ── Neon report persistence ───────────────────────────────────────────────────

def _save_report(reporter_id: str, req: ReportRequest, verdict: dict, status: str) -> Optional[str]:
    """Persist the report and return its UUID, or None on failure."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.reports
               (reporter_id, reported_user_id, conversation_id, messages_snapshot,
                reason, description, ai_verdict, ai_confidence, ai_categories, ai_evidence, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id""",
            (
                reporter_id,
                req.reported_user_id,
                req.conversation_id,
                json.dumps([m.model_dump() for m in req.messages]),
                req.reason,
                req.description,
                verdict.get("violation"),
                verdict.get("confidence"),
                verdict.get("categories", []),
                json.dumps(verdict.get("evidence_quotes", [])),
                status,
            ),
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        return str(row[0]) if row else None
    except Exception:
        return None
    finally:
        put_conn(conn)


def _update_report_status(report_id: str, status: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE public.reports SET status = %s WHERE id = %s",
            (status, report_id),
        )
        conn.commit()
        cur.close()
    except Exception:
        pass
    finally:
        put_conn(conn)


# ── Admin review email (Resend API) ──────────────────────────────────────────

def _send_review_email(report_id: str, req: ReportRequest, verdict: dict, confidence: float):
    """Send a human-review email to the admin via Resend. Fails silently."""
    resend_key = os.environ.get("RESEND_API_KEY", "")
    if not resend_key:
        print(f"[moderation] RESEND_API_KEY not set — review email skipped (report {report_id})")
        return

    backend_url  = os.environ.get("BACKEND_URL", "https://travela-backend-p2zp.onrender.com")
    from_email   = os.environ.get("RESEND_FROM_EMAIL", "moderation@travela.app")
    ban_token     = _sign_action_token(report_id, "ban")
    dismiss_token = _sign_action_token(report_id, "dismiss")
    confirm_url   = f"{backend_url}/moderation/admin/decide?report_id={report_id}&action=ban&token={ban_token}"
    dismiss_url   = f"{backend_url}/moderation/admin/decide?report_id={report_id}&action=dismiss&token={dismiss_token}"

    categories_str = ", ".join(verdict.get("categories", [])) or "—"
    evidence       = verdict.get("evidence_quotes", [])
    evidence_html  = "".join(
        f'<blockquote style="border-left:3px solid #dc2626;margin:8px 0;padding:8px 12px;'
        f'background:#fff5f5;color:#7f1d1d;font-style:italic;">{q}</blockquote>'
        for q in evidence[:3]
    ) if evidence else '<p style="color:#9ca3af;font-style:italic;">No direct quotes captured.</p>'

    description_section = (
        f'<p><strong>Reporter note:</strong> {req.description}</p>'
        if req.description else ""
    )

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#dc2626;padding:24px 32px;">
      <h1 style="color:white;margin:0;font-size:20px;font-weight:700;">🚨 Report Flagged for Review</h1>
      <p style="color:#fca5a5;margin:4px 0 0;font-size:14px;">Travela Moderation · Action required</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">

      <!-- Metrics row -->
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">AI Confidence</div>
          <div style="font-size:28px;font-weight:800;color:#dc2626;">{confidence:.0%}</div>
        </div>
        <div style="flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Reported For</div>
          <div style="font-size:15px;font-weight:700;color:#111827;margin-top:4px;">{req.reason.replace("_", " ").title()}</div>
        </div>
      </div>

      <!-- Categories -->
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:6px;">Violation Categories</div>
        <div style="font-size:14px;color:#111827;">{categories_str}</div>
      </div>

      {description_section}

      <!-- Evidence -->
      <div style="margin-bottom:28px;">
        <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:8px;">AI Evidence Quotes</div>
        {evidence_html}
      </div>

      <!-- Action buttons -->
      <div style="display:flex;gap:12px;">
        <a href="{confirm_url}"
           style="flex:1;display:block;background:#dc2626;color:white;text-align:center;
                  padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          ✅ Confirm Ban
        </a>
        <a href="{dismiss_url}"
           style="flex:1;display:block;background:#6b7280;color:white;text-align:center;
                  padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          ❌ Dismiss
        </a>
      </div>

      <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:20px;">
        Report ID: {report_id}<br>
        These links are unique to this report. Each can only be acted on once.
      </p>
    </div>
  </div>
</body>
</html>"""

    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
            json={
                "from": from_email,
                "to": [ADMIN_EMAIL],
                "subject": f"[Travela] Report flagged — {confidence:.0%} AI confidence · {req.reason.replace('_', ' ').title()}",
                "html": html,
            },
            timeout=15,
        )
        print(f"[moderation] Review email sent for report {report_id}")
    except Exception as e:
        print(f"[moderation] Failed to send review email: {e}")


# ── HTML helpers for admin decision page ─────────────────────────────────────

def _decision_page(title: str, body: str, color: str = "#16a34a") -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
             background:#f3f4f6;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;">
  <div style="background:white;border-radius:12px;padding:48px 40px;max-width:480px;width:100%;
              text-align:center;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="width:64px;height:64px;border-radius:50%;background:{color}20;
                display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;">
      {'✅' if color == '#16a34a' else '✅' if color == '#dc2626' else '⚠️'}
    </div>
    <h2 style="margin:0 0 8px;color:#111827;">{title}</h2>
    <p style="color:#6b7280;margin:0;">{body}</p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Travela Moderation</p>
  </div>
</body>
</html>"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/report")
async def submit_report(req: ReportRequest, reporter_id: str = Depends(require_auth)):
    if not req.reported_user_id or not req.reason:
        raise HTTPException(status_code=422, detail="reported_user_id and reason are required")

    if req.reported_user_id == reporter_id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    # Step 1: Profanity pre-scan (Claude Haiku)
    profanity_flagged = _profanity_scan_messages(req.messages, reporter_id)

    # Step 2: Deep conversation analysis (Claude Sonnet)
    verdict = _analyse_conversation(req.messages, req.reason, reporter_id)

    # Profanity signal nudges confidence slightly when both agree
    if profanity_flagged and verdict.get("confidence", 0) > 0:
        verdict["confidence"] = min(1.0, verdict["confidence"] + 0.05)

    confidence     = verdict.get("confidence", 0.0)
    recommendation = verdict.get("recommendation", "dismiss")

    # Step 3: Route by confidence — high-confidence cases go to human review
    if confidence >= AUTO_BAN_THRESHOLD or recommendation == "ban":
        status = "flagged_for_review"
    elif confidence >= FLAG_THRESHOLD:
        status = "pending"
    else:
        status = "dismissed"

    # Step 4: Persist to Neon (get report_id for email links)
    report_id = _save_report(reporter_id, req, verdict, status)

    # Step 5: Send admin review email for high-confidence cases
    if status == "flagged_for_review" and report_id:
        _send_review_email(report_id, req, verdict, confidence)

    return {
        "status": status,
        "action_taken": False,  # no account is ever banned without admin confirmation
        "confidence": round(confidence, 3),
        "profanity_flagged": profanity_flagged,
        "categories": verdict.get("categories", []),
        "message": (
            "Our AI has flagged this account for serious violations. "
            "Our team will review the evidence and take action shortly."
            if status == "flagged_for_review"
            else "Your report is under review. We'll take action if a violation is confirmed."
            if status == "pending"
            else "Your report has been logged. Thank you for helping keep Travela safe."
        ),
    }


@router.get("/admin/decide", response_class=HTMLResponse)
def admin_decide(report_id: str, action: str, token: str):
    """One-click admin decision link sent in review emails."""
    if action not in ("ban", "dismiss"):
        return HTMLResponse(_decision_page("Invalid Action", "Unknown action requested."), status_code=400)

    if not _verify_action_token(report_id, action, token):
        return HTMLResponse(
            _decision_page("Invalid Link", "This link is invalid or has been tampered with.", color="#dc2626"),
            status_code=403,
        )

    # Look up the report
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT reported_user_id, reason, ai_confidence, status FROM public.reports WHERE id = %s",
            (report_id,),
        )
        row = cur.fetchone()
        cur.close()
    except Exception:
        put_conn(conn)
        return HTMLResponse(
            _decision_page("Database Error", "Could not look up the report. Please try again.", color="#f59e0b"),
            status_code=500,
        )
    finally:
        put_conn(conn)

    if not row:
        return HTMLResponse(
            _decision_page("Not Found", "This report could not be found."), status_code=404
        )

    reported_user_id, reason, ai_confidence, current_status = row

    # Idempotency — already actioned
    if current_status == "auto_banned":
        return HTMLResponse(_decision_page("Already Banned", "This account was already banned."))
    if current_status == "dismissed" and action == "dismiss":
        return HTMLResponse(_decision_page("Already Dismissed", "This report was already dismissed."))

    if action == "ban":
        reported_email = _get_user_email(reported_user_id)
        _ban_supabase_user(reported_user_id)
        _block_email(reported_user_id, reported_email, reason, ai_confidence or 0.0)
        _update_report_status(report_id, "auto_banned")
        return HTMLResponse(_decision_page(
            "Account Banned",
            f"The account has been suspended and the email blocked from re-registration.",
            color="#dc2626",
        ))
    else:
        _update_report_status(report_id, "dismissed")
        return HTMLResponse(_decision_page(
            "Report Dismissed",
            "The report has been dismissed. No action will be taken.",
            color="#6b7280",
        ))


@router.post("/check-banned")
def check_banned(req: CheckBannedRequest):
    """Check if an email is banned. Called pre-signup — no auth required."""
    neon_url = os.environ.get("NEON_DATABASE_URL")
    if not neon_url:
        return {"banned": False}
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT email FROM public.banned_emails WHERE email = %s",
            (req.email.lower(),),
        )
        row = cur.fetchone()
        cur.close()
        return {"banned": row is not None}
    except Exception:
        return {"banned": False}
    finally:
        put_conn(conn)
