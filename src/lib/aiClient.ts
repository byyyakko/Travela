import { supabase } from "@/integrations/supabase/client";

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message || `Edge function ${fn} failed`);
  return data as T;
}

export const aiItinerary = (prompt: string) =>
  invoke<Record<string, unknown>>("ai-travel", { type: "itinerary", prompt });

export const aiPhrases = (country: string) =>
  invoke<Record<string, unknown>>("ai-travel", { type: "phrases", country });

export const aiAttractions = (country: string, category?: string) =>
  invoke<{ country: string; attractions: unknown[] }>("ai-travel", {
    type: "explore-attractions",
    country,
    category,
  });

export const aiTranslate = (message: string, destination_country?: string) =>
  invoke<{
    cultural_context: string;
    suggested_response: string;
    tips: string[];
    politeness_level: string;
  }>("ai-travel", { type: "cultural-translation", message, destination_country });

export const aiChat = (messages: { role: string; content: string }[]) =>
  invoke<{ role: string; content: string }>("tori-tan-chat", { messages });

export const utilGeocode = (address: string) =>
  invoke<{
    latitude: number | null;
    longitude: number | null;
    formattedAddress: string | null;
    error?: string;
  }>("geocode-address", { address });

export const utilProfanity = (text: string) =>
  invoke<{ is_profane: boolean }>("check-profanity", { text });

export const utilToilets = (latitude: number, longitude: number) =>
  invoke<{ toilets: unknown[] }>("find-toilets", { latitude, longitude });

export const utilModerateImage = (image_url: string) =>
  invoke<{
    is_safe: boolean;
    is_nsfw: boolean;
    is_vulgar: boolean;
    is_ai_generated: boolean;
    confidence: number;
    reason: string;
  }>("moderate-image", { image_url });
