import type { ApiErrorShape } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("carvista_token");
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("carvista_token", token);
  window.dispatchEvent(new Event("carvista-auth-changed"));
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("carvista_token");
  window.dispatchEvent(new Event("carvista-auth-changed"));
}

export function hasToken(): boolean {
  return Boolean(getStoredToken());
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null
): Promise<T> {
  const authToken = token ?? getStoredToken();

  const headers = new Headers(init.headers || {});
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    const message =
      "Cannot reach the CarVista backend right now. Please make sure the backend server is running on http://localhost:4000.";
    throw new ApiError(
      message,
      undefined,
      error instanceof Error ? { cause: error.message, path } : { path }
    );
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const err = (typeof data === "object" ? data : null) as ApiErrorShape | null;
    throw new ApiError(
      err?.message || `Request failed: ${response.status}`,
      response.status,
      err?.details
    );
  }

  return data as T;
}

export function toCurrency(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("vi-VN").format(num);
}

export function toDateTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
