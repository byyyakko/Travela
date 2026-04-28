# Auth Email Rate Limiting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate email authentication failures under multiple requests by adding a two-layer defence — a backend rate-limit enforcer (FastAPI + Neon) and hardened frontend auth state management.

**Architecture:** The FastAPI backend gains a new `/auth/email-rate-limit` endpoint that records every email send attempt in the existing Neon `rate_limits` table and rejects requests within a 60-second cooldown window. The frontend fixes a race condition in AuthContext, routes all email-sending actions through the backend rate checker, and surfaces human-readable error messages for Supabase's own `over_email_send_rate_limit` error. This two-layer approach handles multi-tab and direct-API abuse that a frontend-only cooldown cannot.

**Tech Stack:** FastAPI (Python 3.13), psycopg2, Supabase Auth JS v2, React 18, TypeScript, Neon PostgreSQL

---

## Context for the implementer

Key files you will touch:
- `frontend/backend/routers/auth_rate.py` — NEW backend router
- `frontend/backend/main.py` — register new router
- `frontend/backend/tests/test_auth_rate.py` — NEW tests
- `frontend/src/contexts/AuthContext.tsx` — fix race condition
- `frontend/src/pages/Auth.tsx` — cooldown UI + error handling
- `frontend/src/lib/authEmail.ts` — NEW helper that calls backend rate checker

The Neon `rate_limits` table already exists. Its schema is unknown at plan-write time — Task 1 will inspect it and either reuse or extend it.

Supabase personal project URL: `https://pdnnpduahwpxynsfaxhj.supabase.co`  
Backend live URL: `https://travela-backend-p2zp.onrender.com`  
Backend test command: `cd frontend/backend && python -m pytest -v`  
Frontend dir: `frontend/`

---

## Task 1: Inspect and prepare the rate_limits table

**Files:**
- Read: Neon schema via psycopg2
- Possibly modify: Neon schema (ALTER TABLE)

**Step 1: Check the rate_limits schema**

```bash
cd frontend
python3 -c "
import psycopg2, os
from dotenv import load_dotenv
load_dotenv('backend/.env')
conn = psycopg2.connect(os.environ['NEON_DATABASE_URL'])
cur = conn.cursor()
cur.execute(\"\"\"
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_limits'
    ORDER BY ordinal_position
\"\"\")
for r in cur.fetchall(): print(r)
cur.close(); conn.close()
"
```

**Step 2: Ensure required columns exist**

The table needs at minimum: `id`, `key` (text, the email address), `action` (text, e.g. 'email_send'), `last_attempt` (timestamptz), `attempt_count` (int).

Run this SQL in the Neon SQL editor or via psycopg2 to add any missing columns:

```sql
ALTER TABLE public.rate_limits
    ADD COLUMN IF NOT EXISTS key text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_attempt timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_key_action_idx
    ON public.rate_limits (key, action);
```

**Step 3: Verify**

```bash
python3 -c "
import psycopg2, os
from dotenv import load_dotenv
load_dotenv('backend/.env')
conn = psycopg2.connect(os.environ['NEON_DATABASE_URL'])
cur = conn.cursor()
cur.execute(\"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='rate_limits'\")
print([r[0] for r in cur.fetchall()])
cur.close(); conn.close()
"
```

