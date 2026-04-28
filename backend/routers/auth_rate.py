"""Per-email rate limiting for auth email sends (signup, reset, resend)."""
import os
from datetime import datetime, timezone, timedelta
import psycopg2
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])

COOLDOWN_SECONDS = 60


class EmailRateLimitRequest(BaseModel):
    email: EmailStr
    action: str  # "signup" | "reset_password" | "resend_verification"


@router.post("/email-rate-limit")
def check_email_rate_limit(req: EmailRateLimitRequest):
    neon_url = os.environ.get("NEON_DATABASE_URL")
    if not neon_url:
        return {"allowed": True}

    key = req.email.lower()
    action = req.action
    now = datetime.now(timezone.utc)

    try:
        conn = psycopg2.connect(neon_url)
    except Exception:
        return {"allowed": True}

    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT last_attempt, attempt_count FROM public.rate_limits WHERE key = %s AND action = %s",
            (key, action),
        )
        row = cur.fetchone()

        if row:
            last_attempt, count = row
            elapsed = (now - last_attempt).total_seconds()
            if elapsed < COOLDOWN_SECONDS:
                retry_after = int(COOLDOWN_SECONDS - elapsed)
                return JSONResponse(
                    status_code=429,
                    content={"retry_after": retry_after, "message": f"Please wait {retry_after}s before requesting another email."},
                )
            cur.execute(
                "UPDATE public.rate_limits SET last_attempt = %s, attempt_count = attempt_count + 1 WHERE key = %s AND action = %s",
                (now, key, action),
            )
        else:
            cur.execute(
                """INSERT INTO public.rate_limits (key, action, action_type, last_attempt, attempt_count)
                   VALUES (%s, %s, %s, %s, 1)
                   ON CONFLICT (key, action) DO UPDATE
                   SET last_attempt = EXCLUDED.last_attempt,
                       attempt_count = public.rate_limits.attempt_count + 1""",
                (key, action, action, now),
            )

        conn.commit()
        cur.close()
    except Exception:
        return {"allowed": True}
    finally:
        conn.close()

    return {"allowed": True}
