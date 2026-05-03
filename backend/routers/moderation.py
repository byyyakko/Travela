"""
Content moderation — report submission, AI verdict, and account banning.

Flow:
  1. Frontend submits report with conversation messages snapshot
  2. Claude Haiku runs quick profanity pre-scan on each message
  3. Claude Sonnet analyses full conversation for harassment/violations
  4. confidence >= 0.85 → auto-ban (Supabase Admin API + blocked email in Neon)
  5. confidence 0.50–0.84 → flag for review (status = "pending")
  6. confidence < 0.50  → log only (status = "dismissed")
"""
import os
import json
import httpx
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.auth import require_auth
from db import get_conn, put_conn
from routers.ai import get_claude

router = APIRouter(prefix="/moderation", tags=["moderation"])

AUTO_BAN_THRESHOLD = 0.85
FLAG_THRESHOLD = 0.50


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


# ── Profanity pre-scan (Claude Haiku — same model as /utils/profanity) ────────

def _has_profanity(text: str) -> bool:
    """Quick claude-haiku-4-5 profanity check. Mirrors /utils/profanity logic."""
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
    """Returns True if any message from the reported user contains profanity."""
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
    """Claude Sonnet deep analysis of the last 50 conversation messages."""
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
    """Fetch user email via Supabase Admin API."""
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
    """Set ban_duration to 876000h (~100 years) via Supabase Admin API."""
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
    """Add email to banned_emails in Neon to block re-registration."""
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

def _save_report(reporter_id: str, req: ReportRequest, verdict: dict, status: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.reports
               (reporter_id, reported_user_id, conversation_id, messages_snapshot,
                reason, description, ai_verdict, ai_confidence, ai_categories, ai_evidence, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
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
        conn.commit()
        cur.close()
    except Exception:
        pass
    finally:
        put_conn(conn)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/report")
async def submit_report(req: ReportRequest, reporter_id: str = Depends(require_auth)):
    if not req.reported_user_id or not req.reason:
        raise HTTPException(status_code=422, detail="reported_user_id and reason are required")

    if req.reported_user_id == reporter_id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    # Step 1: Profanity pre-scan using Claude Haiku (same engine as /utils/profanity)
    profanity_flagged = _profanity_scan_messages(req.messages, reporter_id)

    # Step 2: Deep Claude Sonnet conversation analysis
    verdict = _analyse_conversation(req.messages, req.reason, reporter_id)

    # Profanity signal nudges confidence up slightly when both agree
    if profanity_flagged and verdict.get("confidence", 0) > 0:
        verdict["confidence"] = min(1.0, verdict["confidence"] + 0.05)

    confidence = verdict.get("confidence", 0.0)
    recommendation = verdict.get("recommendation", "dismiss")

    # Step 3: Determine action based on confidence threshold
    if confidence >= AUTO_BAN_THRESHOLD or recommendation == "ban":
        status = "auto_banned"
        reported_email = _get_user_email(req.reported_user_id)
        _ban_supabase_user(req.reported_user_id)
        _block_email(req.reported_user_id, reported_email, req.reason, confidence)
    elif confidence >= FLAG_THRESHOLD:
        status = "pending"
    else:
        status = "dismissed"

    # Step 4: Persist report to Neon
    _save_report(reporter_id, req, verdict, status)

    return {
        "status": status,
        "action_taken": status == "auto_banned",
        "confidence": round(confidence, 3),
        "profanity_flagged": profanity_flagged,
        "categories": verdict.get("categories", []),
        "message": (
            "This account has been suspended based on our AI review."
            if status == "auto_banned"
            else "Your report is under review. We'll take action if a violation is confirmed."
            if status == "pending"
            else "Your report has been logged. Thank you for helping keep Travela safe."
        ),
    }


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
