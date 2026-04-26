"""Handles Supabase Auth webhooks to sync new users into Neon."""

import os
import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException
from db import get_conn, put_conn

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

WEBHOOK_SECRET = os.getenv("SUPABASE_WEBHOOK_SECRET", "")


def _verify_signature(body: bytes, signature: str) -> bool:
    expected = hmac.new(
        WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature.removeprefix("sha256="))


@router.post("/auth")
async def handle_auth_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("x-supabase-signature", "")

    if WEBHOOK_SECRET and not _verify_signature(body, sig):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()
    event_type = payload.get("type")

    if event_type == "user.created":
        user = payload.get("record", {})
        user_id = user.get("id")
        email = user.get("email", "")

        conn = get_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO public.profiles (user_id, email) VALUES (%s, %s) ON CONFLICT (user_id) DO NOTHING",
                (user_id, email),
            )
            conn.commit()
            cur.close()
        finally:
            put_conn(conn)

    return {"status": "ok"}
