"""
AI router — replaces Supabase edge functions ai-travel and tori-tan-chat.
All endpoints require a valid Supabase JWT.
"""

import os
import re
import json
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from middleware.auth import require_auth
from db import get_conn, put_conn

router = APIRouter(prefix="/ai", tags=["ai"])

_claude = None
_voyage = None


def get_claude():
    global _claude
    if _claude is None:
        import anthropic
        _claude = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _claude


def get_voyage():
    global _voyage
    if _voyage is None:
        import voyageai
        _voyage = voyageai.Client(api_key=os.environ["VOYAGE_API_KEY"])
    return _voyage


def retrieve_chunks(query_embedding: list[float], top_k: int = 8) -> list[str]:
    """Return top_k RAG chunk contents by cosine similarity. Falls back to [] if no embeddings."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM public.rag_chunks WHERE embedding IS NOT NULL"
        )
        if cur.fetchone()[0] == 0:
            return []
        cur.execute(
            "SELECT content FROM public.rag_chunks ORDER BY embedding <=> %s::vector LIMIT %s",
            (query_embedding, top_k),
        )
        return [row[0] for row in cur.fetchall()]
    finally:
        put_conn(conn)


def log_query(user_id: str, query: str, query_embedding: list[float], response: str, latency_ms: int):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO public.rag_query_logs
                (user_id, query_text, query_embedding, llm_response, latency_ms)
            VALUES (%s, %s, %s::vector, %s, %s)
            """,
            (user_id, query, query_embedding, response, latency_ms),
        )
        conn.commit()
    except Exception:
        pass  # logging failure must never break the request
    finally:
        put_conn(conn)


def extract_json(text: str):
    """Parse JSON from Claude response, stripping markdown code fences if present."""
    try:
        return json.loads(text)
    except Exception:
        pass
    cleaned = re.sub(r"^[\s\S]*?```(?:json)?\s*\n?", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n?\s*```[\s\S]*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()
    if not cleaned.startswith("{"):
        idx = cleaned.find("{")
        if idx != -1:
            cleaned = cleaned[idx:]
    return json.loads(cleaned)


def embed_query(text: str) -> list[float] | None:
    """Generate a Voyage-3 query embedding. Returns None if VOYAGE_API_KEY not set."""
    key = os.environ.get("VOYAGE_API_KEY")
    if not key:
        return None
    result = get_voyage().embed([text], model="voyage-3", input_type="query")
    return result.embeddings[0]


# ── Request schemas ───────────────────────────────────────────────────────────

class ItineraryRequest(BaseModel):
    prompt: str

class PhrasesRequest(BaseModel):
    country: str

class ChatRequest(BaseModel):
    messages: list[dict]  # [{role: "user"|"assistant", content: str}]

class AttractionsRequest(BaseModel):
    country: str
    category: Optional[str] = None

class TranslationRequest(BaseModel):
    message: str
    destination_country: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/itinerary")
async def generate_itinerary(req: ItineraryRequest, user_id: str = Depends(require_auth)):
    start = time.time()
    claude = get_claude()

    query_vec = embed_query(req.prompt)
    chunks = retrieve_chunks(query_vec) if query_vec else []
    context = "\n\n---\n\n".join(chunks)

    system = f"""You are a local travel expert. Create an authentic, detailed itinerary.
{f'Use this knowledge base context:{chr(10)}{context}{chr(10)}' if context else ''}
Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{{"title":"...","description":"...","days":[{{"day":1,"theme":"...","activities":[{{"time":"9:00 AM","title":"...","description":"...","category":"food|culture|adventure|sightseeing","location":"..."}}]}}]}}"""

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        system=system,
        messages=[{"role": "user", "content": req.prompt}],
    )
    result = response.content[0].text
    latency = int((time.time() - start) * 1000)

    if query_vec:
        log_query(user_id, req.prompt, query_vec, result, latency)

    try:
        return extract_json(result)
    except Exception:
        return {"raw": result}


@router.post("/phrases")
async def get_phrases(req: PhrasesRequest, user_id: str = Depends(require_auth)):
    claude = get_claude()
    system = """Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{"country":"...","language":"...","phrases":[{"category":"Greetings","phrases":[{"local":"...","english":"...","pronunciation":"..."}]}]}"""
    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=system,
        messages=[{"role": "user", "content": f"Travel phrases for {req.country}"}],
    )
    try:
        return extract_json(response.content[0].text)
    except Exception:
        return {"raw": response.content[0].text}


@router.post("/chat")
async def tori_tan_chat(req: ChatRequest, user_id: str = Depends(require_auth)):
    start = time.time()
    claude = get_claude()

    last_user_msg = next(
        (m["content"] for m in reversed(req.messages) if m["role"] == "user"), ""
    )
    query_vec = embed_query(last_user_msg) if last_user_msg else None
    chunks = retrieve_chunks(query_vec, top_k=5) if query_vec else []
    context = "\n\n".join(chunks)

    system = f"""You are Tori-Tan, a friendly local travel companion AI. You help travellers discover local culture, food, and hidden gems.
{f'Use this travel knowledge:{chr(10)}{context}' if context else ''}"""

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=system,
        messages=req.messages,
    )
    result = response.content[0].text
    latency = int((time.time() - start) * 1000)

    if query_vec:
        log_query(user_id, last_user_msg, query_vec, result, latency)

    return {"role": "assistant", "content": result}


@router.post("/attractions")
async def get_attractions(req: AttractionsRequest, user_id: str = Depends(require_auth)):
    claude = get_claude()
    category_note = f"Focus on {req.category} attractions." if req.category else "Cover all attraction categories."
    system = f"""You are a world travel expert. {category_note}
Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{{"country":"...","attractions":[{{"name":"...","category":"...","description":"...","location":"...","latitude":0.0,"longitude":0.0,"rating":4.5,"price_level":"free|budget|moderate|expensive"}}]}}"""
    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=system,
        messages=[{"role": "user", "content": f"Best places to visit in {req.country}"}],
    )
    try:
        return extract_json(response.content[0].text)
    except Exception:
        return {"raw": response.content[0].text}


@router.post("/translate")
async def cultural_translation(req: TranslationRequest, user_id: str = Depends(require_auth)):
    """Cultural context analysis for a message (replaces ai-travel cultural-translation type)."""
    claude = get_claude()
    country_note = f"The sender is from {req.destination_country}." if req.destination_country else ""
    system = f"""You are a cultural interpreter for travellers. {country_note}
Analyse the cultural context of the message and return ONLY valid JSON:
{{"cultural_context":"...","suggested_response":"...","tips":["...","..."],"politeness_level":"formal|casual|neutral"}}"""
    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        system=system,
        messages=[{"role": "user", "content": req.message}],
    )
    import json
    try:
        return json.loads(response.content[0].text)
    except Exception:
        return {
            "cultural_context": response.content[0].text,
            "suggested_response": "",
            "tips": [],
            "politeness_level": "neutral",
        }
