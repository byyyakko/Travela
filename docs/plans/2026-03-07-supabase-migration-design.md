# Supabase Migration Design — Lovable → Own Project

**Date:** 2026-03-07
**Status:** Approved
**Approach:** A — New Features First, Clean Cutover

---

## Context

The app currently uses a Lovable-managed Supabase project (`mpnfpyphwxmnmaosxjao`) for all data and auth. The goal is to migrate to a self-owned Supabase project (`pdnnpduahwpxynsfaxhj`) so the database is fully under developer control, independent of Lovable.

**Constraints:**
- Beta phase — some user data exists but a password reset is acceptable
- Zero unplanned downtime during migration
- Lovable continues to manage frontend UI deployment after migration

**Key technical constraint:** A user JWT is signed by the originating project's secret. The frontend cannot use the new project's Supabase client for authenticated operations until users re-auth on the new project. The FastAPI backend can use the new project immediately via service role key (no user JWT required).

---

## Infrastructure (already complete)

- `supabase/schema_compiled.sql` — all 25+ tables, enums, RLS policies, triggers, storage buckets compiled into a single runnable SQL file
- `src/integrations/supabase/client-own.ts` — `supabaseOwn` client pointing to new project
- `.env` — both sets of credentials present (`VITE_SUPABASE_*` for old, `VITE_SUPABASE_OWN_*` for new)

---

## Migration Phases

### Phase 1 — Schema Live (manual step)
Run `supabase/schema_compiled.sql` in the new project's SQL Editor.
Verify all tables, storage buckets, and RLS policies are present.

### Phase 2 — Backend Migrated
FastAPI backend adds a second Supabase client using the new project's service role key.
Analytics writes (`analytics_events`) migrate to new project.
All new backend endpoints use new project from the start.

**What changes:**
- `backend/.env` / Render env vars: add `SUPABASE_OWN_URL` + `SUPABASE_OWN_SERVICE_KEY`
- `backend/main.py`: instantiate `supabase_own` client
- `backend/main.py`: analytics insert endpoint uses `supabase_own`
- Frontend: no changes yet — still uses old project for all authenticated ops

### Phase 3 — Full Cutover
When ready (days/weeks after Phase 2 is stable):

1. Run one-time data migration script: pg_dump non-auth tables from old project → new project (preserving UUIDs)
2. Notify beta users via email: "Please reset your password to continue"
3. Flip env vars: `VITE_SUPABASE_*` → new project values, `config.toml` project_id updated
4. Redeploy frontend (Lovable) and backend (Render)
5. Old project set to read-only (disable signups, no writes)

### Phase 4 — Decommission
After 2–4 weeks of stable operation on new project:
- Confirm no traffic to old project
- Remove `client-own.ts` (merge into `client.ts`)
- Remove `VITE_SUPABASE_OWN_*` env vars
- Delete old Lovable Supabase project

---

## Data Flow

```
Phase 2:
  frontend  →  supabase (Lovable)       ← auth + all user ops (unchanged)
  FastAPI   →  supabaseOwn (new)        ← analytics, new backend features

Phase 3+:
  frontend  →  supabaseOwn (new)        ← full cutover, users re-auth
  FastAPI   →  supabaseOwn (new)
  Lovable   →  supabase (read-only backup)
```

---

## Risk & Rollback

| Risk | Mitigation |
|---|---|
| Schema SQL fails on new project | Fix SQL errors before Phase 2; old project unaffected |
| Backend analytics writes fail | Fall back to old client; non-critical feature |
| Cutover causes user confusion | Pre-announce reset; support window open |
| Data loss at cutover | pg_dump taken immediately before flip; old project kept read-only for 4 weeks |

---

## Success Criteria

- Phase 1: All tables visible in new Supabase dashboard
- Phase 2: Analytics events appearing in new project; FastAPI health check passes
- Phase 3: All users able to log in on new project; no reads/writes to old project
- Phase 4: Single Supabase client in codebase; old project deleted
