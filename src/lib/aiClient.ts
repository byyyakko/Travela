import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL?.trim() || "https://travela-backend-p2zp.onrender.com";

async function backendPost<T>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.detail || `Backend ${path} failed (${resp.status})`);
  }
  return resp.json();
}

export const aiItinerary = (prompt: string) =>
  backendPost<Record<string, unknown>>("/ai/itinerary", { prompt });

export const aiPhrases = (country: string) =>
  backendPost<Record<string, unknown>>("/ai/phrases", { country });

export const aiAttractions = (country: string, category?: string) =>
  backendPost<{ country: string; attractions: unknown[] }>("/ai/attractions", { country, category });

export const aiTranslate = (message: string, destination_country?: string) =>
  backendPost<{
    cultural_context: string;
    suggested_response: string;
    tips: string[];
    politeness_level: string;
  }>("/ai/translate", { message, destination_country });

export const aiChat = (messages: { role: string; content: string }[]) =>
  backendPost<{ role: string; content: string }>("/ai/chat", { messages });

export const utilGeocode = (address: string) =>
  backendPost<{
    latitude: number | null;
    longitude: number | null;
    formattedAddress: string | null;
    error?: string;
  }>("/utils/geocode", { address });

export const utilProfanity = (text: string) =>
  backendPost<{ is_profane: boolean }>("/utils/profanity", { text });

export const utilToilets = (latitude: number, longitude: number) =>
  backendPost<{ toilets: unknown[] }>("/utils/toilets", { latitude, longitude });

export const utilModerateImage = (image_url: string) =>
  backendPost<{
    is_safe: boolean;
    is_nsfw: boolean;
    is_vulgar: boolean;
    is_ai_generated: boolean;
    confidence: number;
    reason: string;
  }>("/utils/moderate-image", { image_url });
