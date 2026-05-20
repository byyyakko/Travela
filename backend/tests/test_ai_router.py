"""
Spec tests for /ai/* endpoints — itinerary, attractions, phrases, chat, translate.

Mocking strategy:
  - require_auth dependency → returns "test-user-id" (bypasses Supabase JWT)
  - anthropic.Anthropic client → mock so no real API calls
  - embed_query / retrieve_chunks / log_query → mocked at module level
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from middleware.auth import require_auth

# ── Auth bypass ───────────────────────────────────────────────────────────────

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def _auth_override():
    app.dependency_overrides[require_auth] = lambda: "test-user-id"
    yield
    app.dependency_overrides.pop(require_auth, None)


# ── Helpers ───────────────────────────────────────────────────────────────────

ITINERARY_JSON = json.dumps({
    "title": "3 Days in Tokyo",
    "description": "A vibrant cultural journey",
    "days": [
        {
            "day": 1,
            "theme": "Historic East",
            "activities": [
                {
                    "time": "9:00 AM",
                    "title": "Senso-ji Temple",
                    "description": "Ancient Buddhist temple in Asakusa",
                    "tip": "Arrive early to avoid crowds",
                    "category": "culture",
                    "location": "Asakusa, Tokyo",
                    "latitude": 35.7148,
                    "longitude": 139.7967,
                    "summary": "One of Tokyo's oldest and most significant Buddhist temples, dating to 628 AD.",
                    "source_url": "https://www.senso-ji.jp/",
                },
                {
                    "time": "1:00 PM",
                    "title": "Late Lunch in Asakusa",
                    "description": "Savor traditional tempura or monjayaki at a local restaurant.",
                    "tip": "Look for smaller, family-run establishments for a more authentic experience.",
                    "category": "food",
                    "location": "Asakusa, Tokyo",
                    "latitude": 35.7114,
                    "longitude": 139.7960,
                    "summary": "Asakusa offers a wide array of dining options, from historic tempura restaurants to lively monjayaki shops where you can cook your own savory pancake.",
                    "source_url": "https://www.timeout.com/tokyo/restaurants/best-restaurants-in-asakusa",
                },
            ],
        }
    ],
})

ATTRACTIONS_JSON = json.dumps({
    "country": "Japan",
    "attractions": [
        {
            "name": "Mount Fuji",
            "category": "sightseeing",
            "description": "Iconic volcanic peak",
            "location": "Shizuoka Prefecture",
            "latitude": 35.3606,
            "longitude": 138.7278,
            "rating": 4.9,
            "price_level": "budget",
        }
    ],
})

PHRASES_JSON = json.dumps({
    "country": "Japan",
    "language": "Japanese",
    "phrases": [
        {
            "category": "Greetings",
            "phrases": [
                {"local": "こんにちは", "english": "Hello", "pronunciation": "Konnichiwa"}
            ],
        }
    ],
})


def _text_block(text: str) -> MagicMock:
    """Claude text content block."""
    b = MagicMock()
    b.text = text
    return b


def _tool_use_block() -> MagicMock:
    """Claude tool_use content block — has no .text attribute."""
    b = MagicMock(spec=["type", "id", "name", "input"])
    b.type = "tool_use"
    return b


def _tool_result_block() -> MagicMock:
    """Claude tool_result content block — has no .text attribute."""
    b = MagicMock(spec=["type", "tool_use_id", "content"])
    b.type = "tool_result"
    return b


def _mock_claude_text(text: str) -> MagicMock:
    """Claude response containing a single text block (no tool use)."""
    resp = MagicMock()
    resp.content = [_text_block(text)]
    return resp


def _mock_claude_with_search(final_text: str) -> MagicMock:
    """Claude response that used web_search — tool_use → tool_result → text."""
    resp = MagicMock()
    resp.content = [_tool_use_block(), _tool_result_block(), _text_block(final_text)]
    return resp


def _mock_claude_search_multi(final_text: str) -> MagicMock:
    """Claude response with multiple search rounds before the final answer."""
    resp = MagicMock()
    resp.content = [
        _tool_use_block(),
        _tool_result_block(),
        _tool_use_block(),
        _tool_result_block(),
        _text_block(final_text),
    ]
    return resp


class _SseResponse:
    """Wraps an SSE StreamingResponse so .json() returns the payload from the 'done' event."""

    def __init__(self, resp):
        self.status_code = resp.status_code
        self._resp = resp

    def json(self):
        if self.status_code != 200:
            return self._resp.json()
        for line in self._resp.text.split("\n"):
            if not line.startswith("data: "):
                continue
            try:
                payload = json.loads(line[6:])
                if payload.get("status") == "done":
                    return payload["data"]
            except Exception:
                continue
        raise ValueError(f"No SSE done event in response: {self._resp.text[:300]!r}")


# ═══════════════════════════════════════════════════════════════════════════════
# /ai/itinerary
# ═══════════════════════════════════════════════════════════════════════════════

class TestItinerary:

    def _post(self, prompt: str = "3 days in Tokyo"):
        return _SseResponse(client.post("/ai/itinerary", json={"prompt": prompt}))

    # ── Auth ────────────────────────────────────────────────────────────────

    def test_requires_auth_header(self):
        """Without the dependency override, missing auth returns 401."""
        override_backup = app.dependency_overrides.pop(require_auth)
        try:
            r = TestClient(app).post("/ai/itinerary", json={"prompt": "Tokyo"})
            assert r.status_code == 401
        finally:
            app.dependency_overrides[require_auth] = override_backup

    # ── Happy path — plain text response ────────────────────────────────────

    def test_returns_200_with_valid_json(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        assert r.status_code == 200
        data = r.json()
        assert "title" in data
        assert "days" in data

    def test_response_has_days_list(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        days = r.json()["days"]
        assert isinstance(days, list)
        assert len(days) >= 1

    def test_each_day_has_activities(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        for day in r.json()["days"]:
            assert "activities" in day
            assert isinstance(day["activities"], list)

    def test_activities_have_required_fields(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        for day in r.json()["days"]:
            for act in day["activities"]:
                for field in ("time", "title", "description", "category", "location",
                              "latitude", "longitude", "summary", "source_url"):
                    assert field in act, f"Activity missing field: {field}"

    # ── RAG path ─────────────────────────────────────────────────────────────

    def test_logs_query_when_embedding_available(self):
        fake_vec = [0.1] * 1024
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=fake_vec), \
             patch("routers.ai.retrieve_chunks", return_value=["Tokyo tip 1"]), \
             patch("routers.ai.log_query") as mock_log:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        assert r.status_code == 200
        mock_log.assert_called_once()
        log_args = mock_log.call_args.args
        assert log_args[0] == "test-user-id"

    def test_skips_log_when_no_embedding(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None), \
             patch("routers.ai.log_query") as mock_log:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        mock_log.assert_not_called()

    def test_rag_chunks_injected_in_system_prompt(self):
        fake_vec = [0.1] * 1024
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=fake_vec), \
             patch("routers.ai.retrieve_chunks", return_value=["Shibuya crossing tip", "Ramen etiquette"]), \
             patch("routers.ai.log_query"):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system_prompt = create_mock.call_args.kwargs["system"]
        assert "Shibuya crossing tip" in system_prompt
        assert "Ramen etiquette" in system_prompt

    # ── Fallback ─────────────────────────────────────────────────────────────

    def test_returns_raw_when_json_parse_fails(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text("Not valid JSON at all")
            r = self._post()
        assert r.status_code == 200
        assert "raw" in r.json()

    def test_missing_prompt_rejected(self):
        r = client.post("/ai/itinerary", json={})
        assert r.status_code == 422

    def test_system_prompt_prohibits_urls(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "no URLs" in system or "url" in system.lower()

    def test_uses_sonnet_model(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        assert create_mock.call_args.kwargs["model"] == "claude-sonnet-4-6"

    def test_max_tokens_is_8000(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        assert create_mock.call_args.kwargs["max_tokens"] == 8000

    def test_user_prompt_passed_as_message(self):
        prompt = "5 days exploring Kyoto temples"
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post(prompt)
        messages = create_mock.call_args.kwargs["messages"]
        assert any(m["content"] == prompt for m in messages)

    def test_response_json_fenced_still_parses(self):
        fenced = f"```json\n{ITINERARY_JSON}\n```"
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(fenced)
            r = self._post()
        assert r.status_code == 200
        assert "title" in r.json()

    # ── Intent-aware search schema ────────────────────────────────────────────

    def test_activities_include_summary_and_source_url(self):
        """Claude must populate summary and source_url for each activity."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        for day in r.json()["days"]:
            for act in day["activities"]:
                assert "summary" in act, f"Activity '{act['title']}' missing 'summary'"
                assert "source_url" in act, f"Activity '{act['title']}' missing 'source_url'"

    def test_activities_include_coordinates(self):
        """Each activity must have latitude and longitude for map pinning."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        for day in r.json()["days"]:
            for act in day["activities"]:
                assert "latitude" in act, f"Activity '{act['title']}' missing 'latitude'"
                assert "longitude" in act, f"Activity '{act['title']}' missing 'longitude'"

    def test_system_prompt_has_food_intent_search_strategy(self):
        """System prompt must instruct category-specific search for food activities."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "food" in system.lower() or "dining" in system.lower(), \
            "System prompt must include food/dining search strategy"
        assert "restaurant" in system.lower(), \
            "System prompt must mention restaurants for food search"

    def test_system_prompt_has_culture_intent_search_strategy(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "culture" in system.lower() or "museum" in system.lower() or "temple" in system.lower()

    def test_system_prompt_instructs_summary_extraction(self):
        """System prompt must tell Claude to extract a summary from search results."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "summary" in system.lower(), "System prompt must mention summary extraction"
        assert "source_url" in system or "source url" in system.lower()

    def test_system_prompt_has_latitude_longitude_schema(self):
        """Schema in system prompt must include latitude and longitude."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "latitude" in system and "longitude" in system

    def test_food_activity_summary_is_populated(self):
        """Food activities (category=food) must have non-empty summary from search."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        food_acts = [
            act
            for day in r.json()["days"]
            for act in day["activities"]
            if act.get("category") == "food"
        ]
        assert len(food_acts) > 0, "Fixture should have at least one food activity"
        for act in food_acts:
            assert act.get("summary"), f"Food activity '{act['title']}' has empty summary"

    def test_food_activity_has_source_url(self):
        """Food activities must have a source_url pointing to a food-related resource."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        food_acts = [
            act
            for day in r.json()["days"]
            for act in day["activities"]
            if act.get("category") == "food"
        ]
        for act in food_acts:
            url = act.get("source_url", "")
            assert url, f"Food activity '{act['title']}' missing source_url"
            assert url.startswith("http"), f"source_url must be a valid URL, got: {url!r}"

    def test_shopping_category_in_schema(self):
        """'shopping' is a valid category in the new schema (was missing before)."""
        shopping_json = json.dumps({
            "title": "Bangkok Day",
            "description": "Markets and more",
            "days": [{"day": 1, "theme": "Shop", "activities": [{
                "time": "10:00 AM", "title": "Chatuchak Weekend Market",
                "description": "Massive outdoor market", "tip": "Go early",
                "category": "shopping", "location": "Bangkok",
                "latitude": 13.7999, "longitude": 100.5500,
                "summary": "One of the world's largest weekend markets with 15,000 stalls.",
                "source_url": "https://www.chatuchakmarket.org/",
            }]}],
        })
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(shopping_json)
            r = self._post()
        acts = r.json()["days"][0]["activities"]
        assert acts[0]["category"] == "shopping"

    # ── Korea / multi-day / repeat-call coverage ─────────────────────────────

    def test_korea_prompt_forwarded_to_claude(self):
        """A Korea-specific prompt must be forwarded verbatim as the user message."""
        korea_prompt = "5 days in Seoul — street food, K-culture, and palaces"
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            client.post("/ai/itinerary", json={"prompt": korea_prompt})
        messages = create_mock.call_args.kwargs["messages"]
        assert any(m["content"] == korea_prompt for m in messages), \
            "Korea prompt must be passed verbatim to Claude"

    def test_repeated_calls_return_200(self):
        """Calling /ai/itinerary twice in succession must both return 200 (no state pollution)."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r1 = client.post("/ai/itinerary", json={"prompt": "3 days in Seoul"})
            r2 = client.post("/ai/itinerary", json={"prompt": "5 days in Busan"})
        assert r1.status_code == 200, "First call must succeed"
        assert r2.status_code == 200, "Second call must succeed — no state leak between requests"

    def test_repeated_calls_each_return_title(self):
        """Both calls in succession must return a valid itinerary with a title."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r1 = _SseResponse(client.post("/ai/itinerary", json={"prompt": "3 days in Seoul"}))
            r2 = _SseResponse(client.post("/ai/itinerary", json={"prompt": "5 days in Jeju"}))
        assert "title" in r1.json()
        assert "title" in r2.json()

    def test_accommodations_field_in_schema(self):
        """System prompt must include accommodations schema so Claude populates it."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "accommodations" in system, \
            "System prompt must include accommodations so the frontend hotel section renders"

    def test_transport_field_in_schema(self):
        """System prompt must include transport schema so Claude populates it."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "transport" in system, \
            "System prompt must include transport so the frontend transport section renders"

    def test_all_days_instruction_in_system_prompt(self):
        """System prompt must instruct Claude to generate ALL requested days."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ITINERARY_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "all days" in system.lower() or "generate all" in system.lower(), \
            "System prompt must instruct Claude to generate all requested days"

    def test_response_has_description_field(self):
        """Top-level description field must be present (used in frontend overview card)."""
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ITINERARY_JSON)
            r = self._post()
        assert "description" in r.json(), "Top-level description field must be present"

    def test_accommodations_returned_when_present(self):
        """When Claude returns accommodations, the endpoint passes them through unchanged."""
        itinerary_with_hotels = json.dumps({
            "title": "5 Days in Seoul",
            "description": "K-culture deep dive",
            "days": [{"day": 1, "theme": "Palaces", "activities": [{
                "time": "9:00 AM", "title": "Gyeongbokgung Palace",
                "description": "Joseon dynasty palace", "tip": "Rent hanbok",
                "category": "culture", "location": "Jongno-gu, Seoul",
                "latitude": 37.5796, "longitude": 126.9770,
                "summary": "The largest of the Five Grand Palaces built by the Joseon dynasty.",
                "source_url": "https://www.tripadvisor.com/Attraction_Review-g294197-d324888",
            }]}],
            "accommodations": [{"name": "Myeongdong Boutique Hotel",
                "type": "hotel", "area": "Myeongdong",
                "price_range": "mid-range", "description": "Central location near street food.",
                "tip": "Book early", "booking_url": "https://www.booking.com/search.html?ss=Myeongdong+Seoul",
                "latitude": 37.5636, "longitude": 126.9869}],
            "transport": {"from_airport": "AREX train to Seoul Station (43 min)",
                "getting_around": "T-money card for subway", "modes": [
                    {"mode": "Subway", "description": "Extensive network", "estimated_cost": "₩1,400/ride", "tip": "Get a T-money card"}
                ]},
        })
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(itinerary_with_hotels)
            r = self._post("5 days in Seoul")
        data = r.json()
        assert "accommodations" in data, "accommodations must be present when Claude returns them"
        assert len(data["accommodations"]) == 1
        assert data["accommodations"][0]["name"] == "Myeongdong Boutique Hotel"
        assert "transport" in data, "transport must be present when Claude returns it"
        assert "from_airport" in data["transport"]


# ═══════════════════════════════════════════════════════════════════════════════
# /ai/attractions
# ═══════════════════════════════════════════════════════════════════════════════

class TestAttractions:

    def _post(self, country: str = "Japan", category: str = None):
        payload = {"country": country}
        if category:
            payload["category"] = category
        return client.post("/ai/attractions", json=payload)

    def test_requires_auth_header(self):
        override_backup = app.dependency_overrides.pop(require_auth)
        try:
            r = TestClient(app).post("/ai/attractions", json={"country": "Japan"})
            assert r.status_code == 401
        finally:
            app.dependency_overrides[require_auth] = override_backup

    def test_returns_200_with_valid_json(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            r = self._post()
        assert r.status_code == 200
        assert "attractions" in r.json()

    def test_attractions_is_list(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            r = self._post()
        assert isinstance(r.json()["attractions"], list)

    def test_each_attraction_has_required_fields(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            r = self._post()
        for attraction in r.json()["attractions"]:
            for field in ("name", "category", "description", "location", "latitude", "longitude", "rating", "price_level"):
                assert field in attraction, f"Attraction missing field: {field}"

    def test_claude_called_with_web_search_tool(self):
        """Attractions endpoint MUST pass web_search_20260219 to Claude."""
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            self._post()
            tools = create_mock.call_args.kwargs.get("tools", [])
            tool_types = [t.get("type") for t in tools]
            assert "web_search_20260209" in tool_types

    def test_extracts_text_after_tool_use_blocks(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_with_search(ATTRACTIONS_JSON)
            r = self._post()
        assert r.status_code == 200
        assert "attractions" in r.json()

    def test_extracts_text_after_multiple_search_rounds(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_search_multi(ATTRACTIONS_JSON)
            r = self._post()
        assert r.status_code == 200
        assert "attractions" in r.json()

    def test_category_filter_appears_in_system_prompt(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            self._post(category="food")
        system = create_mock.call_args.kwargs["system"]
        assert "food" in system

    def test_no_category_covers_all(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            self._post()  # no category
        system = create_mock.call_args.kwargs["system"]
        assert "all" in system.lower()

    def test_country_passed_as_user_message(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            self._post(country="Thailand")
        messages = create_mock.call_args.kwargs["messages"]
        assert any("Thailand" in m["content"] for m in messages)

    def test_system_prompt_instructs_web_search(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "search" in system.lower()

    def test_returns_raw_when_json_parse_fails(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text("broken { json")
            r = self._post()
        assert r.status_code == 200
        assert "raw" in r.json()

    def test_missing_country_rejected(self):
        r = client.post("/ai/attractions", json={})
        assert r.status_code == 422

    def test_max_tokens_is_4000(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(ATTRACTIONS_JSON)
            self._post()
        assert create_mock.call_args.kwargs["max_tokens"] == 4000

    def test_response_json_fenced_still_parses(self):
        fenced = f"```json\n{ATTRACTIONS_JSON}\n```"
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(fenced)
            r = self._post()
        assert r.status_code == 200
        assert "attractions" in r.json()


# ═══════════════════════════════════════════════════════════════════════════════
# /ai/phrases
# ═══════════════════════════════════════════════════════════════════════════════

class TestPhrases:

    def test_returns_200_with_valid_json(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(PHRASES_JSON)
            r = client.post("/ai/phrases", json={"country": "Japan"})
        assert r.status_code == 200
        assert "phrases" in r.json()

    def test_response_has_language_field(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(PHRASES_JSON)
            r = client.post("/ai/phrases", json={"country": "Japan"})
        assert "language" in r.json()

    def test_country_forwarded_to_claude(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(PHRASES_JSON)
            client.post("/ai/phrases", json={"country": "Thailand"})
        messages = create_mock.call_args.kwargs["messages"]
        assert any("Thailand" in m["content"] for m in messages)

    def test_no_web_search_tool(self):
        """Phrases endpoint does NOT need web search — only AI/Chat endpoints do."""
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(PHRASES_JSON)
            client.post("/ai/phrases", json={"country": "Japan"})
        kwargs = create_mock.call_args.kwargs
        assert "tools" not in kwargs or kwargs.get("tools") is None or kwargs.get("tools") == []

    def test_returns_raw_when_json_parse_fails(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text("Oops, I broke it")
            r = client.post("/ai/phrases", json={"country": "Japan"})
        assert r.status_code == 200
        assert "raw" in r.json()

    def test_missing_country_rejected(self):
        r = client.post("/ai/phrases", json={})
        assert r.status_code == 422

    def test_requires_auth(self):
        override_backup = app.dependency_overrides.pop(require_auth)
        try:
            r = TestClient(app).post("/ai/phrases", json={"country": "Japan"})
            assert r.status_code == 401
        finally:
            app.dependency_overrides[require_auth] = override_backup

    def test_max_tokens_is_2000(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(PHRASES_JSON)
            client.post("/ai/phrases", json={"country": "Japan"})
        assert create_mock.call_args.kwargs["max_tokens"] == 2000


# ═══════════════════════════════════════════════════════════════════════════════
# /ai/chat
# ═══════════════════════════════════════════════════════════════════════════════

class TestChat:

    MESSAGES = [{"role": "user", "content": "What should I eat in Tokyo?"}]

    def _post(self, messages=None):
        return client.post("/ai/chat", json={"messages": messages or self.MESSAGES})

    def test_returns_200(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text("Try ramen in Shinjuku!")
            r = self._post()
        assert r.status_code == 200

    def test_response_has_role_and_content(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text("Try ramen in Shinjuku!")
            r = self._post()
        data = r.json()
        assert "role" in data and data["role"] == "assistant"
        assert "content" in data
        assert len(data["content"]) > 0

    def test_messages_forwarded_to_claude(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text("Great question!")
            self._post()
        sent = create_mock.call_args.kwargs["messages"]
        assert sent == self.MESSAGES

    def test_rag_context_injected_in_system(self):
        fake_vec = [0.2] * 1024
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=fake_vec), \
             patch("routers.ai.retrieve_chunks", return_value=["Best sushi spots in Tokyo"]), \
             patch("routers.ai.log_query"):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text("Try Tsukiji!")
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "Best sushi spots in Tokyo" in system

    def test_logs_query_when_embedding_available(self):
        fake_vec = [0.2] * 1024
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=fake_vec), \
             patch("routers.ai.retrieve_chunks", return_value=[]), \
             patch("routers.ai.log_query") as mock_log:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text("Ramen!")
            self._post()
        mock_log.assert_called_once()

    def test_requires_auth(self):
        override_backup = app.dependency_overrides.pop(require_auth)
        try:
            r = TestClient(app).post("/ai/chat", json={"messages": self.MESSAGES})
            assert r.status_code == 401
        finally:
            app.dependency_overrides[require_auth] = override_backup

    def test_empty_messages_list_accepted(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            mock_factory.return_value.messages.create.return_value = _mock_claude_text("Hello!")
            r = self._post(messages=[])
        assert r.status_code == 200

    def test_max_tokens_is_1000(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text("Yes!")
            self._post()
        assert create_mock.call_args.kwargs["max_tokens"] == 1000

    def test_system_prompt_mentions_tori_tan(self):
        with patch("routers.ai.get_claude") as mock_factory, \
             patch("routers.ai.embed_query", return_value=None):
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text("Hi!")
            self._post()
        system = create_mock.call_args.kwargs["system"]
        assert "Tori-Tan" in system or "tori" in system.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# /ai/translate
# ═══════════════════════════════════════════════════════════════════════════════

TRANSLATE_JSON = json.dumps({
    "cultural_context": "Bow slightly when greeting.",
    "suggested_response": "Konnichiwa, nice to meet you.",
    "tips": ["Remove shoes indoors", "Use both hands when giving cards"],
    "politeness_level": "formal",
})

class TestTranslate:

    def _post(self, message: str = "Hello, can we meet?", country: str = None):
        payload = {"message": message}
        if country:
            payload["destination_country"] = country
        return client.post("/ai/translate", json=payload)

    def test_returns_200(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(TRANSLATE_JSON)
            r = self._post()
        assert r.status_code == 200

    def test_response_has_cultural_context(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(TRANSLATE_JSON)
            r = self._post()
        assert "cultural_context" in r.json()

    def test_response_has_tips_list(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(TRANSLATE_JSON)
            r = self._post()
        assert isinstance(r.json()["tips"], list)

    def test_response_has_politeness_level(self):
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text(TRANSLATE_JSON)
            r = self._post()
        assert r.json()["politeness_level"] in ("formal", "casual", "neutral")

    def test_destination_country_in_system_prompt(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(TRANSLATE_JSON)
            self._post(country="Japan")
        system = create_mock.call_args.kwargs["system"]
        assert "Japan" in system

    def test_fallback_on_json_parse_failure(self):
        """On bad JSON, returns a dict with cultural_context, not a 500."""
        with patch("routers.ai.get_claude") as mock_factory:
            mock_factory.return_value.messages.create.return_value = _mock_claude_text("This is fine culturally.")
            r = self._post()
        assert r.status_code == 200
        data = r.json()
        assert "cultural_context" in data
        assert data["politeness_level"] == "neutral"
        assert data["tips"] == []

    def test_requires_auth(self):
        override_backup = app.dependency_overrides.pop(require_auth)
        try:
            r = TestClient(app).post("/ai/translate", json={"message": "Hi"})
            assert r.status_code == 401
        finally:
            app.dependency_overrides[require_auth] = override_backup

    def test_missing_message_rejected(self):
        r = client.post("/ai/translate", json={})
        assert r.status_code == 422

    def test_max_tokens_is_600(self):
        with patch("routers.ai.get_claude") as mock_factory:
            create_mock = mock_factory.return_value.messages.create
            create_mock.return_value = _mock_claude_text(TRANSLATE_JSON)
            self._post()
        assert create_mock.call_args.kwargs["max_tokens"] == 600


# ═══════════════════════════════════════════════════════════════════════════════
# extract_json helper (unit tests)
# ═══════════════════════════════════════════════════════════════════════════════

class TestExtractJson:

    def setup_method(self):
        from routers.ai import extract_json
        self.extract = extract_json

    def test_plain_json(self):
        result = self.extract('{"key": "value"}')
        assert result == {"key": "value"}

    def test_fenced_json(self):
        result = self.extract('```json\n{"key": "value"}\n```')
        assert result == {"key": "value"}

    def test_fenced_without_language(self):
        result = self.extract('```\n{"key": "value"}\n```')
        assert result == {"key": "value"}

    def test_json_with_leading_text(self):
        result = self.extract('Here is the result:\n{"key": "value"}')
        assert result == {"key": "value"}

    def test_raises_on_invalid_json(self):
        with pytest.raises(Exception):
            self.extract("completely invalid")
