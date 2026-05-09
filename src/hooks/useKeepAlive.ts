import { useEffect } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.trim() || "https://travela-backend-p2zp.onrender.com";
const PING_INTERVAL = 13 * 60 * 1000; // 13 minutes (Render sleeps after 15 min)

export function useKeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch(`${BACKEND_URL}/health`).catch(() => {});
    };

    // Initial ping on app load
    ping();

    const id = setInterval(ping, PING_INTERVAL);
    return () => clearInterval(id);
  }, []);
}
