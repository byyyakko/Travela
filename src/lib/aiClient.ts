import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL?.trim();

function getBackendUrl(): string {
  if (!BACKEND_URL) {
    throw new Error(
      "Backend URL is not configured. Set VITE_BACKEND_URL in Cloudflare dashboard → Workers & Pages → travela → Settings → Environment Variables."
    );
  }
  return BACKEND_URL;
}

async function backendPost<T>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(`${getBackendUrl()}${path}`, {
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

export async function aiItinerary(
  prompt: string,
  onStatus?: (status: string) => void
): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  let resp: Response;
  try {
    resp = await fetch(`${getBackendUrl()}/ai/itinerary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Itinerary generation timed out (90s). Please try a shorter prompt or try again.");
    }
    throw err;
  }

  clearTimeout(timeoutId);

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.detail || `Backend /ai/itinerary failed (${resp.status})`);
  }
  if (!resp.body) {
    throw new Error("Backend did not return an itinerary stream");
  }
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let payload: { status?: string; data?: Record<string, unknown>; error?: string };
      try {
        payload = JSON.parse(line.slice(6));
      } catch {
        throw new Error("Backend returned an invalid itinerary stream");
      }
      if (payload.status === "error") {
        throw new Error(payload.error || "Itinerary generation failed");
      }
      if (payload.status === "done") return payload.data ?? {};
      if (payload.status && onStatus) onStatus(payload.status);
    }
  }
  throw new Error("Itinerary stream ended without result");
}

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
