"""Supabase JWT validation for FastAPI routes."""

import base64
import json
import time
from fastapi import Request, HTTPException


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
    """Extract user_id from Bearer JWT. Checks expiry but does not verify signature."""
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

    return user_id
