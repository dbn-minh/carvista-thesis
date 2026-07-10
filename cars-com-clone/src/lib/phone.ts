export const VIETNAM_PHONE_PREFIX = "+84";

export function normalizeVietnamPhoneInput(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const compact = raw.replace(/[\s().-]+/g, "");
  const withInternationalPrefix = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact;

  if (withInternationalPrefix.startsWith("+")) {
    const digits = withInternationalPrefix.slice(1).replace(/\D/g, "");
    if (!digits || digits === "84") return "";
    if (digits.startsWith("840")) return `+84${digits.slice(3)}`;
    return `+${digits}`;
  }

  const digits = withInternationalPrefix.replace(/\D/g, "");
  if (!digits || digits === "84") return "";
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return `+84${digits}`;
}

export function withVietnamPhonePrefix(value: string | null | undefined) {
  return String(value || "").trim() || VIETNAM_PHONE_PREFIX;
}

export function hasVietnamPhoneSubscriberDigits(value: string | null | undefined) {
  const normalized = normalizeVietnamPhoneInput(value);
  const digits = normalized.replace(/\D/g, "");
  return normalized.startsWith(VIETNAM_PHONE_PREFIX) && digits.length >= 10;
}