Expected output includes: `['key', 'action', 'last_attempt', 'attempt_count', ...]`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: ensure rate_limits table has key/action/last_attempt columns"
```

---

## Task 2: Backend — write failing tests for rate limit endpoint

**Files:**
- Create: `frontend/backend/tests/test_auth_rate.py`

**Step 1: Write the failing tests**

```python
# frontend/backend/tests/test_auth_rate.py
"""Tests for /auth/email-rate-limit endpoint."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

PAYLOAD = {"email": "test@example.com", "action": "reset_password"}


def _mock_conn(last_attempt_seconds_ago=None, count=0):
    """Helper: returns a mock psycopg2 connection."""
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    if last_attempt_seconds_ago is None:
        mock_cur.fetchone.return_value = None  # no prior record
    else:
        from datetime import datetime, timezone, timedelta
        ts = datetime.now(timezone.utc) - timedelta(seconds=last_attempt_seconds_ago)
        mock_cur.fetchone.return_value = (ts, count)
    return mock_conn, mock_cur


def test_first_request_is_allowed():
    conn, _ = _mock_conn(last_attempt_seconds_ago=None)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json=PAYLOAD)
    assert r.status_code == 200
    assert r.json()["allowed"] is True


def test_request_within_cooldown_is_blocked():
    conn, _ = _mock_conn(last_attempt_seconds_ago=10, count=1)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json=PAYLOAD)
    assert r.status_code == 429
    assert "retry_after" in r.json()


def test_request_after_cooldown_is_allowed():
    conn, _ = _mock_conn(last_attempt_seconds_ago=70, count=1)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json=PAYLOAD)
    assert r.status_code == 200
    assert r.json()["allowed"] is True


def test_missing_email_rejected():
    r = client.post("/auth/email-rate-limit", json={"action": "reset_password"})
    assert r.status_code == 422


def test_missing_action_rejected():
    r = client.post("/auth/email-rate-limit", json={"email": "test@example.com"})
    assert r.status_code == 422


def test_signup_action_allowed():
    conn, _ = _mock_conn(last_attempt_seconds_ago=None)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json={"email": "new@example.com", "action": "signup"})
    assert r.status_code == 200


def test_resend_action_blocked_within_cooldown():
    conn, _ = _mock_conn(last_attempt_seconds_ago=5, count=1)
    with patch("psycopg2.connect", return_value=conn):
        r = client.post("/auth/email-rate-limit", json={"email": "test@example.com", "action": "resend_verification"})
    assert r.status_code == 429
```

**Step 2: Run tests — confirm all fail**

```bash
cd frontend/backend && python -m pytest tests/test_auth_rate.py -v
```

Expected: `ERROR` — `ImportError` or `404` because the router doesn't exist yet.

**Step 3: Commit failing tests**

```bash
git add frontend/backend/tests/test_auth_rate.py
git commit -m "test: add failing tests for auth email rate limit endpoint"
```

---

## Task 3: Backend — implement the rate limit router

**Files:**
- Create: `frontend/backend/routers/auth_rate.py`
- Modify: `frontend/backend/main.py`

**Step 1: Create the router**

```python
# frontend/backend/routers/auth_rate.py
"""Per-email rate limiting for auth email sends (signup, reset, resend)."""
import os
from datetime import datetime, timezone, timedelta
import psycopg2
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])

COOLDOWN_SECONDS = 60


class EmailRateLimitRequest(BaseModel):
    email: EmailStr
    action: str  # "signup" | "reset_password" | "resend_verification"


@router.post("/email-rate-limit")
def check_email_rate_limit(req: EmailRateLimitRequest):
    """
    Check and record an email send attempt.
    Returns 200 {"allowed": true} if allowed.
    Returns 429 {"retry_after": N} if within cooldown.
    """
    neon_url = os.environ.get("NEON_DATABASE_URL")
    if not neon_url:
        # If DB not configured, allow through (fail open)
        return {"allowed": True}

    key = req.email.lower()
    action = req.action
    now = datetime.now(timezone.utc)

    try:
        conn = psycopg2.connect(neon_url)
    except Exception:
        return {"allowed": True}  # fail open on DB error

    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT last_attempt, attempt_count
            FROM public.rate_limits
            WHERE key = %s AND action = %s
            """,
            (key, action),
        )
        row = cur.fetchone()

        if row:
            last_attempt, count = row
            elapsed = (now - last_attempt).total_seconds()
            if elapsed < COOLDOWN_SECONDS:
                retry_after = int(COOLDOWN_SECONDS - elapsed)
                raise HTTPException(
                    status_code=429,
                    detail={"retry_after": retry_after, "message": f"Please wait {retry_after}s before requesting another email."},
                )
            # Update existing record
            cur.execute(
                """
                UPDATE public.rate_limits
                SET last_attempt = %s, attempt_count = attempt_count + 1
                WHERE key = %s AND action = %s
                """,
                (now, key, action),
            )
        else:
            # Insert new record
            cur.execute(
                """
                INSERT INTO public.rate_limits (key, action, last_attempt, attempt_count)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT (key, action) DO UPDATE
                SET last_attempt = EXCLUDED.last_attempt,
                    attempt_count = public.rate_limits.attempt_count + 1
                """,
                (key, action, now),
            )

        conn.commit()
        cur.close()
    finally:
        conn.close()

    return {"allowed": True}
