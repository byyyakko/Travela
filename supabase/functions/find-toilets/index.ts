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

    const systemPrompt = `You are a toilet/restroom finder assistant. Given GPS coordinates, identify real, well-known public restrooms, toilets in malls, train stations, convenience stores, gas stations, hotels, and restaurants nearby.

IMPORTANT RULES:
- Only suggest REAL places that are very likely to have public or semi-public restrooms
- Focus on places within ~1km radius of the coordinates
- For each toilet location, provide a realistic cleanliness rating based on the type of venue (e.g. hotel lobbies are typically very clean, public park toilets less so)
- Provide practical walking directions from the user's coordinates
- Return 5-8 results sorted by distance (nearest first)

Return ONLY valid JSON with this exact structure:
{
  "toilets": [
    {
      "name": "Name of venue/location",
      "type": "mall | station | convenience_store | hotel | restaurant | gas_station | public | other",
      "distance_meters": 150,
      "estimated_walk_minutes": 2,
      "cleanliness": 4,
      "cleanliness_label": "Very Clean",
      "is_free": true,
      "notes": "Located on B1 floor near the food court. Well-maintained.",
      "directions": "Head north on the main road for 100m, turn right at the intersection, enter the mall on the left side.",
      "latitude": 0.0,
      "longitude": 0.0
    }
  ]
}

cleanliness is 1-5 scale: 1=Very Poor, 2=Poor, 3=Average, 4=Clean, 5=Very Clean.
cleanliness_label must match the number.`;

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
          {
            role: "user",
            content: `Find nearby toilets/restrooms for coordinates: latitude ${latitude}, longitude ${longitude}. Return the JSON response.`,
          },
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
