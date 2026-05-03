# Gender Match Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users specify their gender and opt into same-gender-only matching via a pre-filter that runs before the XGBoost ranking model.

**Architecture:** Gender preference is a hard binary constraint, not a soft preference — it belongs as a pre-filter applied to the candidate pool before the ML model scores anyone. This mirrors the existing `category_filter` pattern in `/recommend`. No model retraining is needed. A `gender` column stores the user's identity; a `same_gender_only` boolean stores their matching preference.

**Tech Stack:** Supabase SQL migration, FastAPI/Pydantic (Python), pytest, React/TypeScript, Shadcn-UI RadioGroup + Switch

---

## Context

- Backend: `frontend/backend/main.py` — `/rank` and `/recommend` endpoints
- Backend tests: `frontend/backend/tests/test_main.py`
- Profile page: `frontend/src/pages/Profile.tsx` — "Match Preferences" card at ~line 1025
- TypeScript types: `frontend/src/integrations/supabase/types.ts` — profiles table at line 725
- Migration dir: `frontend/supabase/migrations/`
- Working branch: `feature/gender-match` inside `frontend/`
- Run backend tests from: `frontend/backend/` with `python -m pytest -v`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260503000001_add_gender_to_profiles.sql`

**Step 1: Create the migration file**

```sql
-- supabase/migrations/20260503000001_add_gender_to_profiles.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS same_gender_only BOOLEAN NOT NULL DEFAULT FALSE;
```

**Step 2: Verify the file exists**

```bash
ls frontend/supabase/migrations/ | grep gender
```
Expected: `20260503000001_add_gender_to_profiles.sql`

**Step 3: Commit**

```bash
git add supabase/migrations/20260503000001_add_gender_to_profiles.sql
git commit -m "feat: add gender and same_gender_only columns to profiles"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/integrations/supabase/types.ts:726-810`

**Step 1: Add to `profiles.Row` (line ~728, after `activity_vibe`)**

Find the `profiles` → `Row` block at line 726 and add `gender` and `same_gender_only`:

```typescript
// In Row block — add these two lines (alphabetical order: gender after display_name, same_gender_only before subscription_tier)
gender: "female" | "male" | "non_binary" | "prefer_not_to_say" | null
same_gender_only: boolean
```

**Step 2: Add to `profiles.Insert` (line ~754)**

In the `Insert` block:
```typescript
gender?: "female" | "male" | "non_binary" | "prefer_not_to_say" | null
same_gender_only?: boolean
```

**Step 3: Add to `profiles.Update` (line ~782)**

In the `Update` block:
```typescript
gender?: "female" | "male" | "non_binary" | "prefer_not_to_say" | null
same_gender_only?: boolean
```

**Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors relating to gender or profiles

**Step 5: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: add gender and same_gender_only to profiles TypeScript types"
```

---

## Task 3: Backend — Gender Filter (TDD)

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_main.py`

### Step 1: Write failing tests

Open `backend/tests/test_main.py`. After the last existing test, add this entire block:

```python
# ── Gender filter fixtures ────────────────────────────────────────────────────

FEMALE_USER = {
    "user_id": "female-user",
    "date_of_birth": "1995-01-01",
    "interests": ["museums", "history"],
    "bio": "Traveler",
    "languages": ["English"],
    "location": "Tokyo, Japan",
    "gender": "female",
}

FEMALE_CANDIDATE = {
    "user_id": "female-cand",
    "date_of_birth": "1993-03-15",
    "interests": ["museums", "culture"],
    "bio": "Local guide",
    "languages": ["English", "Japanese"],
    "location": "Tokyo, Japan",
    "gender": "female",
}

MALE_CANDIDATE = {
    "user_id": "male-cand",
    "date_of_birth": "1990-07-20",
    "interests": ["museums", "culture"],
    "bio": "Adventure guide",
    "languages": ["English"],
    "location": "Tokyo, Japan",
    "gender": "male",
}

UNSET_GENDER_CANDIDATE = {
    "user_id": "unset-cand",
    "date_of_birth": "1992-05-10",
    "interests": ["museums"],
    "bio": "Guide",
    "languages": ["English"],
    "location": "Tokyo, Japan",
    # no gender field
}


