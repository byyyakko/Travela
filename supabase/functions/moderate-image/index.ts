import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    const { image_url } = await req.json();
    if (!image_url) {
      return new Response(JSON.stringify({ error: "image_url is required" }), {
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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a content moderation AI. Analyze the provided image and return a JSON object with these fields:
{
  "is_safe": boolean,         // true if the image is safe for a travel social app
  "is_nsfw": boolean,         // true if the image contains nudity or explicit sexual content
  "is_ai_generated": boolean, // true if the image appears to be AI-generated (look for: too-perfect skin, unnatural lighting, distorted hands/fingers, uncanny valley faces, overly smooth textures, inconsistent reflections, text artifacts)
  "confidence": number,       // 0-1 confidence score
  "reason": string           // brief explanation of the moderation decision
}
Only return valid JSON, no markdown.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image for content moderation:" },
              { type: "image_url", image_url: { url: image_url } }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status);
      // If moderation fails, allow the image (fail open for non-critical)
      return new Response(JSON.stringify({ 
        is_safe: true, is_nsfw: false, is_ai_generated: false, confidence: 0, reason: "Moderation unavailable" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Default to safe if parsing fails
      parsed = { is_safe: true, is_nsfw: false, is_ai_generated: false, confidence: 0, reason: "Could not parse moderation result" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-image error:", e);
    return new Response(JSON.stringify({ 
      is_safe: true, is_nsfw: false, is_ai_generated: false, confidence: 0, reason: "Moderation error" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
