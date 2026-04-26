"""Supabase JWT validation for FastAPI routes."""

import os
from fastapi import Request, HTTPException
from supabase import create_client

_client = None


def _get_supabase():
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_ANON_KEY"],
        )
    return _client


async def require_auth(request: Request) -> str:
    """Validate Bearer JWT from Supabase Auth. Returns authenticated user_id."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header.removeprefix("Bearer ")
    sb = _get_supabase()

    try:
        result = sb.auth.get_user(token)
        if not result.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return result.user.id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token validation failed")
