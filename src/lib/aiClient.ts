import { supabase } from "@/integrations/supabase/client";

/**
 * Thin wrappers around Lovable Cloud edge functions.
 * All AI features are routed through the `ai-travel` edge function,
 * which uses Lovable AI Gateway (no extra API key required).
 */

async function invokeAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-travel", { body });
  if (error) throw new Error(error.message || "AI request failed");
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    throw new Error(((data as Record<string, unknown>).error as string) || "AI request failed");
  }
  return data as T;
}

async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message || `${name} request failed`);
  return data as T;
}

export const aiItinerary = (prompt: string) =>
  invokeAi<Record<string, unknown>>({ type: "itinerary", prompt });

export const aiPhrases = (country: string) =>
  invokeAi<Record<string, unknown>>({ type: "phrases", country });

export const aiAttractions = (country: string, category?: string) =>
  invokeAi<{ country: string; attractions: unknown[] }>({
    type: "explore-attractions",
    country,
    category,
  });

export const aiTranslate = (message: string, destination_country?: string) =>
  invokeAi<{
    cultural_context: string;
    suggested_response: string;
    tips: string[];
    politeness_level: string;
  }>({ type: "cultural-translation", message, destination_country });

export const aiChat = (messages: { role: string; content: string }[]) =>
  invokeFn<{ role: string; content: string }>("tori-tan-chat", { messages });

// ── Utility endpoints (Lovable Cloud edge functions) ─────────────────────────

export const utilGeocode = (address: string) =>
  invokeFn<{
    latitude: number | null;
    longitude: number | null;
    formattedAddress: string | null;
    error?: string;
  }>("geocode-address", { address });

export const utilProfanity = (text: string) =>
  invokeFn<{ is_profane: boolean }>("check-profanity", { text });

export const utilToilets = (latitude: number, longitude: number) =>
  invokeFn<{ toilets: unknown[] }>("find-toilets", { latitude, longitude });

export const utilModerateImage = (image_url: string) =>
  invokeFn<{
    is_safe: boolean;
    is_nsfw: boolean;
    is_vulgar: boolean;
    is_ai_generated: boolean;
    confidence: number;
    reason: string;
  }>("moderate-image", { image_url });
