"""Handles Supabase Auth webhooks to sync new users into Neon."""
import os, hmac, hashlib, json
import psycopg2
from fastapi import APIRouter, Request, HTTPException

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
WEBHOOK_SECRET = os.getenv("SUPABASE_WEBHOOK_SECRET", "")


def _verify_signature(body: bytes, signature: str) -> bool:
    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.removeprefix("sha256="))


@router.post("/auth")
async def handle_auth_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("x-supabase-signature", "")
    if WEBHOOK_SECRET and not _verify_signature(body, sig):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = json.loads(body)
    if payload.get("type") != "user.created":
        return {"status": "ok"}

    user = payload.get("record", {})
    new_user_id = user.get("id")
    email = user.get("email", "")

    neon_url = os.environ["NEON_DATABASE_URL"]
    conn = psycopg2.connect(neon_url)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.profiles WHERE email = %s LIMIT 1",
            (email,)
        )
        existing = cur.fetchone()

        if existing:
            cur.execute(
                """UPDATE public.profiles
                   SET user_id = %s, migration_linked = TRUE
                   WHERE email = %s""",
                (new_user_id, email)
            )
        else:
            cur.execute(
                """INSERT INTO public.profiles (user_id, email)
                   VALUES (%s, %s)
                   ON CONFLICT (user_id) DO NOTHING""",
                (new_user_id, email)
            )
        conn.commit()
        cur.close()
    finally:
        conn.close()

    return {"status": "ok"}
