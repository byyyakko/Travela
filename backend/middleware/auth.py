"""Supabase JWT validation for FastAPI routes."""

import base64
import json
import os
import time
from fastapi import Request, HTTPException
import httpx


SUPABASE_AUTH_TIMEOUT_SECONDS = 8


def _decode_jwt_payload(token: str) -> dict:
    """Decode JWT payload without signature verification. Raises ValueError on malformed tokens."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed JWT")
    payload_b64 = parts[1]
    # Pad to multiple of 4
    payload_b64 += "=" * (-len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(payload_b64))


async def require_auth(request: Request) -> str:
    """Validate a Supabase Bearer JWT and return its user_id."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header.removeprefix("Bearer ")

    try:
        payload = _decode_jwt_payload(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    exp = payload.get("exp")
    if exp and time.time() > exp:
        raise HTTPException(status_code=401, detail="Token expired")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("SUPABASE_OWN_URL")
    supabase_key = (
        os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_OWN_ANON_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_OWN_SERVICE_KEY")
    )
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Auth service not configured")

    try:
        async with httpx.AsyncClient(timeout=SUPABASE_AUTH_TIMEOUT_SECONDS) as client:
            resp = await client.get(
                f"{supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {token}",
                },
            )
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service unavailable")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        auth_user_id = resp.json().get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if auth_user_id != user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user_id