```

**Step 2: Register router in main.py**

In `frontend/backend/main.py`, find the existing router imports and add:

```python
from routers.auth_rate import router as auth_rate_router
# ...
app.include_router(auth_rate_router)
```

**Step 3: Run tests — confirm they pass**

```bash
cd frontend/backend && python -m pytest tests/test_auth_rate.py -v
```

Expected: `7 passed`

**Step 4: Run full suite — confirm nothing regressed**

```bash
cd frontend/backend && python -m pytest -v
```

Expected: `58 passed`

**Step 5: Commit**

```bash
git add frontend/backend/routers/auth_rate.py frontend/backend/main.py
git commit -m "feat: add /auth/email-rate-limit endpoint with 60s per-email cooldown"
```

---

## Task 4: Fix AuthContext race condition

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx:39-57`

**Step 1: Understand the bug**

Currently both `onAuthStateChange` and `getSession()` fire simultaneously. Both call `setLoading(false)`. This causes a flicker and in rare cases the wrong session wins the setState race.

**Step 2: Replace with single source of truth**

Replace lines 39–57 in `frontend/src/contexts/AuthContext.tsx`:

```typescript
useEffect(() => {
  // onAuthStateChange fires immediately with the current session
  // on mount (INITIAL_SESSION event), so getSession() is redundant.
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

Remove the separate `supabase.auth.getSession().then(...)` block entirely.

**Step 3: Verify the app still loads**

```bash
cd frontend && npm run dev
```

Open `http://localhost:8080`, sign in, sign out — confirm no loading flicker and session persists on refresh.

**Step 4: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx
git commit -m "fix: remove getSession race condition — use onAuthStateChange as sole auth source"
```

---

## Task 5: Frontend — auth email helper with backend rate check

**Files:**
- Create: `frontend/src/lib/authEmail.ts`

**Step 1: Create the helper**

```typescript
// frontend/src/lib/authEmail.ts
/**
 * Wrappers for auth email actions that check the backend rate limiter
 * before calling Supabase, preventing over_email_send_rate_limit errors.
 */
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

type RateLimitAction = "signup" | "reset_password" | "resend_verification";

async function checkRateLimit(email: string, action: RateLimitAction): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/email-rate-limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action }),
    });
    if (res.status === 429) {
      const data = await res.json();
      return { allowed: false, retryAfter: data.detail?.retry_after ?? 60 };
    }
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open if backend unreachable
  }
}

export async function sendResetEmail(email: string): Promise<{ error: string | null; retryAfter?: number }> {
  const { allowed, retryAfter } = await checkRateLimit(email, "reset_password");
  if (!allowed) {
    return { error: `Please wait ${retryAfter}s before requesting another reset email.`, retryAfter };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error?.message?.includes("rate limit")) {
    return { error: "Too many requests. Please wait 60 seconds and try again." };
  }
  return { error: error?.message ?? null };
}

export async function resendVerification(email: string): Promise<{ error: string | null; retryAfter?: number }> {
  const { allowed, retryAfter } = await checkRateLimit(email, "resend_verification");
  if (!allowed) {
    return { error: `Please wait ${retryAfter}s before resending.`, retryAfter };
  }
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  if (error?.message?.includes("rate limit")) {
    return { error: "Too many requests. Please wait 60 seconds and try again." };
  }
  return { error: error?.message ?? null };
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add frontend/src/lib/authEmail.ts
git commit -m "feat: add authEmail helper with backend rate check before Supabase calls"
```

---

## Task 6: Frontend — wire cooldown UI into Auth.tsx

**Files:**
- Modify: `frontend/src/pages/Auth.tsx`

**Step 1: Add cooldown state and resend button**

Replace the `handleForgotPassword` function and the `pendingVerification` UI section with the following updated versions.

At the top of the `Auth` component, add these state variables after the existing state declarations:

```typescript
const [resetCooldown, setResetCooldown] = useState(0);
const [resendCooldown, setResendCooldown] = useState(0);
```

Add this cooldown tick effect after existing useEffects:

```typescript
useEffect(() => {
  if (resetCooldown <= 0 && resendCooldown <= 0) return;
  const t = setInterval(() => {
    setResetCooldown(c => Math.max(0, c - 1));
    setResendCooldown(c => Math.max(0, c - 1));
  }, 1000);
  return () => clearInterval(t);
}, [resetCooldown, resendCooldown]);
```

**Step 2: Replace handleForgotPassword**

```typescript
import { sendResetEmail, resendVerification } from "@/lib/authEmail";

const handleForgotPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!email.trim()) {
    toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
    return;
  }
  setLoading(true);
  const { error, retryAfter } = await sendResetEmail(email);
  if (error) {
    toast({ title: "Error", description: error, variant: "destructive" });
    if (retryAfter) setResetCooldown(retryAfter);
  } else {
    setResetEmailSent(true);
    setResetCooldown(60);
    toast({ title: "Check your email!", description: "We've sent you a password reset link." });
  }
  setLoading(false);
};
```

**Step 3: Replace "Send Reset Link" button**

In `renderForgotPassword()`, replace the submit button:

```tsx
<Button type="submit" className="w-full" disabled={loading || resetCooldown > 0}>
  {loading ? "Sending..." : resetCooldown > 0 ? `Resend in ${resetCooldown}s` : "Send Reset Link"}
