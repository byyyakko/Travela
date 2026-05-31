"""Experiences and join requests — Neon-backed."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import get_conn, put_conn
from middleware.auth import require_auth

router = APIRouter(prefix="/experiences", tags=["experiences"])


class ExperienceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    city: Optional[str] = None
    duration: Optional[str] = None
    price: Optional[str] = None
    max_people: Optional[int] = None
    meeting_point: Optional[str] = None
    schedule: Optional[str] = None
    safety_guidelines: Optional[str] = None
    what_to_bring: Optional[str] = None
    language: Optional[str] = None
    itinerary: Optional[list[str]] = None


class JoinRequestCreate(BaseModel):
    message: Optional[str] = None


class JoinRequestUpdate(BaseModel):
    status: str  # 'accepted' or 'rejected' (or 'approved'/'declined' from frontend)


def _serialize(row: tuple, cols: tuple) -> dict:
    return {c: (str(v) if hasattr(v, "isoformat") else v) for c, v in zip(cols, row)}


@router.get("")
def list_experiences(user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT e.id, e.host_id, e.title, e.description, e.tags, e.city,
                      e.duration, e.price, e.max_people, e.meeting_point,
                      e.schedule, e.safety_guidelines, e.what_to_bring,
                      e.language, e.itinerary, e.created_at, e.updated_at,
                      pr.display_name AS host_display_name,
                      pr.avatar_url AS host_avatar_url
               FROM public.experiences e
               LEFT JOIN public.profiles pr ON pr.user_id = e.host_id
               ORDER BY e.schedule ASC NULLS LAST"""
        )
        cols = (
            "id", "host_id", "title", "description", "tags", "city",
            "duration", "price", "max_people", "meeting_point",
            "schedule", "safety_guidelines", "what_to_bring",
            "language", "itinerary", "created_at", "updated_at",
            "host_display_name", "host_avatar_url",
        )
        return [_serialize(row, cols) for row in cur.fetchall()]
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.get("/{experience_id}")
def get_experience(experience_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT e.id, e.host_id, e.title, e.description, e.tags, e.city,
                      e.duration, e.price, e.max_people, e.meeting_point,
                      e.schedule, e.safety_guidelines, e.what_to_bring,
                      e.language, e.itinerary, e.created_at, e.updated_at,
                      pr.display_name AS host_display_name,
                      pr.avatar_url AS host_avatar_url,
                      pr.bio AS host_bio,
                      pr.languages AS host_languages,
                      pr.subscription_tier AS host_subscription_tier
               FROM public.experiences e
               LEFT JOIN public.profiles pr ON pr.user_id = e.host_id
               WHERE e.id = %s::uuid""",
            (experience_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Experience not found")
        cols = (
            "id", "host_id", "title", "description", "tags", "city",
            "duration", "price", "max_people", "meeting_point",
            "schedule", "safety_guidelines", "what_to_bring",
            "language", "itinerary", "created_at", "updated_at",
            "host_display_name", "host_avatar_url", "host_bio",
            "host_languages", "host_subscription_tier",
        )
        return _serialize(row, cols)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("")
def create_experience(body: ExperienceCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.experiences
                   (host_id, title, description, tags, city, duration, price,
                    max_people, meeting_point, schedule, safety_guidelines,
                    what_to_bring, language, itinerary)
               VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s,
                       %s::timestamptz, %s, %s, %s, %s)
               RETURNING id, created_at""",
            (
                user_id,
                body.title,
                body.description,
                body.tags,
                body.city,
                body.duration,
                body.price,
                body.max_people,
                body.meeting_point,
                body.schedule,
                body.safety_guidelines,
                body.what_to_bring,
                body.language,
                body.itinerary,
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return {"id": str(row[0]), "created_at": str(row[1]), "title": body.title}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.get("/{experience_id}/my-request")
def get_my_request(experience_id: str, user_id: str = Depends(require_auth)):
    """Return the caller's own join request for an experience (traveller view)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, experience_id, traveller_id, message, status, created_at
               FROM public.experience_join_requests
               WHERE experience_id = %s::uuid AND traveller_id = %s::uuid""",
            (experience_id, user_id),
        )
        row = cur.fetchone()
        if not row:
            return None
        cols = ("id", "experience_id", "traveller_id", "message", "status", "created_at")
        return _serialize(row, cols)
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/{experience_id}/join")
def join_experience(
    experience_id: str,
    body: JoinRequestCreate,
    user_id: str = Depends(require_auth),
):
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Verify experience exists
        cur.execute(
            "SELECT id FROM public.experiences WHERE id = %s::uuid",
            (experience_id,),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Experience not found")
        cur.execute(
            """INSERT INTO public.experience_join_requests
                   (experience_id, traveller_id, message, status)
               VALUES (%s::uuid, %s::uuid, %s, 'pending')
               RETURNING id, created_at""",
            (experience_id, user_id, body.message),
        )
        row = cur.fetchone()
        conn.commit()
        return {"id": str(row[0]), "created_at": str(row[1]), "status": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.get("/{experience_id}/requests")
def list_requests(experience_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Verify experience exists and caller is the host
        cur.execute(
            "SELECT host_id FROM public.experiences WHERE id = %s::uuid",
            (experience_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Experience not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Only the host can view requests")
        cur.execute(
            """SELECT r.id, r.experience_id, r.traveller_id, r.message, r.status, r.created_at,
                      pr.display_name AS requester_display_name,
                      pr.avatar_url AS requester_avatar_url
               FROM public.experience_join_requests r
               LEFT JOIN public.profiles pr ON pr.user_id = r.traveller_id
               WHERE r.experience_id = %s::uuid
               ORDER BY r.created_at ASC""",
            (experience_id,),
        )
        cols = (
            "id", "experience_id", "traveller_id", "message", "status", "created_at",
            "requester_display_name", "requester_avatar_url",
        )
        return [_serialize(row, cols) for row in cur.fetchall()]
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.patch("/{experience_id}/requests/{req_id}")
def update_request(
    experience_id: str,
    req_id: str,
    body: JoinRequestUpdate,
    user_id: str = Depends(require_auth),
):
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Verify caller is the host
        cur.execute(
            "SELECT host_id FROM public.experiences WHERE id = %s::uuid",
            (experience_id,),
        )
        exp_row = cur.fetchone()
        if not exp_row:
            raise HTTPException(status_code=404, detail="Experience not found")
        if str(exp_row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Only the host can update requests")
        cur.execute(
            """UPDATE public.experience_join_requests
               SET status = %s
               WHERE id = %s::uuid AND experience_id = %s::uuid
               RETURNING id, status""",
            (body.status, req_id, experience_id),
        )
        upd = cur.fetchone()
        if not upd:
            raise HTTPException(status_code=404, detail="Request not found")
        conn.commit()
        return {"id": str(upd[0]), "status": upd[1]}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)
