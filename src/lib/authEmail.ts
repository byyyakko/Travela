/**
 * Wrappers for auth email actions that check the backend rate limiter
 * before calling Supabase, preventing over_email_send_rate_limit errors.
 */
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "";

type RateLimitAction = "signup" | "reset_password" | "resend_verification";

async function checkRateLimit(email: string, action: RateLimitAction): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/email-rate-limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action }),
    });
    if (res.status === 429) {
      const data = await res.json();
      return { allowed: false, retryAfter: data.retry_after ?? 60 };
    }
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open if backend unreachable
  }
}

export async function sendResetEmail(email: string): Promise<{ error: string | null; retryAfter?: number }> {
  const { allowed, retryAfter } = await checkRateLimit(email, "reset_password");
  if (!allowed) {
    return { error: `Please wait ${retryAfter}s before requesting another reset email.`, retryAfter };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error?.message?.includes("rate limit")) {
    return { error: "Too many requests. Please wait 60 seconds and try again." };
  }
  return { error: error?.message ?? null };
}

export async function resendVerification(email: string): Promise<{ error: string | null; retryAfter?: number }> {
  const { allowed, retryAfter } = await checkRateLimit(email, "resend_verification");
  if (!allowed) {
    return { error: `Please wait ${retryAfter}s before resending.`, retryAfter };
  }
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  if (error?.message?.includes("rate limit")) {
    return { error: "Too many requests. Please wait 60 seconds and try again." };
  }
  return { error: error?.message ?? null };
}
