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

    // Fetch the image and convert to base64 data URL
    const imgResponse = await fetch(image_url);
    if (!imgResponse.ok) {
      console.error("Failed to fetch image:", imgResponse.status);
      return new Response(JSON.stringify({ 
        is_safe: false, is_nsfw: false, is_vulgar: false, is_ai_generated: false, confidence: 0, reason: "Could not fetch image for moderation" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const imgBuffer = await imgResponse.arrayBuffer();
    // Convert to base64 in chunks to avoid stack overflow on large images
    const bytes = new Uint8Array(imgBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
    const dataUrl = `data:${contentType};base64,${base64}`;

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
            content: `You are a strict content moderation AI for a family-friendly travel social app. Analyze the provided image and return a JSON object with these fields:
{
  "is_safe": boolean,
  "is_nsfw": boolean,
  "is_vulgar": boolean,
  "is_ai_generated": boolean,
  "confidence": number,
  "reason": string
}
Rules:
- is_nsfw: true if ANY nudity (full/partial), sexually suggestive poses, lingerie/underwear focus, provocative gestures, genitalia, bare buttocks, or sexualized content
- is_vulgar: true if offensive gestures (middle finger), graphic violence, gore, drug use, hate symbols, racist imagery, profane text, shock content, or anything rude/vulgar/offensive
- is_safe: true ONLY if completely appropriate for all ages
- is_ai_generated: true if image appears AI-generated
Be VERY strict. When in doubt, flag as unsafe. Only return valid JSON, no markdown.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image for content moderation:" },
              { type: "image_url", image_url: { url: dataUrl } }
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
      const errBody = await response.text();
      console.error("AI gateway error:", response.status, errBody);
      // Fail CLOSED — reject the image when moderation is unavailable
      return new Response(JSON.stringify({ 
        is_safe: false, is_nsfw: false, is_vulgar: false, is_ai_generated: false, confidence: 0, reason: "Moderation service error — please try again" 
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
      parsed = { is_safe: false, is_nsfw: false, is_vulgar: false, is_ai_generated: false, confidence: 0, reason: "Could not parse moderation result" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-image error:", e);
    return new Response(JSON.stringify({ 
      is_safe: false, is_nsfw: false, is_vulgar: false, is_ai_generated: false, confidence: 0, reason: "Moderation error — please try again" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
