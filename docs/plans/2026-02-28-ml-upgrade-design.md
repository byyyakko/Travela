# ML Upgrade Design — Travela Matching & Search Enhancement

**Date:** 2026-02-28
**Status:** Approved
**Author:** Claude (Superpowers brainstorming session)

---

## Overview

Replace Travela's simplistic XGBoost model (4 travel style categories, 32 features mostly derived from a single Jaccard score) with a fully retrained model using 12 interest categories, 53+ meaningful features, a new `/recommend` endpoint for interest-based search, and match reason transparency shown on swipe cards and match popups.

---

## Problems Being Solved

1. **Weak signal** — 27 of 32 features are linear transforms of a single Jaccard overlap score
2. **Coarse interest taxonomy** — 4 categories miss key travel types: spiritual/pilgrimage, luxury, backpacking/budget, volunteering
3. **Wasted data** — bio text, languages, and location proximity are completely ignored
4. **No search layer** — frontend pulls all `is_local=true` profiles with no interest-based pre-filtering
5. **No transparency** — users don't see why they're being matched
6. **Model mismatch** — original model trained on Columbia speed-dating dataset, not travel profiles

---

## Approved Design: Option B — Retrain + Expand

### Interest Taxonomy (12 Categories)

| Category | Key Keywords |
|---|---|
| Cultural Heritage | museums, history, architecture, temples, heritage, culture, ancient sites |
| Adventure / Outdoor | hiking, climbing, camping, diving, skiing, cycling, surfing, outdoors |
| Food / Culinary | street food, local cuisine, cooking, fine dining, food markets, ramen, tapas |
| Nature / Wildlife | wildlife, national parks, forests, birdwatching, conservation, safari |
| Social / Nightlife | nightlife, clubbing, concerts, festivals, parties, bars |
| Arts / Photography | photography, art, theater, galleries, music, film, vinyl |
| Wellness / Spiritual | yoga, meditation, pilgrimage, shrines, spa, wellness, retreat |
| Sports / Fitness | sports, running, fitness, martial arts, gym |
| Beach / Water | beach, snorkeling, sailing, water sports, scuba |
| Backpacking / Budget | hostels, budget travel, off-the-beaten-path, long-term travel, hitchhiking |
| Luxury Travel | luxury hotels, resorts, fine dining, VIP experiences, business class |
| Volunteering / Community | volunteering, teaching, conservation, community service, humanitarian |

### Feature Set (53 features)

**User profile features (6):**
- age, language_count, bio_length, profile_completeness, is_verified, top_category_score

**User category scores (12):**
- One score per category (0–10)

**Candidate profile features (6):**
- Same as user

**Candidate category scores (12):**
- One score per category

**Pairwise compatibility features (17):**
- age_diff
- interest_overlap_jaccard (raw set overlap)
- interest_overlap_weighted (weighted by user's top category)
- category_overlap_N (12 per-category overlaps — strongest signal for "cultural + cultural")
- shared_language_count
- has_shared_language (boolean 0/1)
- bio_similarity (TF-IDF cosine on bio text)
- same_city (boolean 0/1)
- same_country (boolean 0/1)
- niche_interest_bonus (interests appearing in <5% of profiles)

### Synthetic Training Data

Generate 50,000 profile pairs with realistic match/no-match labels:
- Strong match: high category overlap (>3 shared categories), same language, close age
- Weak match: some overlap
- No match: opposite interests, large age gap, no shared language

### New API Endpoints

**Enhanced `/rank`** (existing):
- Accepts: `user` + `candidates[]` (now includes `languages`, `bio`, `location`)
- Returns: ranked list with `match_score` + `matched_interests[]` per candidate

**New `/recommend`** (search/discovery):
- Accepts: `user` + `category_filter` (optional) + `limit`
- Returns: ranked + pre-filtered candidates with `match_score` + `matched_interests[]`
- Used by frontend filter tabs

### Frontend Changes

1. Pass `languages`, `bio`, full `location` to `/rank`
2. Add interest category filter tabs: All | Cultural | Adventure | Food | Nature | Spiritual | Luxury | Backpacking | Volunteering
3. Show matched interests on swipe cards: "Both love: Local culture, Street food"
4. Show matched interests in match popup confirmation screen

---

## Non-Goals

- Sentence-transformer embeddings (Option C) — deferred
- Admin analytics on match quality — deferred
- Real user feedback loop retraining — deferred

---

## Files Affected

**Backend:**
- `backend/model_service.py` — full rewrite of feature engineering
- `backend/main.py` — add `/recommend` endpoint, update `/rank` response
- `backend/train_model.py` — new file: synthetic data generation + XGBoost training
- `backend/model/travel_buddy_v2.json` — new retrained model
- `backend/model/feature_names_v2.txt` — new feature list
- `backend/requirements.txt` — add scikit-learn TF-IDF dependency (already present)

**Frontend:**
- `src/pages/Match.tsx` — pass more user data, add filter tabs, show matched interests
- `src/components/match/MatchCard.tsx` — show matched interests badge (or inline in Match.tsx)
