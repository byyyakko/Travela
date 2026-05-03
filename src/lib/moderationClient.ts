import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session?.access_token ?? ""}`,
  };
}

export interface MessageItem {
  sender_id: string;
  content: string;
  created_at?: string;
}

export interface ReportPayload {
  reported_user_id: string;
  conversation_id?: string;
  messages: MessageItem[];
  reason: string;
  description?: string;
}

export interface ReportResult {
  status: "flagged_for_review" | "auto_banned" | "pending" | "dismissed";
  action_taken: boolean;
  confidence: number;
  profanity_flagged: boolean;
  categories: string[];
  message: string;
}

export async function submitReport(payload: ReportPayload): Promise<ReportResult> {
  const resp = await fetch(`${BACKEND_URL}/moderation/report`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as any).detail || "Failed to submit report");
  }
  return resp.json();
}

export async function checkEmailBanned(email: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BACKEND_URL}/moderation/check-banned`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.banned === true;
  } catch {
    return false;
  }
}
