function trimTrailingSlash(value: string | undefined | null): string {
  return String(value || "").replace(/\/+$/, "");
}

export const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
export const API_BASE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api"
);

export function getApiOriginLabel(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL;
  }
}
