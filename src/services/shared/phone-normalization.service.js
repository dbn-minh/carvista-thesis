const DEFAULT_COUNTRY_CODE = "+84";

export function normalizePhoneNumber(value, { defaultCountryCode = DEFAULT_COUNTRY_CODE } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const countryDigits = String(defaultCountryCode || DEFAULT_COUNTRY_CODE).replace(/\D/g, "");
  const compact = raw.replace(/[\s().-]+/g, "");
  const withoutInternationalPrefix = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact;

  if (withoutInternationalPrefix.startsWith("+")) {
    const digits = withoutInternationalPrefix.slice(1).replace(/\D/g, "");
    if (!digits || digits === countryDigits) return "";

    if (countryDigits && digits.startsWith(`${countryDigits}0`)) {
      return `+${countryDigits}${digits.slice(countryDigits.length + 1)}`;
    }

    return `+${digits}`;
  }

  const digits = withoutInternationalPrefix.replace(/\D/g, "");
  if (!digits || digits === countryDigits) return "";

  if (countryDigits && digits.startsWith(countryDigits)) {
    return `+${digits}`;
  }

  if (digits.startsWith("0")) {
    return `+${countryDigits}${digits.slice(1)}`;
  }

  return `+${countryDigits}${digits}`;
}

export function normalizePhoneNumberOrNull(value, options) {
  return normalizePhoneNumber(value, options) || null;
}
