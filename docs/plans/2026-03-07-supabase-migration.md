# Supabase Migration — Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate analytics writes from the Lovable-managed Supabase to the new self-owned Supabase project via a FastAPI `/analytics` endpoint, sidestepping the JWT authentication barrier entirely.

**Architecture:** The frontend currently writes analytics events directly to the old Supabase project. Instead, frontend will POST events to a new FastAPI `/analytics` endpoint, which uses a service role key to write to the new project — no user JWT needed. All other frontend operations remain on the old project untouched.

**Tech Stack:** FastAPI (Python 3.13), supabase-py, React + TypeScript, Vite env vars

---

## Pre-requisite: Manual Step (do this first, outside the code tasks)

Before starting any code tasks:

1. Go to [supabase.com](https://supabase.com) → new project (`pdnnpduahwpxynsfaxhj`) → **SQL Editor**
2. Paste the full contents of `supabase/schema_compiled.sql` and run it
3. Verify in Table Editor that tables like `profiles`, `analytics_events`, `matches` etc. are all present
4. Go to **Settings → API → Service Role** key — copy the `service_role` secret key (keep it safe, never commit it)

---

## Task 1: Add supabase-py to backend dependencies

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/.env.example`

**Step 1: Add the dependency**

Open `backend/requirements.txt` and add this line at the end:

```
supabase==2.10.0
```

**Step 2: Add env vars to .env.example**

Open `backend/.env.example` and add:

```
# New Supabase project — service role key (never expose publicly)
SUPABASE_OWN_URL=https://pdnnpduahwpxynsfaxhj.supabase.co
SUPABASE_OWN_SERVICE_KEY=your-service-role-key-here
```

**Step 3: Install locally**

```bash
cd backend && pip install supabase==2.10.0
```

Expected: installs without errors.

**Step 4: Commit**

```bash
git add backend/requirements.txt backend/.env.example
git commit -m "chore: add supabase-py dependency for new project"
```

---

## Task 2: Create the Supabase client module

**Files:**
- Create: `backend/supabase_client.py`
- Create: `backend/tests/test_supabase_client.py`

**Step 1: Write the failing test**

Create `backend/tests/test_supabase_client.py`:

```python
"""Tests for supabase_client module."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest


def test_get_supabase_own_returns_client_when_env_set(monkeypatch):
    monkeypatch.setenv("SUPABASE_OWN_URL", "https://pdnnpduahwpxynsfaxhj.supabase.co")
    monkeypatch.setenv("SUPABASE_OWN_SERVICE_KEY", "fake-service-key")

    # Re-import after env vars are set
    import importlib
    import supabase_client
    importlib.reload(supabase_client)

    client = supabase_client.get_supabase_own()
    assert client is not None


def test_get_supabase_own_returns_none_when_env_missing(monkeypatch):
    monkeypatch.delenv("SUPABASE_OWN_URL", raising=False)
    monkeypatch.delenv("SUPABASE_OWN_SERVICE_KEY", raising=False)

    import importlib
    import supabase_client
    importlib.reload(supabase_client)

    client = supabase_client.get_supabase_own()
    assert client is None
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_supabase_client.py -v
```

Expected: `ModuleNotFoundError: No module named 'supabase_client'`

**Step 3: Create the module**

Create `backend/supabase_client.py`:

```python
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
```

**Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_supabase_client.py -v
```

Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add backend/supabase_client.py backend/tests/test_supabase_client.py
git commit -m "feat: add supabase_client module for new project"
```

---

## Task 3: Add /analytics endpoint to FastAPI

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_main.py`

**Step 1: Write the failing tests**

Add to the end of `backend/tests/test_main.py`:

```python
def test_analytics_returns_200_without_supabase(monkeypatch):
    """When Supabase is not configured, /analytics returns 200 but logs a warning."""
    monkeypatch.delenv("SUPABASE_OWN_URL", raising=False)
    monkeypatch.delenv("SUPABASE_OWN_SERVICE_KEY", raising=False)

    r = client.post("/analytics", json={
        "event_type": "page_view",
        "page": "/match",
        "session_id": "test-session",
        "user_id": None,
        "event_data": {}
    })
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_analytics_rejects_missing_event_type():
    r = client.post("/analytics", json={
        "page": "/match",
        "session_id": "test-session",
    })
    assert r.status_code == 422
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_main.py::test_analytics_returns_200_without_supabase tests/test_main.py::test_analytics_rejects_missing_event_type -v
```

Expected: FAIL — `404 Not Found` (endpoint doesn't exist yet).

**Step 3: Add the endpoint to main.py**

Add the following import at the top of `backend/main.py` (after existing imports):

```python
from supabase_client import get_supabase_own
```

Add the following schema and endpoint after the existing `RecommendRequest` class:

```python
class AnalyticsEvent(BaseModel):
    event_type: str
    page: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    event_data: Optional[dict] = None


@app.post("/analytics")
def track_analytics(event: AnalyticsEvent):
    """Write an analytics event to the new Supabase project via service role key."""
    sb = get_supabase_own()
    if sb is None:
        return {"status": "ok", "note": "supabase not configured"}
    try:
        sb.table("analytics_events").insert({
            "user_id": event.user_id,
            "event_type": event.event_type,
            "event_data": event.event_data or {},
            "page": event.page,
            "session_id": event.session_id,
        }).execute()
    except Exception as e:
        # Non-fatal — analytics failures should never break the app
        print(f"[analytics] write failed: {e}")
    return {"status": "ok"}
```

**Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_main.py -v
```

Expected: all tests PASS (including all existing tests).

**Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_main.py
git commit -m "feat: add /analytics endpoint writing to new Supabase project"
```

---

## Task 4: Update frontend useAnalytics to call FastAPI

**Files:**
- Modify: `src/hooks/useAnalytics.ts`

**Context:** `useAnalytics.ts` currently writes directly to the old Supabase project. We route it through the FastAPI `/analytics` endpoint instead. The `VITE_BACKEND_URL` env var should already be set (it's used by `useKeepAlive.ts`). Check `src/hooks/useKeepAlive.ts` to confirm the backend URL var name before editing.

**Step 1: Confirm the backend URL env var name**

```bash
grep -r "VITE_BACKEND" frontend/src/
```

Note the exact env var name used (e.g. `VITE_BACKEND_URL`). Use that name in the next step.

**Step 2: Update useAnalytics.ts**

Replace the entire contents of `src/hooks/useAnalytics.ts` with:

```typescript
import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Stable session ID for the duration of the browser tab
let sessionId: string | null = null;
function getSessionId() {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

type EventData = Record<string, unknown>;

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

export function useAnalytics(page: string) {
  const { user } = useAuth();
  const hasFiredPageView = useRef(false);

  const track = useCallback(
    (eventType: string, eventData?: EventData) => {
      if (!BACKEND_URL) return;
      fetch(`${BACKEND_URL}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id ?? null,
          event_type: eventType,
          event_data: eventData ?? {},
          page,
          session_id: getSessionId(),
        }),
      }).catch((err) => console.warn("[analytics]", err));
    },
    [user?.id, page],
  );

  // Auto-fire page_view once per mount
  useEffect(() => {
    if (!hasFiredPageView.current) {
      hasFiredPageView.current = true;
      track("page_view");
    }
  }, [track]);

  return { track };
}
```

**Step 3: Verify the app compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

**Step 4: Commit**

```bash
git add frontend/src/hooks/useAnalytics.ts
git commit -m "feat: route analytics through FastAPI to new Supabase project"
```

---

## Task 5: Add SUPABASE_OWN env vars to Render

**This is a manual step — no code changes.**

1. Go to [render.com](https://render.com) → your backend service → **Environment**
2. Add two env vars:
   - `SUPABASE_OWN_URL` = `https://pdnnpduahwpxynsfaxhj.supabase.co`
   - `SUPABASE_OWN_SERVICE_KEY` = the service role key from Supabase Settings → API
3. Click **Save Changes** — Render will redeploy automatically
4. Once deployed, verify: `curl https://your-render-url.onrender.com/health` returns `{"status":"ok"}`
5. Fire a test analytics event:

```bash
curl -X POST https://your-render-url.onrender.com/analytics \
  -H "Content-Type: application/json" \
  -d '{"event_type":"test_event","page":"/test","session_id":"manual-test"}'
```

Expected: `{"status":"ok"}`

6. Check the new Supabase project's Table Editor → `analytics_events` — the test row should appear.

---

## Task 6: Run full test suite and verify

**Step 1: Run all backend tests**

```bash
cd backend && python -m pytest -v
```

Expected: all tests PASS.

**Step 2: Run frontend type check**

```bash
cd frontend && npm run build
```

Expected: no errors.

**Step 3: Final commit for docs**

```bash
git add frontend/docs/plans/
git commit -m "docs: add supabase migration design and implementation plan"
```

---

## Phase 3 Cutover Checklist (future — when ready)

When you're ready to fully switch the frontend to the new Supabase project:

- [ ] Run the pg_dump data migration (see design doc for script)
- [ ] Update `frontend/.env`: swap `VITE_SUPABASE_*` to new project values
- [ ] Update `frontend/supabase/config.toml`: `project_id = "pdnnpduahwpxynsfaxhj"`
- [ ] Remove `VITE_SUPABASE_OWN_*` env vars (now redundant)
- [ ] Update `client.ts` to use new project URL (or delete `client-own.ts` and rename)
- [ ] Notify beta users to reset their password
- [ ] Redeploy via Lovable (push to main triggers auto-deploy)
- [ ] Monitor for 48h, then set old project to read-only
