import { useCallback, useEffect, useRef } from "react";
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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.trim() || "https://travela-backend-p2zp.onrender.com";

export function useAnalytics(page: string) {
  const { user } = useAuth();
  const hasFiredPageView = useRef(false);

  const track = useCallback(
    (eventType: string, eventData?: EventData) => {
      fetch(`${BACKEND_URL}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id ?? null,
          event_type: eventType,
          event_data: eventData ?? {},
          page,
          session_id: getSessionId(),
        }),
      }).catch((err) => console.warn("[analytics]", err));
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
