"""Profile gender preference endpoints — Neon-backed."""
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_conn, put_conn
from middleware.auth import require_auth

router = APIRouter(prefix="/profiles", tags=["profiles"])

_VALID_GENDERS = {"male", "female", "non_binary", "prefer_not_to_say"}


class GenderPreference(BaseModel):
    gender: Optional[str] = None
    same_gender_only: bool = False


class LocalGenderRequest(BaseModel):
    user_ids: list[str]


@router.get("/me/gender")
def get_my_gender(user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT gender, same_gender_only FROM public.profiles WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return {"gender": None, "same_gender_only": False}
        return {"gender": row[0], "same_gender_only": bool(row[1])}
    finally:
        put_conn(conn)


@router.patch("/me/gender")
def update_my_gender(body: GenderPreference, user_id: str = Depends(require_auth)):
    if body.gender is not None and body.gender not in _VALID_GENDERS:
        raise HTTPException(status_code=400, detail=f"Invalid gender value: {body.gender}")

    effective_same_gender = (
        False if not body.gender or body.gender == "prefer_not_to_say"
        else body.same_gender_only
    )

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """UPDATE public.profiles
               SET gender = %s, same_gender_only = %s, updated_at = now()
               WHERE user_id = %s""",
            (body.gender, effective_same_gender, user_id),
        )
        conn.commit()
        return {"gender": body.gender, "same_gender_only": effective_same_gender}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/locals/gender")
def get_locals_gender(body: LocalGenderRequest, user_id: str = Depends(require_auth)):
    if not body.user_ids:
        return []
    conn = get_conn()
    try:
        cur = conn.cursor()
        placeholders = ",".join(["%s"] * len(body.user_ids))
        cur.execute(
            f"SELECT user_id::text, gender FROM public.profiles WHERE user_id::text IN ({placeholders})",
            body.user_ids,
        )
        return [{"user_id": row[0], "gender": row[1]} for row in cur.fetchall()]
    finally:
        put_conn(conn)


class LinkRequest(BaseModel):
    email: str

@router.post("/auth/link")
def link_profile(body: LinkRequest, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, user_id FROM public.profiles WHERE email = %s",
            (body.email,),
        )
        row = cur.fetchone()
        if not row:
            return {"linked": False, "reason": "no_profile"}
        profile_id, existing_uid = row
        if existing_uid is not None and str(existing_uid) == user_id:
            return {"linked": True, "already_linked": True}
        if existing_uid is not None and str(existing_uid) != user_id:
            raise HTTPException(status_code=409, detail="profile_already_linked_to_different_user")
        # Profile has NULL user_id — safe to link
        cur.execute(
            """UPDATE public.profiles
               SET user_id = %s::uuid, migration_linked = true, updated_at = now()
               WHERE id = %s AND (user_id IS NULL OR user_id::text = %s)""",
            (user_id, profile_id, user_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=409, detail="profile_already_linked_to_different_user")
        conn.commit()
        return {"linked": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


_PROFILE_COLS = (
    "id", "user_id", "email", "display_name", "avatar_url", "bio", "location",
    "is_local", "is_verified", "is_restricted", "interests", "languages",
    "time_availability", "date_of_birth", "min_age_preference", "max_age_preference",
    "activity_vibe", "has_seen_tutorial", "gender", "same_gender_only",
    "subscription_tier", "theme", "created_at", "updated_at", "migration_linked",
)

def _row_to_profile(row) -> dict:
    return {col: (str(val) if hasattr(val, "isoformat") else val)
            for col, val in zip(_PROFILE_COLS, row)}


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    is_local: Optional[bool] = None
    interests: Optional[list[str]] = None
    languages: Optional[list[str]] = None
    time_availability: Optional[list[str]] = None
    date_of_birth: Optional[str] = None
    min_age_preference: Optional[int] = None
    max_age_preference: Optional[int] = None
    activity_vibe: Optional[str] = None
    has_seen_tutorial: Optional[bool] = None
    gender: Optional[str] = None
    same_gender_only: Optional[bool] = None


@router.get("/me")
def get_my_profile(user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = ", ".join(_PROFILE_COLS)
        cur.execute(
            f"SELECT {cols} FROM public.profiles WHERE user_id = %s::uuid",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")
        return _row_to_profile(row)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.patch("/me")
def update_my_profile(body: ProfileUpdate, user_id: str = Depends(require_auth)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [user_id]
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE public.profiles SET {set_clause}, updated_at = now() WHERE user_id = %s::uuid",
            values,
        )
        conn.commit()
        return {"updated": list(updates.keys())}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)
