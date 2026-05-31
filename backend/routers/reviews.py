"""Toilet reviews — Neon-backed."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_conn, put_conn
from middleware.auth import require_auth

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ToiletReviewUpsert(BaseModel):
    toilet_key: str
    toilet_name: str
    latitude: float
    longitude: float
    rating: int
    comment: Optional[str] = None


@router.get("/toilet")
def list_toilet_reviews(toilet_key: str, user_id: str = Depends(require_auth)):
    """Return all reviews for a given toilet_key, with reviewer display names."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT r.id, r.user_id, r.toilet_key, r.rating, r.comment, r.created_at,
                      pr.display_name, pr.avatar_url
               FROM public.toilet_reviews r
               LEFT JOIN public.profiles pr ON pr.user_id = r.user_id
               WHERE r.toilet_key = %s
               ORDER BY r.created_at DESC""",
            (toilet_key,),
        )
        rows = cur.fetchall()
        return [
            {
                "id": str(r[0]),
                "user_id": str(r[1]),
                "toilet_key": r[2],
                "rating": r[3],
                "comment": r[4],
                "created_at": str(r[5]),
                "profiles": {"display_name": r[6], "avatar_url": r[7]},
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/toilet")
def upsert_toilet_review(body: ToiletReviewUpsert, user_id: str = Depends(require_auth)):
    """Insert or update the caller's review for a toilet (unique on user_id + toilet_key)."""
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    trimmed = (body.comment or "").strip()[:500] or None
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.toilet_reviews
                   (user_id, toilet_key, toilet_name, latitude, longitude, rating, comment)
               VALUES (%s::uuid, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (user_id, toilet_key)
               DO UPDATE SET
                   rating = EXCLUDED.rating,
                   comment = EXCLUDED.comment,
                   toilet_name = EXCLUDED.toilet_name,
                   latitude = EXCLUDED.latitude,
                   longitude = EXCLUDED.longitude,
                   updated_at = now()
               RETURNING id""",
            (user_id, body.toilet_key, body.toilet_name, body.latitude, body.longitude, body.rating, trimmed),
        )
        review_id = cur.fetchone()[0]
        conn.commit()
        return {"id": str(review_id)}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.delete("/toilet/{review_id}")
def delete_toilet_review(review_id: str, user_id: str = Depends(require_auth)):
    """Delete a toilet review owned by the caller."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM public.toilet_reviews WHERE id = %s::uuid AND user_id = %s::uuid RETURNING id",
            (review_id, user_id),
        )
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Review not found or not owned by you")
        conn.commit()
        return {"deleted": review_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)
