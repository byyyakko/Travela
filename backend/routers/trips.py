"""Trips, itinerary items, and itinerary history — Neon-backed."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from psycopg2.extras import Json
from db import get_conn, put_conn
from middleware.auth import require_auth

router = APIRouter(prefix="/trips", tags=["trips"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TripCreate(BaseModel):
    name: str
    country: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    interests: Optional[list[str]] = None
    status: Optional[str] = "planned"
    notes: Optional[str] = None


class TripStatusUpdate(BaseModel):
    status: str


class TripUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    interests: Optional[list[str]] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ItineraryItemCreate(BaseModel):
    day_date: str
    title: str
    description: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = "activity"
    order_index: Optional[int] = None


class ItineraryItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    order_index: Optional[int] = None
    day_date: Optional[str] = None


class ItineraryHistoryCreate(BaseModel):
    title: str
    prompt: Optional[str] = None
    itinerary_data: Optional[dict] = None


# ── Trips ─────────────────────────────────────────────────────────────────────

@router.get("")
def list_trips(user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, user_id, name, country, start_date, end_date,
                      interests, status, notes, created_at, updated_at
               FROM public.trips
               WHERE user_id = %s::uuid
               ORDER BY created_at DESC""",
            (user_id,),
        )
        cols = (
            "id", "user_id", "name", "country", "start_date", "end_date",
            "interests", "status", "notes", "created_at", "updated_at",
        )
        return [
            {c: (str(v) if hasattr(v, "isoformat") else v)
             for c, v in zip(cols, row)}
            for row in cur.fetchall()
        ]
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("")
def create_trip(body: TripCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.trips
                   (user_id, name, country, start_date, end_date, interests, status, notes)
               VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, created_at""",
            (
                user_id,
                body.name,
                body.country,
                body.start_date,
                body.end_date,
                body.interests,
                body.status,
                body.notes,
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return {"id": str(row[0]), "created_at": str(row[1])}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.patch("/{trip_id}")
def update_trip(trip_id: str, body: TripUpdate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.trips WHERE id = %s::uuid",
            (trip_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trip not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not your trip")
        updates = body.model_dump(exclude_none=True)
        if not updates:
            return {"updated": False}
        set_clauses = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [trip_id]
        cur.execute(
            f"UPDATE public.trips SET {set_clauses}, updated_at = NOW() WHERE id = %s::uuid",
            values,
        )
        conn.commit()
        return {"updated": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.delete("/{trip_id}")
def delete_trip(trip_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.trips WHERE id = %s::uuid",
            (trip_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trip not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not your trip")
        cur.execute("DELETE FROM public.trips WHERE id = %s::uuid", (trip_id,))
        conn.commit()
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


# ── Itinerary History (must be before /{trip_id}/items routes) ────────────────

@router.get("/history")
def list_history(limit: int = 20, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, user_id, prompt, title, itinerary_data, created_at, updated_at
               FROM public.itinerary_history
               WHERE user_id = %s::uuid
               ORDER BY created_at DESC
               LIMIT %s""",
            (user_id, limit),
        )
        cols = ("id", "user_id", "prompt", "title", "itinerary_data", "created_at", "updated_at")
        return [
            {c: (str(v) if hasattr(v, "isoformat") else v)
             for c, v in zip(cols, row)}
            for row in cur.fetchall()
        ]
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/history")
def save_history(body: ItineraryHistoryCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.itinerary_history
                   (user_id, prompt, title, itinerary_data)
               VALUES (%s::uuid, %s, %s, %s)
               RETURNING id, created_at""",
            (
                user_id,
                body.prompt,
                body.title,
                Json(body.itinerary_data or {}),
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return {"id": str(row[0]), "created_at": str(row[1])}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.delete("/history/{history_id}")
def delete_history(history_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.itinerary_history WHERE id = %s::uuid",
            (history_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="History item not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not your history")
        cur.execute(
            "DELETE FROM public.itinerary_history WHERE id = %s::uuid",
            (history_id,),
        )
        conn.commit()
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


# ── Itinerary Items ───────────────────────────────────────────────────────────

@router.get("/{trip_id}/items")
def list_items(trip_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, trip_id, user_id, day_date, title, description,
                      time, location, category, order_index, created_at, updated_at
               FROM public.itinerary_items
               WHERE trip_id = %s::uuid AND user_id = %s::uuid
               ORDER BY day_date ASC, order_index ASC NULLS LAST, created_at ASC""",
            (trip_id, user_id),
        )
        cols = (
            "id", "trip_id", "user_id", "day_date", "title", "description",
            "time", "location", "category", "order_index", "created_at", "updated_at",
        )
        return [
            {c: (str(v) if hasattr(v, "isoformat") else v)
             for c, v in zip(cols, row)}
            for row in cur.fetchall()
        ]
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/{trip_id}/items")
def add_item(trip_id: str, body: ItineraryItemCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.itinerary_items
                   (trip_id, user_id, day_date, title, description, time, location, category, order_index)
               VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, created_at""",
            (
                trip_id,
                user_id,
                body.day_date,
                body.title,
                body.description,
                body.time,
                body.location,
                body.category,
                body.order_index,
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return {"id": str(row[0]), "created_at": str(row[1])}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.patch("/{trip_id}/items/{item_id}")
def update_item(
    trip_id: str,
    item_id: str,
    body: ItineraryItemUpdate,
    user_id: str = Depends(require_auth),
):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.itinerary_items WHERE id = %s::uuid AND trip_id = %s::uuid",
            (item_id, trip_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not your item")

        updates = body.model_dump(exclude_none=True)
        if not updates:
            return {"updated": False}

        set_clauses = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [item_id]
        cur.execute(
            f"UPDATE public.itinerary_items SET {set_clauses}, updated_at = NOW() WHERE id = %s::uuid",
            values,
        )
        conn.commit()
        return {"updated": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.delete("/{trip_id}/items/{item_id}")
def delete_item(trip_id: str, item_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.itinerary_items WHERE id = %s::uuid AND trip_id = %s::uuid",
            (item_id, trip_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not your item")
        cur.execute(
            "DELETE FROM public.itinerary_items WHERE id = %s::uuid",
            (item_id,),
        )
        conn.commit()
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)
