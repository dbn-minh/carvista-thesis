"use client";

import type { AdvisorProfile } from "./types";

const STORAGE_KEY = "carvista_advisor_profile";
export const ADVISOR_PROFILE_EVENT = "carvista-advisor-profile-changed";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getStoredAdvisorProfile(): AdvisorProfile {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? (parsed as AdvisorProfile) : {};
  } catch {
    return {};
  }
}

export function setStoredAdvisorProfile(profile: AdvisorProfile): void {
  if (typeof window === "undefined") return;

  try {
    if (!profile || Object.keys(profile).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }
  } catch {
    return;
  }

  window.dispatchEvent(new Event(ADVISOR_PROFILE_EVENT));
}
