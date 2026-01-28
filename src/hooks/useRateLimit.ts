import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface RateLimitConfig {
  action: string;
  maxRequests: number;
  windowMinutes: number;
}

export const useRateLimit = () => {
  const { user } = useAuth();

  const checkRateLimit = async (config: RateLimitConfig): Promise<boolean> => {
    if (!user) return false;

    const { data, error } = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _action_type: config.action,
      _max_requests: config.maxRequests,
      _window_minutes: config.windowMinutes,
    });

    if (error) {
      console.error("Rate limit check failed:", error);
      return true; // Allow action if check fails
    }

    return data as boolean;
  };

  return { checkRateLimit };
};

// Rate limit configurations
export const RATE_LIMITS = {
  SEND_MESSAGE: { action: "send_message", maxRequests: 60, windowMinutes: 1 },
  MATCH_ACTION: { action: "match_action", maxRequests: 100, windowMinutes: 5 },
  CREATE_POST: { action: "create_post", maxRequests: 10, windowMinutes: 60 },
  REPORT_USER: { action: "report_user", maxRequests: 5, windowMinutes: 60 },
  SIGN_IN_ATTEMPT: { action: "sign_in_attempt", maxRequests: 5, windowMinutes: 15 },
} as const;
