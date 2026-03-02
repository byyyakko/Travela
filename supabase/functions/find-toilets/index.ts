import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // First, reverse-geocode to get area context
    let areaContext = "";
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "Travela-App/1.0" } }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        areaContext = geoData.display_name || "";
      }
    } catch {
      // ignore geocoding errors
    }

    const systemPrompt = `You are a hyper-local toilet/restroom finder assistant. Given exact GPS coordinates and the resolved address/area name, identify REAL toilets and restrooms at the user's IMMEDIATE location and surroundings.

CRITICAL RULES:
- Use the resolved address to understand EXACTLY where the user is (e.g. if they are at a university campus, find toilets IN that campus — specific buildings, faculties, libraries, canteens, student centers)
- If the user is at a campus, mall, airport, hospital, or large complex — find toilets WITHIN that complex first before looking outside
- Focus on places within ~500m radius first, then expand to ~1km only if needed
- Include specific building names, floor numbers, and wing/block details when possible
- Only suggest REAL places that genuinely exist at these coordinates
- For each toilet, provide a realistic cleanliness rating based on venue type
- Provide practical walking directions from the user's exact coordinates
- Return 5-8 results sorted by distance (nearest first)
- Coordinates for each toilet must be realistic and close to the given location

Return ONLY valid JSON with this exact structure:
{
  "toilets": [
    {
      "name": "Specific building/venue name",
      "type": "mall | station | convenience_store | hotel | restaurant | gas_station | public | university | hospital | other",
      "distance_meters": 50,
      "estimated_walk_minutes": 1,
      "cleanliness": 4,
      "cleanliness_label": "Clean",
      "is_free": true,
      "notes": "Located on Level 1 near the main entrance. Wheelchair accessible.",
      "directions": "Walk 50m north to the building entrance, restroom is on your left past the lobby.",
      "latitude": 0.0,
      "longitude": 0.0
    }
  ]
}

cleanliness is 1-5 scale: 1=Very Poor, 2=Poor, 3=Average, 4=Clean, 5=Very Clean.
cleanliness_label must match the number.`;

    const userMessage = areaContext
      ? `Find nearby toilets/restrooms for coordinates: latitude ${latitude}, longitude ${longitude}. The user is currently at or near: "${areaContext}". Use this area context to find the most relevant and specific toilet locations. Return the JSON response.`
      : `Find nearby toilets/restrooms for coordinates: latitude ${latitude}, longitude ${longitude}. Return the JSON response.`;

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
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service unavailable");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const toiletData = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(toiletData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("find-toilets error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
