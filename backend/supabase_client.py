"""Supabase client for the self-owned project (uses service role key)."""

import os
from supabase import create_client, Client

_supabase_own: Client | None = None


def get_supabase_own() -> Client | None:
    """Return a Supabase client for the new project, or None if env vars are missing."""
    url = os.getenv("SUPABASE_OWN_URL")
    key = os.getenv("SUPABASE_OWN_SERVICE_KEY")
    if not url or not key:
        return None
    global _supabase_own
    if _supabase_own is None:
        _supabase_own = create_client(url, key)
    return _supabase_own