class TestGenderFilter:
    """POST /rank and /recommend with same_gender_only flag."""

    def test_rank_without_flag_returns_all_candidates(self):
        """same_gender_only defaults False — all candidates returned."""
        r = client.post("/rank", json={
            "user": FEMALE_USER,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" in ids

    def test_rank_same_gender_only_excludes_other_gender(self):
        """same_gender_only=True filters out candidates of a different gender."""
        r = client.post("/rank", json={
            "user": FEMALE_USER,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" not in ids

    def test_rank_same_gender_only_includes_unset_gender_candidates(self):
        """Candidates with no gender set are included even when same_gender_only=True."""
        r = client.post("/rank", json={
            "user": FEMALE_USER,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE, UNSET_GENDER_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "unset-cand" in ids
        assert "male-cand" not in ids

    def test_rank_user_with_no_gender_skips_filter(self):
        """If the user has no gender set, same_gender_only is a no-op."""
        user_no_gender = {**FEMALE_USER, "gender": None}
        r = client.post("/rank", json={
            "user": user_no_gender,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" in ids

    def test_rank_prefer_not_to_say_skips_filter(self):
        """User gender='prefer_not_to_say' means same_gender_only is a no-op."""
        user_pnts = {**FEMALE_USER, "gender": "prefer_not_to_say"}
        r = client.post("/rank", json={
            "user": user_pnts,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" in ids

    def test_recommend_same_gender_only_filters_candidates(self):
        """same_gender_only works identically on /recommend."""
        r = client.post("/recommend", json={
            "user": FEMALE_USER,
            "candidates": [FEMALE_CANDIDATE, MALE_CANDIDATE],
            "same_gender_only": True,
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-cand" in ids
        assert "male-cand" not in ids

    def test_recommend_gender_filter_and_category_filter_combine(self):
        """Both filters apply independently — AND logic."""
        cand_wrong_gender_right_category = {
            **MALE_CANDIDATE,
            "user_id": "male-culture",
            "interests": ["museums", "heritage", "culture"],
        }
        cand_right_gender_wrong_category = {
            **FEMALE_CANDIDATE,
            "user_id": "female-adventure",
            "interests": ["rock climbing", "bungee jumping"],
        }
        cand_right_both = {
            **FEMALE_CANDIDATE,
            "user_id": "female-culture",
            "interests": ["museums", "heritage", "culture"],
        }
        r = client.post("/recommend", json={
            "user": FEMALE_USER,
            "candidates": [
                cand_wrong_gender_right_category,
                cand_right_gender_wrong_category,
                cand_right_both,
            ],
            "same_gender_only": True,
            "category_filter": "cultural_heritage",
        })
        assert r.status_code == 200
        ids = [c["user_id"] for c in r.json()["ranked"]]
        assert "female-culture" in ids
        assert "male-culture" not in ids
```

**Step 2: Run tests to verify they fail**

```bash
cd frontend/backend && python -m pytest tests/test_main.py::TestGenderFilter -v
```
Expected: all 7 tests FAIL with errors like `unexpected keyword argument 'same_gender_only'` or `422 Unprocessable Entity`

**Step 3: Implement in `backend/main.py`**

3a. Add `gender` to the `Profile` model (after `avatar_url`):

```python
class Profile(BaseModel):
    user_id: Optional[str] = None
    display_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    interests: Optional[list[str]] = None
    bio: Optional[str] = None
    languages: Optional[list[str]] = None
    location: Optional[str] = None
    is_local: Optional[bool] = None
    is_verified: Optional[bool] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = None
```

3b. Add `same_gender_only` to `RankRequest`:

```python
class RankRequest(BaseModel):
    user: Profile
    candidates: list[Profile]
    same_gender_only: bool = False
```

3c. Add `same_gender_only` to `RecommendRequest`:

```python
class RecommendRequest(BaseModel):
    user: Profile
    candidates: list[Profile]
    category_filter: Optional[str] = None
    same_gender_only: bool = False
    limit: int = 50
```

3d. Add the filter function just above the `/rank` endpoint:

```python
_FILTERABLE_GENDERS = {"male", "female", "non_binary"}

def _apply_gender_filter(user: Profile, candidates: list[Profile]) -> list[Profile]:
    """Remove candidates whose gender differs from the user's.
    Candidates with no gender set are always included.
    Filter is a no-op when user gender is unset or 'prefer_not_to_say'."""
    user_gender = user.gender
    if not user_gender or user_gender not in _FILTERABLE_GENDERS:
        return candidates
    return [c for c in candidates if c.gender is None or c.gender == user_gender]
```

3e. Wire into `/rank`:

```python
@app.post("/rank")
def rank(req: RankRequest):
    """Rank candidates by compatibility with the user. Returns match_score and matched_interests."""
    candidates = req.candidates
    if req.same_gender_only:
        candidates = _apply_gender_filter(req.user, candidates)
    user_dict = req.user.model_dump()
    candidate_dicts = [c.model_dump() for c in candidates]
    try:
        ranked = rank_candidates(user_dict, candidate_dicts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ranking failed: {e}")
    return {"ranked": ranked}
```

3f. Wire into `/recommend`:

```python
@app.post("/recommend")
def recommend(req: RecommendRequest):
    """Filter candidates by gender and/or interest category, then rank."""
    candidates = req.candidates
    if req.same_gender_only:
        candidates = _apply_gender_filter(req.user, candidates)
    user_dict = req.user.model_dump()
    candidate_dicts = [c.model_dump() for c in candidates]
    try:
        ranked = recommend_by_category(user_dict, candidate_dicts, req.category_filter)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {e}")
    return {"ranked": ranked[: req.limit]}
```

**Step 4: Run tests to verify they pass**

```bash
cd frontend/backend && python -m pytest tests/test_main.py::TestGenderFilter -v
```
Expected: all 7 PASS

**Step 5: Run the full suite to check no regressions**

```bash
cd frontend/backend && python -m pytest -v
```
Expected: all 174 tests pass (167 existing + 7 new)

**Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_main.py
git commit -m "feat: gender pre-filter for /rank and /recommend — same_gender_only flag"
```

---

## Task 4: Profile UI — Gender Picker + Same-Gender Toggle

**Files:**
- Modify: `src/pages/Profile.tsx`

### Step 1: Add state variables

In the state block around line 122, after `const [dateOfBirth, setDateOfBirth] = useState("");`, add:

```tsx
const [gender, setGender] = useState<string>("");
const [sameGenderOnly, setSameGenderOnly] = useState(false);
```

### Step 2: Load from database

In the profile load block around line 296 (inside the `if (data)` block), after `setDateOfBirth(data.date_of_birth || "");`, add:

```tsx
setGender(data.gender || "");
setSameGenderOnly(data.same_gender_only ?? false);
```

### Step 3: Save to database

In the `supabase.from("profiles").update({...})` call around line 443, after `date_of_birth: dateOfBirth || null,`, add:

```tsx
gender: gender || null,
same_gender_only: sameGenderOnly,
```

### Step 4: Add gender picker UI

In the JSX, after the Date of Birth field (around line 847, after the closing `</div>` of the date of birth section), add:

```tsx
<div className="space-y-3">
  <Label>Gender</Label>
  <RadioGroup value={gender} onValueChange={setGender} className="grid grid-cols-2 gap-2">
    {[
      { value: "male",              label: "Man" },
      { value: "female",            label: "Woman" },
      { value: "non_binary",        label: "Non-binary" },
      { value: "prefer_not_to_say", label: "Prefer not to say" },
    ].map((opt) => (
      <div
        key={opt.value}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
          gender === opt.value
            ? "border-primary bg-primary/10"
            : "border-border hover:bg-secondary/50"
        }`}
        onClick={() => setGender(opt.value)}
      >
        <RadioGroupItem value={opt.value} id={`gender-${opt.value}`} />
        <Label htmlFor={`gender-${opt.value}`} className="cursor-pointer font-normal text-sm">
          {opt.label}
        </Label>
      </div>
    ))}
  </RadioGroup>
</div>
```

### Step 5: Add same-gender toggle to Match Preferences card

In the "Match Preferences" card around line 1030, after the existing age range section (after the closing `</div>` at line 1077, before `</CardContent>`), add:

```tsx
<div className="flex items-center justify-between rounded-lg border border-border p-4">
  <div className="space-y-0.5">
    <Label className="text-sm font-medium">Match same gender only</Label>
    <p className="text-xs text-muted-foreground">
      Only show me locals who share my gender
    </p>
  </div>
  <Switch
    checked={sameGenderOnly}
    onCheckedChange={setSameGenderOnly}
    disabled={!gender || gender === "prefer_not_to_say"}
  />
</div>
```

The `Switch` is disabled when no gender is set or gender is "prefer_not_to_say" — it would have no effect in those cases.

### Step 6: Verify imports

At the top of `Profile.tsx`, ensure these are imported from `@/components/ui/`:
- `RadioGroup`, `RadioGroupItem` — from `@/components/ui/radio-group`
- `Switch` — from `@/components/ui/switch`

If missing, add them to the existing import lines.

### Step 7: Verify TypeScript compiles

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

### Step 8: Commit

```bash
git add src/pages/Profile.tsx
git commit -m "feat: gender picker and same-gender toggle in Profile match preferences"
```

---

## Final Verification

**Step 1: Run all backend tests**

```bash
cd frontend/backend && python -m pytest -v 2>&1 | tail -10
```
Expected: 174 passed, 2 warnings

**Step 2: Check TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i error | head -10
```
Expected: no output (zero errors)

**Step 3: Commit summary**

All changes committed on `feature/gender-match` in `frontend/`. Summary of commits:
1. `feat: add gender and same_gender_only columns to profiles` (migration)
2. `feat: add gender and same_gender_only to profiles TypeScript types`
3. `feat: gender pre-filter for /rank and /recommend — same_gender_only flag`
4. `feat: gender picker and same-gender toggle in Profile match preferences`
