import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, country, prompt, message, destination_country } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "phrases") {
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
      systemPrompt = `You are a local travel expert who creates authentic, off-the-beaten-path itineraries. Focus on local experiences, hidden gems, and cultural immersion rather than tourist traps.
Return a JSON object with this structure:
{
  "title": "Itinerary title",
  "description": "Brief overview",
  "days": [
    {
      "day": 1,
      "theme": "Day theme",
      "activities": [
        { "time": "9:00 AM", "title": "Activity name", "description": "Details", "tip": "Local insider tip", "category": "food|culture|adventure|shopping|sightseeing" }
      ]
    }
  ]
}
Create 2-3 days with 4-5 activities each. Only return valid JSON, no markdown.`;
      userPrompt = prompt;
    } else if (type === "cultural-translation") {
      systemPrompt = `You are a cultural context translator for travelers. When given a message and destination country, explain the cultural nuances, suggest how to respond appropriately, and flag any potential cultural misunderstandings. Keep your response concise and helpful.
Return a JSON object:
{
  "cultural_context": "Explanation of cultural nuances in the message",
  "suggested_response": "A culturally appropriate way to respond",
  "tips": ["cultural tip 1", "cultural tip 2"],
  "politeness_level": "casual|polite|formal"
}
Only return valid JSON, no markdown.`;
      userPrompt = `Message: "${message}"\nDestination country: ${destination_country}\nHelp me understand the cultural context and suggest how to respond.`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
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
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Try to parse as JSON
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { raw: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-travel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
