"""Posts, likes, comments, bookmarks — Neon-backed."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import get_conn, put_conn
from middleware.auth import require_auth

router = APIRouter(prefix="/posts", tags=["posts"])


class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None
    location_tag: Optional[str] = None
    category: Optional[str] = None


class CommentCreate(BaseModel):
    content: str


@router.get("")
def list_posts(limit: int = 20, offset: int = 0, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT p.id, p.user_id, p.content, p.image_url, p.image_urls,
                      p.location_tag, p.category, p.created_at,
                      pr.display_name, pr.avatar_url,
                      COUNT(DISTINCT pl.id) AS like_count,
                      COUNT(DISTINCT pc.id) AS comment_count
               FROM public.posts p
               LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
               LEFT JOIN public.post_likes pl ON pl.post_id = p.id
               LEFT JOIN public.post_comments pc ON pc.post_id = p.id
               GROUP BY p.id, pr.display_name, pr.avatar_url
               ORDER BY p.created_at DESC
               LIMIT %s OFFSET %s""",
            (limit, offset),
        )
        cols = (
            "id", "user_id", "content", "image_url", "image_urls",
            "location_tag", "category", "created_at",
            "display_name", "avatar_url", "like_count", "comment_count",
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
def create_post(body: PostCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.posts
                   (user_id, content, image_url, image_urls, location_tag, category)
               VALUES (%s::uuid, %s, %s, %s, %s, %s)
               RETURNING id, created_at""",
            (
                user_id,
                body.content,
                body.image_url,
                body.image_urls,
                body.location_tag,
                body.category,
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


@router.delete("/{post_id}")
def delete_post(post_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id FROM public.posts WHERE id = %s::uuid",
            (post_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Post not found")
        if str(row[0]) != user_id:
            raise HTTPException(status_code=403, detail="Not your post")
        cur.execute("DELETE FROM public.posts WHERE id = %s::uuid", (post_id,))
        conn.commit()
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/{post_id}/likes")
def toggle_like(post_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM public.post_likes WHERE post_id = %s::uuid AND user_id = %s::uuid",
            (post_id, user_id),
        )
        if cur.fetchone():
            cur.execute(
                "DELETE FROM public.post_likes WHERE post_id = %s::uuid AND user_id = %s::uuid",
                (post_id, user_id),
            )
            conn.commit()
            return {"liked": False}
        cur.execute(
            "INSERT INTO public.post_likes (post_id, user_id) VALUES (%s::uuid, %s::uuid)",
            (post_id, user_id),
        )
        conn.commit()
        return {"liked": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.get("/{post_id}/comments")
def list_comments(post_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT pc.id, pc.user_id, pc.content, pc.created_at,
                      pr.display_name, pr.avatar_url
               FROM public.post_comments pc
               LEFT JOIN public.profiles pr ON pr.user_id = pc.user_id
               WHERE pc.post_id = %s::uuid
               ORDER BY pc.created_at ASC""",
            (post_id,),
        )
        cols = ("id", "user_id", "content", "created_at", "display_name", "avatar_url")
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


@router.post("/{post_id}/comments")
def add_comment(post_id: str, body: CommentCreate, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO public.post_comments (post_id, user_id, content)
               VALUES (%s::uuid, %s::uuid, %s)
               RETURNING id, created_at""",
            (post_id, user_id, body.content),
        )
        row = cur.fetchone()
        conn.commit()
        return {"id": str(row[0]), "created_at": str(row[1])}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/{post_id}/bookmarks")
def toggle_bookmark(post_id: str, user_id: str = Depends(require_auth)):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM public.post_bookmarks WHERE post_id = %s::uuid AND user_id = %s::uuid",
            (post_id, user_id),
        )
        if cur.fetchone():
            cur.execute(
                "DELETE FROM public.post_bookmarks WHERE post_id = %s::uuid AND user_id = %s::uuid",
                (post_id, user_id),
            )
            conn.commit()
            return {"bookmarked": False}
        cur.execute(
            "INSERT INTO public.post_bookmarks (post_id, user_id) VALUES (%s::uuid, %s::uuid)",
            (post_id, user_id),
        )
        conn.commit()
        return {"bookmarked": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)
