import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ is_profane: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit input length
    const sanitized = text.trim().slice(0, 500);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ is_profane: false }), {
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
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a content moderation classifier. Given user text, determine if it contains profanity, slurs, hate speech, sexual content, threats of violence, or any inappropriate/offensive language — including creative spellings, leetspeak, spacing tricks (e.g. "f u c k"), symbol substitution (e.g. "f@ck"), or other evasion techniques.

Respond ONLY with a JSON object: {"is_profane": true} or {"is_profane": false}. No other text.`,
          },
          { role: "user", content: sanitized },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ is_profane: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return new Response(JSON.stringify({ is_profane: parsed.is_profane === true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      // If parsing fails, check for "true" in content
      const isProfane = content.toLowerCase().includes('"is_profane": true') || content.toLowerCase().includes('"is_profane":true');
      return new Response(JSON.stringify({ is_profane: isProfane }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("check-profanity error:", e);
    return new Response(JSON.stringify({ is_profane: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
