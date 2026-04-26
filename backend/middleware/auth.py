"""Supabase JWT validation for FastAPI routes."""

import os
from fastapi import Request, HTTPException
from supabase import create_client

_client = None


def _get_supabase():
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_ANON_KEY"]
        _client = create_client(url, key)
    return _client


async def require_auth(request: Request) -> str:
    """Validate Bearer JWT from Supabase Auth. Returns authenticated user_id."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header.removeprefix("Bearer ")

    try:
        sb = _get_supabase()
        result = sb.auth.get_user(token)
        if not result or not result.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return result.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token validation failed")
