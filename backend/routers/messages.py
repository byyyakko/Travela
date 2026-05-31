"""Conversations and messages — Neon-backed REST endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from db import get_conn, put_conn
from middleware.auth import require_auth

router = APIRouter(prefix="/conversations", tags=["messages"])

# ── In-memory WebSocket registry ─────────────────────────────────────────────
# Maps conversation_id -> set of connected WebSocket clients
_connections: dict[str, set[WebSocket]] = {}


# ── Schemas ──────────────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    other_user_id: str


class ConversationPatch(BaseModel):
    accepted: bool


class MessageCreate(BaseModel):
    content: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _row_to_dict(cols: tuple, row: tuple) -> dict:
    return {
        c: (str(v) if hasattr(v, "isoformat") else v)
        for c, v in zip(cols, row)
    }


async def _broadcast(conversation_id: str, payload: dict) -> None:
    """Send JSON payload to all WebSocket subscribers of a conversation."""
    subscribers = _connections.get(conversation_id, set())
    dead: set[WebSocket] = set()
    for ws in subscribers:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.add(ws)
    subscribers -= dead


# ── REST Endpoints ────────────────────────────────────────────────────────────

@router.get("")
def list_conversations(user_id: str = Depends(require_auth)):
    """List all conversations for the authenticated user, enriched with the
    other participant's display_name/avatar_url and the last message."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                c.id,
                c.participant1_id,
                c.participant2_id,
                c.accepted,
                c.declined_at,
                c.created_at,
                c.updated_at,
                -- Other participant profile
                CASE
                    WHEN c.participant1_id = %s::uuid THEN p2.display_name
                    ELSE p1.display_name
                END AS other_display_name,
                CASE
                    WHEN c.participant1_id = %s::uuid THEN p2.avatar_url
                    ELSE p1.avatar_url
                END AS other_avatar_url,
                CASE
                    WHEN c.participant1_id = %s::uuid THEN c.participant2_id
                    ELSE c.participant1_id
                END AS other_user_id,
                -- Last message
                lm.content AS last_message_content,
                lm.created_at AS last_message_at
            FROM public.conversations c
            LEFT JOIN public.profiles p1 ON p1.user_id = c.participant1_id
            LEFT JOIN public.profiles p2 ON p2.user_id = c.participant2_id
            LEFT JOIN LATERAL (
                SELECT content, created_at
                FROM public.messages
                WHERE conversation_id = c.id
                ORDER BY created_at DESC
                LIMIT 1
            ) lm ON true
            WHERE c.participant1_id = %s::uuid
               OR c.participant2_id = %s::uuid
            ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
            """,
            (user_id, user_id, user_id, user_id, user_id),
        )
        cols = (
            "id", "participant1_id", "participant2_id", "accepted",
            "declined_at", "created_at", "updated_at",
            "other_display_name", "other_avatar_url", "other_user_id",
            "last_message_content", "last_message_at",
        )
        return [_row_to_dict(cols, row) for row in cur.fetchall()]
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("")
def find_or_create_conversation(
    body: ConversationCreate,
    user_id: str = Depends(require_auth),
):
    """Idempotently find or create a conversation between the caller and other_user_id.
    participant1_id is always the lexicographically smaller UUID so the UNIQUE
    constraint (participant1_id, participant2_id) prevents duplicates."""
    other = body.other_user_id
    if other == user_id:
        raise HTTPException(status_code=400, detail="Cannot start a conversation with yourself")

    # Stable ordering so that (A,B) and (B,A) map to the same row
    p1, p2 = sorted([user_id, other])

    conn = get_conn()
    try:
        cur = conn.cursor()
        # Check for existing conversation
        cur.execute(
            """
            SELECT id, participant1_id, participant2_id, accepted, declined_at,
                   created_at, updated_at
            FROM public.conversations
            WHERE participant1_id = %s::uuid AND participant2_id = %s::uuid
            """,
            (p1, p2),
        )
        row = cur.fetchone()
        if row:
            cols = (
                "id", "participant1_id", "participant2_id", "accepted",
                "declined_at", "created_at", "updated_at",
            )
            return _row_to_dict(cols, row)

        # Create new conversation; accepted defaults to NULL (pending)
        cur.execute(
            """
            INSERT INTO public.conversations (participant1_id, participant2_id)
            VALUES (%s::uuid, %s::uuid)
            RETURNING id, participant1_id, participant2_id, accepted,
                      declined_at, created_at, updated_at
            """,
            (p1, p2),
        )
        row = cur.fetchone()
        conn.commit()
        cols = (
            "id", "participant1_id", "participant2_id", "accepted",
            "declined_at", "created_at", "updated_at",
        )
        return _row_to_dict(cols, row)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.patch("/{conversation_id}")
def patch_conversation(
    conversation_id: str,
    body: ConversationPatch,
    user_id: str = Depends(require_auth),
):
    """Accept or decline a message request.
    Only the non-initiating participant (participant2_id when p1 < p2 ordering,
    but practically: whoever did NOT create the conversation) may respond.
    We allow either participant to call this for flexibility."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT participant1_id, participant2_id
            FROM public.conversations
            WHERE id = %s::uuid
            """,
            (conversation_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Conversation not found")

        p1_id, p2_id = str(row[0]), str(row[1])
        if user_id not in (p1_id, p2_id):
            raise HTTPException(status_code=403, detail="Not a participant")

        if body.accepted:
            cur.execute(
                """
                UPDATE public.conversations
                SET accepted = true, declined_at = NULL, updated_at = now()
                WHERE id = %s::uuid
                """,
                (conversation_id,),
            )
        else:
            cur.execute(
                """
                UPDATE public.conversations
                SET accepted = false, declined_at = now(), updated_at = now()
                WHERE id = %s::uuid
                """,
                (conversation_id,),
            )
        conn.commit()
        return {"updated": True, "accepted": body.accepted}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.get("/{conversation_id}/messages")
def list_messages(
    conversation_id: str,
    limit: int = 50,
    before_id: Optional[str] = None,
    user_id: str = Depends(require_auth),
):
    """Return paginated messages for a conversation (newest-first).
    Use before_id (a message UUID) as a cursor for pagination."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Verify participant
        cur.execute(
            """
            SELECT id FROM public.conversations
            WHERE id = %s::uuid
              AND (participant1_id = %s::uuid OR participant2_id = %s::uuid)
            """,
            (conversation_id, user_id, user_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="Not a participant or conversation not found")

        if before_id:
            cur.execute(
                """
                SELECT id, conversation_id, sender_id, content, read, created_at
                FROM public.messages
                WHERE conversation_id = %s::uuid
                  AND created_at < (
                      SELECT created_at FROM public.messages WHERE id = %s::uuid
                  )
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (conversation_id, before_id, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, conversation_id, sender_id, content, read, created_at
                FROM public.messages
                WHERE conversation_id = %s::uuid
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (conversation_id, limit),
            )

        cols = ("id", "conversation_id", "sender_id", "content", "read", "created_at")
        return [_row_to_dict(cols, row) for row in cur.fetchall()]
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: MessageCreate,
    user_id: str = Depends(require_auth),
):
    """Insert a message, bump conversation updated_at, broadcast via WebSocket."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        # Verify participant
        cur.execute(
            """
            SELECT id FROM public.conversations
            WHERE id = %s::uuid
              AND (participant1_id = %s::uuid OR participant2_id = %s::uuid)
            """,
            (conversation_id, user_id, user_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="Not a participant or conversation not found")

        cur.execute(
            """
            INSERT INTO public.messages (conversation_id, sender_id, content)
            VALUES (%s::uuid, %s::uuid, %s)
            RETURNING id, conversation_id, sender_id, content, read, created_at
            """,
            (conversation_id, user_id, body.content),
        )
        row = cur.fetchone()

        # Bump conversation updated_at so list stays sorted
        cur.execute(
            "UPDATE public.conversations SET updated_at = now() WHERE id = %s::uuid",
            (conversation_id,),
        )
        conn.commit()

        cols = ("id", "conversation_id", "sender_id", "content", "read", "created_at")
        message = _row_to_dict(cols, row)

        # Broadcast to WebSocket subscribers
        await _broadcast(conversation_id, {"type": "message", "data": message})

        return message
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        put_conn(conn)
