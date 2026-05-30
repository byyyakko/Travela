import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string)?.trim() ?? "";

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const token = await getToken();
  const resp = await fetch(`${BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { detail?: string };
    throw new Error(err?.detail ?? `GET ${path} failed (${resp.status})`);
  }
  return resp.json() as Promise<T>;
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  const resp = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { detail?: string };
    throw new Error(err?.detail ?? `POST ${path} failed (${resp.status})`);
  }
  return resp.json() as Promise<T>;
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const resp = await fetch(`${BACKEND_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { detail?: string };
    throw new Error(err?.detail ?? `PATCH ${path} failed (${resp.status})`);
  }
  return resp.json() as Promise<T>;
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const token = await getToken();
  const resp = await fetch(`${BACKEND_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({})) as { detail?: string };
    throw new Error(err?.detail ?? `DELETE ${path} failed (${resp.status})`);
  }
  return resp.json() as Promise<T>;
}

export function getWsUrl(path: string): string {
  const wsBase = BACKEND_URL.replace(/^https/, "wss").replace(/^http/, "ws");
  return `${wsBase}${path}`;
}
