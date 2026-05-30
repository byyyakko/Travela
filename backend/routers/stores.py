"""Store CRUD endpoints — Neon-backed."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import get_conn, put_conn
from middleware.auth import require_auth

router = APIRouter(prefix="/stores", tags=["stores"])

_STORE_COLS = (
    "id", "user_id", "store_name", "phone", "store_type", "subscription_tier",
    "address", "latitude", "longitude", "country", "description", "website_url",
    "dietary_options", "created_at", "updated_at",
)

_ITEM_COLS = (
    "id", "store_id", "name", "description", "image_url", "ordering_tip",
    "price", "created_at", "updated_at",
)

_IMAGE_COLS = (
    "id", "store_id", "image_url", "caption", "display_order", "created_at",
)


def _serialize(row: tuple, cols: tuple) -> dict:
    return {c: (str(v) if hasattr(v, "isoformat") else v) for c, v in zip(cols, row)}


# ── Store models ──────────────────────────────────────────────────────────────

class StoreCreate(BaseModel):
    store_name: str
    store_type: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None
    dietary_options: Optional[list[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    subscription_tier: Optional[str] = "tier_0"


class StoreUpdate(BaseModel):
    store_name: Optional[str] = None
    store_type: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None
    dietary_options: Optional[list[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    subscription_tier: Optional[str] = None


# ── Item models ───────────────────────────────────────────────────────────────

class StoreItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    ordering_tip: Optional[str] = None
    price: Optional[str] = None


class StoreItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    ordering_tip: Optional[str] = None
    price: Optional[str] = None


# ── Image models ──────────────────────────────────────────────────────────────

class StoreImageCreate(BaseModel):
    image_url: str
    caption: Optional[str] = None
    display_order: Optional[int] = 0


# ── Visit models ──────────────────────────────────────────────────────────────

class StoreVisitCreate(BaseModel):
    visitor_country: Optional[str] = None
    page_viewed: Optional[str] = None


# ── Store endpoints ───────────────────────────────────────────────────────────

@router.get("/me")
def get_my_store(user_id: str = Depends(require_auth)):
    """Get the store owned by the authenticated user."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = ", ".join(_STORE_COLS)
        cur.execute(
            f"SELECT {cols} FROM public.stores WHERE user_id = %s::uuid",
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Store not found")
        return _serialize(row, _STORE_COLS)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.get("/{store_id}")
def get_store(store_id: str, user_id: str = Depends(require_auth)):
    """Public store view by ID."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = ", ".join(_STORE_COLS)
        cur.execute(
            f"SELECT {cols} FROM public.stores WHERE id = %s::uuid",
            (store_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Store not found")
        return _serialize(row, _STORE_COLS)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("")
def create_store(body: StoreCreate, user_id: str = Depends(require_auth)):
    """Create a new store owned by the authenticated user."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.stores
                   (user_id, store_name, store_type, phone, address, country,
                    description, website_url, dietary_options, latitude, longitude,
                    subscription_tier)
               VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, created_at""",
            (
                user_id,
                body.store_name,
                body.store_type,
                body.phone,
                body.address,
                body.country,
                body.description,
                body.website_url,
                body.dietary_options,
                body.latitude,
                body.longitude,
                body.subscription_tier or "tier_0",
            ),
        )
        row = cur.fetchone()
        conn.commit()
        return {"id": str(row[0]), "created_at": str(row[1]), "store_name": body.store_name}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.patch("/{store_id}")
def update_store(store_id: str, body: StoreUpdate, user_id: str = Depends(require_auth)):
    """Update own store (verifies ownership)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Verify ownership
        cur.execute(
            "SELECT user_id FROM public.stores WHERE id = %s::uuid",
            (store_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Store not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not the store owner")

        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [store_id]
        cur.execute(
            f"UPDATE public.stores SET {set_clause}, updated_at = now() WHERE id = %s::uuid",
            values,
        )
        conn.commit()
        return {"updated": store_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


# ── Item endpoints ────────────────────────────────────────────────────────────

@router.get("/{store_id}/items")
def list_store_items(store_id: str, user_id: str = Depends(require_auth)):
    """List all items for a store."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = ", ".join(_ITEM_COLS)
        cur.execute(
            f"SELECT {cols} FROM public.store_items WHERE store_id = %s::uuid ORDER BY created_at ASC",
            (store_id,),
        )
        return [_serialize(row, _ITEM_COLS) for row in cur.fetchall()]
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/{store_id}/items")
def add_store_item(store_id: str, body: StoreItemCreate, user_id: str = Depends(require_auth)):
    """Add an item to a store (ownership check)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.stores WHERE id = %s::uuid",
            (store_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Store not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not the store owner")

        cur.execute(
            """INSERT INTO public.store_items
                   (store_id, name, description, image_url, ordering_tip, price)
               VALUES (%s::uuid, %s, %s, %s, %s, %s)
               RETURNING id, created_at""",
            (store_id, body.name, body.description, body.image_url, body.ordering_tip, body.price),
        )
        item_row = cur.fetchone()
        conn.commit()
        return {"id": str(item_row[0]), "created_at": str(item_row[1]), "name": body.name}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.patch("/{store_id}/items/{item_id}")
def update_store_item(
    store_id: str,
    item_id: str,
    body: StoreItemUpdate,
    user_id: str = Depends(require_auth),
):
    """Update a store item (ownership check)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.stores WHERE id = %s::uuid",
            (store_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Store not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not the store owner")

        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [item_id, store_id]
        cur.execute(
            f"UPDATE public.store_items SET {set_clause}, updated_at = now() WHERE id = %s::uuid AND store_id = %s::uuid",
            values,
        )
        conn.commit()
        return {"updated": item_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.delete("/{store_id}/items/{item_id}")
def delete_store_item(store_id: str, item_id: str, user_id: str = Depends(require_auth)):
    """Delete a store item (ownership check)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.stores WHERE id = %s::uuid",
            (store_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Store not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not the store owner")

        cur.execute(
            "DELETE FROM public.store_items WHERE id = %s::uuid AND store_id = %s::uuid",
            (item_id, store_id),
        )
        conn.commit()
        return {"deleted": item_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


# ── Image endpoints ───────────────────────────────────────────────────────────

@router.get("/{store_id}/images")
def list_store_images(store_id: str, user_id: str = Depends(require_auth)):
    """List all images for a store."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cols = ", ".join(_IMAGE_COLS)
        cur.execute(
            f"SELECT {cols} FROM public.store_images WHERE store_id = %s::uuid ORDER BY display_order ASC",
            (store_id,),
        )
        return [_serialize(row, _IMAGE_COLS) for row in cur.fetchall()]
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/{store_id}/images")
def add_store_image(store_id: str, body: StoreImageCreate, user_id: str = Depends(require_auth)):
    """Add an image to a store (ownership check)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.stores WHERE id = %s::uuid",
            (store_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Store not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not the store owner")

        cur.execute(
            """INSERT INTO public.store_images
                   (store_id, image_url, caption, display_order)
               VALUES (%s::uuid, %s, %s, %s)
               RETURNING id, created_at""",
            (store_id, body.image_url, body.caption, body.display_order),
        )
        img_row = cur.fetchone()
        conn.commit()
        return {"id": str(img_row[0]), "created_at": str(img_row[1]), "image_url": body.image_url}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.delete("/{store_id}/images/{image_id}")
def delete_store_image(store_id: str, image_id: str, user_id: str = Depends(require_auth)):
    """Delete a store image (ownership check)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.stores WHERE id = %s::uuid",
            (store_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Store not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not the store owner")

        cur.execute(
            "DELETE FROM public.store_images WHERE id = %s::uuid AND store_id = %s::uuid",
            (image_id, store_id),
        )
        conn.commit()
        return {"deleted": image_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


# ── Visit endpoint ────────────────────────────────────────────────────────────

@router.post("/{store_id}/visits")
def record_store_visit(store_id: str, body: StoreVisitCreate = StoreVisitCreate(), user_id: str = Depends(require_auth)):
    """Record a store visit (ON CONFLICT DO NOTHING)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.store_visits
                   (store_id, visitor_user_id, visitor_country, page_viewed)
               VALUES (%s::uuid, %s::uuid, %s, %s)
               ON CONFLICT DO NOTHING""",
            (store_id, user_id, body.visitor_country, body.page_viewed),
        )
        conn.commit()
        return {"recorded": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)