</Button>
```

**Step 4: Add resend button to pendingVerification screen**

Replace the `pendingVerification` JSX block:

```tsx
{pendingVerification ? (
  <div className="text-center py-6 space-y-4">
    <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
      <Mail className="w-8 h-8 text-primary" />
    </div>
    <div>
      <h3 className="font-semibold text-lg">Verify your email</h3>
      <p className="text-muted-foreground text-sm mt-1">
        We've sent a verification link to <strong>{email}</strong>
      </p>
    </div>
    <p className="text-sm text-muted-foreground">
      Click the link in your email to complete registration. Check your spam folder if you don't see it.
    </p>
    <Button
      variant="outline"
      disabled={resendCooldown > 0 || loading}
      onClick={async () => {
        setLoading(true);
        const { error, retryAfter } = await resendVerification(email);
        if (error) {
          toast({ title: "Error", description: error, variant: "destructive" });
          if (retryAfter) setResendCooldown(retryAfter);
        } else {
          setResendCooldown(60);
          toast({ title: "Email resent!", description: "Check your inbox again." });
        }
        setLoading(false);
      }}
    >
      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : loading ? "Sending..." : "Resend verification email"}
    </Button>
    <Button variant="ghost" onClick={() => setPendingVerification(false)} className="text-sm text-muted-foreground">
      Use a different email
    </Button>
  </div>
) : (
```

**Step 5: Test in browser**

```bash
cd frontend && npm run dev
```

Verify:
- Sign up → pending verification screen shows with "Resend" button
- Click "Resend" → button shows countdown `Resend in 59s`, `58s`…
- Forgot password → click "Send Reset Link" → button shows countdown
- Click multiple times rapidly → only one email sent, button disabled

**Step 6: Commit**

```bash
git add frontend/src/pages/Auth.tsx
git commit -m "feat: add email cooldown UI with resend verification and countdown timers"
```

---

## Task 7: Push and verify live

**Step 1: Run full backend test suite**

```bash
cd frontend/backend && python -m pytest -v
```

Expected: `58 passed`

**Step 2: Push to GitHub (triggers Render deploy)**

```bash
git push
```

**Step 3: Verify backend endpoint is live**

```bash
# First request — should be allowed
curl -s -X POST https://travela-backend-p2zp.onrender.com/auth/email-rate-limit \
  -H "Content-Type: application/json" \
  -d '{"email":"ratetest@example.com","action":"reset_password"}'
# Expected: {"allowed":true}

# Immediate second request — should be blocked
curl -s -X POST https://travela-backend-p2zp.onrender.com/auth/email-rate-limit \
  -H "Content-Type: application/json" \
  -d '{"email":"ratetest@example.com","action":"reset_password"}'
# Expected: 429 {"detail":{"retry_after":59,"message":"Please wait 59s..."}}
```

**Step 4: Verify AuthContext fix**

Open the app in browser, open DevTools → Network tab, refresh. Confirm only ONE call to Supabase `/auth/v1/user` on load (not two).

---

## Summary of what gets fixed

| Issue | Fix | Task |
|---|---|---|
| Race condition: double setLoading | Remove redundant getSession() | Task 4 |
| Reset email spammable | Backend 60s cooldown + frontend disabled button | Tasks 3, 5, 6 |
| No resend verification option | New resend button with countdown | Tasks 5, 6 |
| `over_email_send_rate_limit` shown raw | Catch and humanise error message | Task 5 |
| Multi-tab / direct API bypass | Backend enforcement in Neon | Task 3 |
