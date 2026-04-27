function trimTrailingSlash(value: string | undefined | null): string {
  return String(value || "").replace(/\/+$/, "");
}

function readEnv(value: string | undefined): string | null {
  const normalized = trimTrailingSlash(value);
  return normalized ? normalized : null;
}

function getBrowserOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return trimTrailingSlash(window.location.origin);
}

function getBrowserApiBaseUrl(): string | null {
  if (typeof window === "undefined") return null;
  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "localhost";
  const apiPort = process.env.NEXT_PUBLIC_API_PORT || "4000";
  return trimTrailingSlash(`${protocol}//${hostname}:${apiPort}/api`);
}

export const APP_URL =
  readEnv(process.env.NEXT_PUBLIC_APP_URL) || getBrowserOrigin() || "http://localhost:3000";
export const API_BASE_URL =
  readEnv(process.env.NEXT_PUBLIC_API_BASE_URL) ||
  getBrowserApiBaseUrl() ||
  "http://localhost:4000/api";

export function getApiOriginLabel(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL;
  }
}
