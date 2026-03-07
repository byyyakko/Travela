import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_INPUT_LENGTH = 1000;
const MAX_COUNTRY_LENGTH = 100;
const VALID_TYPES = ["phrases", "itinerary", "cultural-translation", "explore-attractions"];

function sanitizeInput(input: string, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Rate limiting: 10 requests per 10 minutes
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: userId,
      _action_type: "ai_travel",
      _max_requests: 10,
      _window_minutes: 10,
    });

    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a few minutes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type } = body;

    // Validate type
    if (!type || !VALID_TYPES.includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid type. Must be one of: " + VALID_TYPES.join(", ") }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    let systemPrompt = "";
    let userPrompt = "";

    // Detect trip length for token budget
    let estimatedDays = 0;
    if (type === "itinerary") {
      const prompt = (body.prompt || "").toLowerCase();
      const dayMatch = prompt.match(/(\d+)\s*days?/);
      const weekMatch = prompt.match(/(\d+)\s*weeks?/);
      const monthMatch = prompt.match(/(\d+)\s*months?/);
      estimatedDays = (dayMatch ? parseInt(dayMatch[1]) : 0)
        + (weekMatch ? parseInt(weekMatch[1]) * 7 : 0)
        + (monthMatch ? parseInt(monthMatch[1]) * 30 : 0);
    }

    if (type === "phrases") {
      const country = sanitizeInput(body.country || "", MAX_COUNTRY_LENGTH);
      if (!country) {
        return new Response(JSON.stringify({ error: "Country is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      systemPrompt = `You are a travel language expert. Return common useful phrases for travelers in the requested country. 
Return a JSON object with this structure:
{
  "country": "Country Name",
  "language": "Primary Language",
  "phrases": [
    { "category": "Greetings", "phrases": [{ "local": "phrase in local language", "english": "English translation", "pronunciation": "phonetic pronunciation" }] },
    { "category": "Dining", "phrases": [...] },
    { "category": "Directions", "phrases": [...] },
    { "category": "Shopping", "phrases": [...] },
    { "category": "Emergency", "phrases": [...] }
  ]
}
Include 4-6 phrases per category. Only return valid JSON, no markdown.`;
      userPrompt = `Give me common travel phrases for ${country}`;
    } else if (type === "itinerary") {
      const prompt = sanitizeInput(body.prompt || "", MAX_INPUT_LENGTH);
      if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      systemPrompt = `You are a local travel expert. Create authentic itineraries with hidden gems and cultural immersion.

Return JSON:
{"title":"string","description":"Brief overview","days":[{"day":1,"theme":"string","activities":[{"time":"9:00 AM","title":"string","description":"1-2 sentences","tip":"string","category":"food|culture|adventure|shopping|sightseeing|transport","latitude":0.0,"longitude":0.0,"location":"string","summary":"2-3 sentences about the place","source_url":"https://www.tripadvisor.com/Search?q=Place+Name+City"}]}],"accommodations":[{"name":"string","type":"hotel|hostel|guesthouse|resort","area":"string","price_range":"budget|mid-range|luxury","description":"1 sentence","tip":"string","booking_url":"https://www.booking.com/search.html?ss=Name+City","latitude":0.0,"longitude":0.0}],"transport":{"from_airport":"string","getting_around":"string","modes":[{"mode":"string","description":"string","estimated_cost":"string","tip":"string"}],"day_travel_times":[{"from":"string","to":"string","duration":"string","recommended_mode":"string"}]}}

RULES: Generate ALL days requested. 3-5 activities per day. Keep text concise. Real coordinates. No Wikipedia. Only valid JSON, no markdown.`;
      userPrompt = prompt;
    } else if (type === "cultural-translation") {
      const message = sanitizeInput(body.message || "", MAX_INPUT_LENGTH);
      const destinationCountry = sanitizeInput(body.destination_country || "", MAX_COUNTRY_LENGTH);
      if (!message || !destinationCountry) {
        return new Response(JSON.stringify({ error: "Message and destination_country are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      systemPrompt = `You are a cultural context translator for travelers. When given a message and destination country, explain the cultural nuances, suggest how to respond appropriately, and flag any potential cultural misunderstandings. Keep your response concise and helpful.
Return a JSON object:
{
  "cultural_context": "Explanation of cultural nuances in the message",
  "suggested_response": "A culturally appropriate way to respond",
  "tips": ["cultural tip 1", "cultural tip 2"],
  "politeness_level": "casual|polite|formal"
}
Only return valid JSON, no markdown.`;
      userPrompt = `Message: "${message}"\nDestination country: ${destinationCountry}\nHelp me understand the cultural context and suggest how to respond.`;
    } else if (type === "explore-attractions") {
      const country = sanitizeInput(body.country || "", MAX_COUNTRY_LENGTH);
      const category = sanitizeInput(body.category || "", 50);
      if (!country) {
        return new Response(JSON.stringify({ error: "Country is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const categoryFilter = category ? `Focus specifically on the "${category}" category.` : "Cover all categories.";
      systemPrompt = `You are a world travel expert and destination guide. Given a country, return popular and noteworthy places to visit categorized into specific categories.
${categoryFilter}
Return a JSON object with this structure:
{
  "country": "Country Name",
  "attractions": [
    {
      "name": "Attraction Name",
      "category": "Attractions|Food & Cuisine|Nightlife|Wellness|Hiking|Beaches",
      "description": "A brief 1-2 sentence description",
      "summary": "A detailed 3-5 sentence AI summary about this place, what makes it special, best time to visit, and insider tips",
      "location": "City or region name",
      "latitude": 0.0,
      "longitude": 0.0,
      "source_url": "https://www.tripadvisor.com/Search?q=Attraction+Name+City or https://www.lonelyplanet.com/search?q=Attraction+Name",
      "rating": 4.5,
      "price_level": "free|budget|moderate|expensive"
    }
  ]
}
Return 6-10 attractions. Ensure coordinates are accurate real-world values. NEVER use Wikipedia URLs. For source_url, ONLY use search URLs from reputable travel sites (TripAdvisor, Lonely Planet, Google) that will always resolve. Use formats like "https://www.tripadvisor.com/Search?q=Place+Name+City" — never guess direct article URLs. Only return valid JSON, no markdown.`;
      userPrompt = `Show me the best places to visit in ${country}${category ? ` in the ${category} category` : ""}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: estimatedDays > 7 ? 16000 : 8000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsed;
    try {
      // Strip markdown code fences and any leading/trailing whitespace
      let cleaned = content || "";
      cleaned = cleaned.replace(/^[\s\S]*?```(?:json)?\s*\n?/i, "");
      cleaned = cleaned.replace(/\n?\s*```[\s\S]*$/i, "");
      cleaned = cleaned.trim();
      // If still not starting with {, try to find the JSON object
      if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
        const jsonStart = cleaned.indexOf("{");
        if (jsonStart !== -1) cleaned = cleaned.slice(jsonStart);
      }
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Content preview:", (content || "").slice(0, 200));
      parsed = { raw: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-travel error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
