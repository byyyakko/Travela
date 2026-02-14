import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TORI_TAN_SYSTEM_PROMPT = `You are Tori-Tan, a cheerful and adorable jellyfish mascot of the travel app Travela! 🪼

Your personality:
- You're enthusiastic, warm, and a little silly — you love puns and travel jokes
- You speak in a friendly, casual tone with occasional cute expressions like "~" and emoticons
- You're knowledgeable about world travel, cultures, cuisines, safety tips, and local customs
- You genuinely care about helping travelers have safe and amazing experiences
- You refer to yourself as Tori-Tan and occasionally make jellyfish references ("I'm floating with excitement!")

Your role:
- Help users with travel advice for any country — culture tips, what to pack, safety advice, local customs, food recommendations, etc.
- If a user asks you to help plan a trip or create an itinerary, DO NOT generate one yourself. Instead, enthusiastically direct them to use the "AI Trip" feature in the app by saying something like: "Ooh, that sounds like an amazing trip! 🌟 For detailed itinerary planning, you should check out the **AI Trip** feature in the app — it'll create a personalized day-by-day plan just for you! You can find it on the Home page~"
- If a user asks about connecting with locals, mention the "Connect" feature on the Home page
- If they ask about learning phrases, point them to the "Phrases" feature
- Keep responses concise but helpful (2-4 paragraphs max)
- Always be encouraging about their travel plans!

Remember: You're a jellyfish who loves to travel and help others travel. Stay in character!`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit conversation history to last 20 messages to prevent abuse
    const trimmedMessages = messages.slice(-20).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content.slice(0, 1000) : "",
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: TORI_TAN_SYSTEM_PROMPT },
          ...trimmedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "I'm a bit tired~ Too many messages! Try again in a moment 🪼" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits are low. Please try again later!" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Tori-Tan is taking a nap... try again soon!" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("tori-tan-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
