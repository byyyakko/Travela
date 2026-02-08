import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Stable session ID for the duration of the browser tab
let sessionId: string | null = null;
function getSessionId() {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

type EventData = Record<string, unknown>;

export function useAnalytics(page: string) {
  const { user } = useAuth();
  const hasFiredPageView = useRef(false);

  const track = useCallback(
    (eventType: string, eventData?: EventData) => {
      supabase
        .from("analytics_events")
        .insert({
          user_id: user?.id ?? null,
          event_type: eventType,
          event_data: eventData ?? {},
          page,
          session_id: getSessionId(),
        })
        .then(({ error }) => {
          if (error) console.warn("[analytics]", error.message);
        });
    },
    [user?.id, page],
  );

  // Auto-fire page_view once per mount
  useEffect(() => {
    if (!hasFiredPageView.current) {
      hasFiredPageView.current = true;
      track("page_view");
    }
  }, [track]);

  return { track };
}
