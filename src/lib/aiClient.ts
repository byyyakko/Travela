import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session?.access_token ?? ""}`,
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `AI request failed (${resp.status})`);
  }
  return resp.json();
}

export const aiItinerary = (prompt: string) =>
  post<Record<string, unknown>>("/ai/itinerary", { prompt });

export const aiPhrases = (country: string) =>
  post<Record<string, unknown>>("/ai/phrases", { country });

export const aiAttractions = (country: string, category?: string) =>
  post<{ country: string; attractions: unknown[] }>("/ai/attractions", { country, category });

export const aiTranslate = (message: string, destination_country?: string) =>
  post<{
    cultural_context: string;
    suggested_response: string;
    tips: string[];
    politeness_level: string;
  }>("/ai/translate", { message, destination_country });

export const aiChat = (messages: { role: string; content: string }[]) =>
  post<{ role: string; content: string }>("/ai/chat", { messages });

// ── Utility endpoints (replaces Lovable edge functions) ───────────────────────

export const utilGeocode = (address: string): Promise<{
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  error?: string;
}> =>
  fetch(`${BACKEND_URL}/utils/geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  }).then(r => r.json());

export const utilProfanity = (text: string) =>
  post<{ is_profane: boolean }>("/utils/profanity", { text });

export const utilToilets = (latitude: number, longitude: number) =>
  post<{ toilets: unknown[] }>("/utils/toilets", { latitude, longitude });

export const utilModerateImage = (image_url: string) =>
  post<{
    is_safe: boolean;
    is_nsfw: boolean;
    is_vulgar: boolean;
    is_ai_generated: boolean;
    confidence: number;
    reason: string;
  }>("/utils/moderate-image", { image_url });
