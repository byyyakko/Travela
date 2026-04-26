"""Utility endpoints replacing Lovable Supabase edge functions."""
import os, json, base64
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.auth import require_auth
from routers.ai import get_claude

router = APIRouter(prefix="/utils", tags=["utils"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class GeocodeRequest(BaseModel):
    address: str

class ProfanityRequest(BaseModel):
    text: str

class ToiletsRequest(BaseModel):
    latitude: float
    longitude: float

class ModerateImageRequest(BaseModel):
    image_url: str


# ── Geocode (free Nominatim, no auth needed) ──────────────────────────────────

@router.post("/geocode")
def geocode(req: GeocodeRequest):
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={req.address}&limit=1"
    resp = httpx.get(url, headers={"User-Agent": "Travela/1.0"}, timeout=10)
    if not resp.is_success:
        raise HTTPException(status_code=502, detail="Geocoding service error")
    results = resp.json()
    if not results:
        return {"latitude": None, "longitude": None, "formattedAddress": None, "error": "Address not found"}
    r = results[0]
    return {
        "latitude": float(r["lat"]),
        "longitude": float(r["lon"]),
        "formattedAddress": r.get("display_name"),
    }


# ── Profanity check ───────────────────────────────────────────────────────────

@router.post("/profanity")
def check_profanity(req: ProfanityRequest, _user_id: str = Depends(require_auth)):
    text = req.text.strip()[:500]
    if not text:
        return {"is_profane": False}
    claude = get_claude()
    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=20,
        system='You are a content moderation classifier. Respond ONLY with {"is_profane": true} or {"is_profane": false}.',
        messages=[{"role": "user", "content": text}],
    )
    raw = response.content[0].text.strip()
    try:
        return json.loads(raw)
    except Exception:
        return {"is_profane": "true" in raw.lower()}


# ── Toilet finder ─────────────────────────────────────────────────────────────

_TOILET_SYSTEM = """You are a hyper-local toilet/restroom finder. Given GPS coordinates return REAL nearby toilets.
Return ONLY valid JSON:
{"toilets":[{"name":"...","distance_meters":50,"latitude":0.0,"longitude":0.0,"cleanliness_rating":4,"type":"Public|Mall|Restaurant|Hotel","directions":"...","is_free":true,"opening_hours":"24/7"}]}"""


@router.post("/toilets")
def find_toilets(req: ToiletsRequest, _user_id: str = Depends(require_auth)):
    area = ""
    try:
        geo = httpx.get(
            f"https://nominatim.openstreetmap.org/reverse?lat={req.latitude}&lon={req.longitude}&format=json",
            headers={"User-Agent": "Travela/1.0"}, timeout=5
        )
        if geo.is_success:
            area = geo.json().get("display_name", "")
    except Exception:
        pass

    claude = get_claude()
    prompt = f"Find toilets near {req.latitude},{req.longitude}. Area: {area}"
    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=_TOILET_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        return json.loads(response.content[0].text)
    except Exception:
        return {"raw": response.content[0].text}


# ── Image moderation ──────────────────────────────────────────────────────────

@router.post("/moderate-image")
def moderate_image(req: ModerateImageRequest, _user_id: str = Depends(require_auth)):
    try:
        img_resp = httpx.get(req.image_url, timeout=15, follow_redirects=True)
        img_b64 = base64.standard_b64encode(img_resp.content).decode()
        media_type = img_resp.headers.get("content-type", "image/jpeg").split(";")[0]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch image: {e}")

    claude = get_claude()
    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=150,
        system='Analyse this image for moderation. Respond ONLY with valid JSON: {"is_safe":true,"is_nsfw":false,"is_vulgar":false,"is_ai_generated":false,"confidence":0.95,"reason":"..."}',
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": img_b64},
                },
                {"type": "text", "text": "Moderate this image."},
            ],
        }],
    )
    try:
        return json.loads(response.content[0].text)
    except Exception:
        return {"is_safe": False, "is_nsfw": False, "is_vulgar": False,
                "is_ai_generated": False, "confidence": 0, "reason": response.content[0].text}
