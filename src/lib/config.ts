const RENDER_URL = "https://travela-backend-p2zp.onrender.com";

export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL?.trim() || RENDER_URL;
