const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

let accessToken: string | null = localStorage.getItem("pula_admin_token");
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem("pula_admin_token", token);
  else localStorage.removeItem("pula_admin_token");
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as any) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const hadToken = !!accessToken;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // A 401 with no token attached means this request was never authenticated
  // in the first place (e.g. a login attempt with the wrong email/password),
  // so it should surface the backend's actual message, not "session expired".
  if (res.status === 401 && hadToken) {
    onUnauthorized?.();
    throw new ApiRequestError(401, "Session expired. Please log in again.");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      /* ignore */
    }
    throw new ApiRequestError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};
