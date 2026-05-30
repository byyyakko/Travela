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
    "theme", "is_local", "interests", "date_of_birth", "min_age_preference",
    "max_age_preference", "is_verified", "destination", "travel_start_date",
    "travel_end_date", "languages", "subscription_tier", "is_restricted",
    "restriction_reason", "activity_vibe", "time_availability", "has_seen_tutorial",
    "created_at", "updated_at", "migration_linked", "gender", "same_gender_only",
)

def _row_to_profile(row) -> dict:
    return {col: (str(val) if hasattr(val, "isoformat") else val)
            for col, val in zip(_PROFILE_COLS, row)}


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    theme: Optional[str] = None
    is_local: Optional[bool] = None
    interests: Optional[list[str]] = None
    date_of_birth: Optional[str] = None
    min_age_preference: Optional[int] = None
    max_age_preference: Optional[int] = None
    destination: Optional[str] = None
    travel_start_date: Optional[str] = None
    travel_end_date: Optional[str] = None
    languages: Optional[list[str]] = None
    activity_vibe: Optional[str] = None
    time_availability: Optional[list[str]] = None
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


_PUBLIC_COLS = (
    "user_id", "display_name", "avatar_url", "bio", "location",
    "is_local", "is_verified", "interests", "languages",
    "date_of_birth", "activity_vibe", "gender", "created_at",
)


class RoleCreate(BaseModel):
    role: str


@router.get("/me/roles")
def get_my_roles(user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT role FROM public.user_roles WHERE user_id = %s::uuid",
            (user_id,),
        )
        return [row[0] for row in cur.fetchall()]
    finally:
        put_conn(conn)


@router.post("/me/roles")
def add_my_role(body: RoleCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO public.user_roles (user_id, role) VALUES (%s::uuid, %s) ON CONFLICT DO NOTHING",
            (user_id, body.role),
        )
        conn.commit()
        return {"role": body.role}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


# ── Profile Photos ────────────────────────────────────────────────────────────

class PhotoCreate(BaseModel):
    photo_url: str
    display_order: Optional[int] = 0


@router.get("/me/photos")
def get_my_photos(user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, photo_url, display_order, created_at FROM public.profile_photos WHERE user_id = %s::uuid ORDER BY display_order",
            (user_id,),
        )
        return [{"id": str(r[0]), "photo_url": r[1], "display_order": r[2], "created_at": str(r[3])}
                for r in cur.fetchall()]
    finally:
        put_conn(conn)


@router.post("/me/photos")
def add_my_photo(body: PhotoCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO public.profile_photos (user_id, photo_url, display_order) VALUES (%s::uuid, %s, %s) RETURNING id",
            (user_id, body.photo_url, body.display_order),
        )
        photo_id = cur.fetchone()[0]
        conn.commit()
        return {"id": str(photo_id), "photo_url": body.photo_url, "display_order": body.display_order}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.delete("/me/photos/{photo_id}")
def delete_my_photo(photo_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM public.profile_photos WHERE id = %s::uuid AND user_id = %s::uuid",
            (photo_id, user_id),
        )
        conn.commit()
        return {"deleted": photo_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


# ── Profile Prompts ───────────────────────────────────────────────────────────

class PromptCreate(BaseModel):
    question: str
    answer: str


class PromptUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None


@router.get("/me/prompts")
def get_my_prompts(user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, question, answer, created_at FROM public.profile_prompts WHERE user_id = %s::uuid ORDER BY created_at",
            (user_id,),
        )
        return [{"id": str(r[0]), "question": r[1], "answer": r[2], "created_at": str(r[3])}
                for r in cur.fetchall()]
    finally:
        put_conn(conn)


@router.post("/me/prompts")
def add_my_prompt(body: PromptCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO public.profile_prompts (user_id, question, answer) VALUES (%s::uuid, %s, %s) RETURNING id",
            (user_id, body.question, body.answer),
        )
        prompt_id = cur.fetchone()[0]
        conn.commit()
        return {"id": str(prompt_id), "question": body.question, "answer": body.answer}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.patch("/me/prompts/{prompt_id}")
def update_my_prompt(prompt_id: str, body: PromptUpdate, user_id: str = Depends(require_auth)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [prompt_id, user_id]
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"UPDATE public.profile_prompts SET {set_clause} WHERE id = %s::uuid AND user_id = %s::uuid",
            values,
        )
        conn.commit()
        return {"updated": prompt_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.delete("/me/prompts/{prompt_id}")
def delete_my_prompt(prompt_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM public.profile_prompts WHERE id = %s::uuid AND user_id = %s::uuid",
            (prompt_id, user_id),
        )
        conn.commit()
        return {"deleted": prompt_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.get("/{target_user_id}")
def get_profile(target_user_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = ", ".join(_PUBLIC_COLS)
        cur.execute(
            f"SELECT {cols} FROM public.profiles WHERE user_id = %s::uuid",
            (target_user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {col: (str(val) if hasattr(val, "isoformat") else val)
                for col, val in zip(_PUBLIC_COLS, row)}
    finally:
        put_conn(conn)
