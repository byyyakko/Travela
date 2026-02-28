# Travela — Claude Code Instructions

## Superpowers Workflow

All development on this project MUST follow the Superpowers methodology located at:
`~/Downloads/superpowers-main/skills/`

### Mandatory Process (in order)
1. **Brainstorm** — design before any code (`superpowers:brainstorming`)
2. **Git Worktree** — isolated branch via `.worktrees/` (`superpowers:using-git-worktrees`)
3. **Write Plan** — bite-sized tasks saved to `docs/plans/` (`superpowers:writing-plans`)
4. **Execute** — subagent-driven development with spec + quality review (`superpowers:subagent-driven-development`)
5. **Finish** — verify tests pass, then merge/push (`superpowers:finishing-a-development-branch`)

### Iron Laws
- No code without a failing test first (TDD)
- No fixes without root cause investigation first
- No completion claims without fresh verification
- No implementation before design is approved

---

## Project Architecture

**Frontend:** React 18 + TypeScript + Vite + Tailwind + Shadcn-UI
**Backend:** FastAPI (Python 3.13) — `backend/`
**ML Model:** XGBoost v2 — `backend/model/travel_buddy_v2.json` (55 features, 12 interest categories)
**Database:** Supabase (PostgreSQL + Realtime + Auth + Storage)
**Mobile:** Capacitor (iOS + Android)
**Deploy:** Render (backend Docker), Lovable (frontend)

**Key files:**
- ML ranking: `backend/model_service.py`
- ML training: `backend/train_model.py`
- API endpoints: `backend/main.py`
- Match page: `src/pages/Match.tsx`
- Backend tests: `backend/tests/`

**Backend test command:** `cd backend && python -m pytest -v`
**Frontend dev server:** `npm run dev` (port 8080)

---

## ML Model Context

- 12 interest categories: cultural_heritage, adventure_outdoor, food_culinary,
  nature_wildlife, social_nightlife, arts_photography, wellness_spiritual,
  sports_fitness, beach_water, backpacking_budget, luxury_travel, volunteering_community
- `/rank` endpoint: ranks candidates by match score + returns matched_interests[]
- `/recommend` endpoint: category_filter pre-filters then ranks
- AUC: 0.9983 on 50k synthetic travel profile pairs
- Retrain by running: `cd backend && python train_model.py`

---

## Git Conventions

- Feature branches via worktrees: `.worktrees/<feature-name>/`
- Worktrees are gitignored
- Commit messages: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Push to: `https://github.com/byyyakko/Travela.git`
