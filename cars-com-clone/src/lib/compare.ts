export type CompareLaunchOptions = {
  leftVariantId?: number | null;
  leftVariantLabel?: string | null;
  leftListingId?: number | null;
  rightVariantId?: number | null;
  rightVariantLabel?: string | null;
  rightListingId?: number | null;
  leftQuery?: string | null;
  rightQuery?: string | null;
  marketId?: number | null;
};

function appendString(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined
) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  params.set(key, trimmed);
}

function appendInteger(
  params: URLSearchParams,
  key: string,
  value: number | null | undefined
) {
  if (!Number.isInteger(value)) return;
  params.set(key, String(value));
}

export function buildCompareHref(options: CompareLaunchOptions = {}) {
  const params = new URLSearchParams();

  appendInteger(params, "leftVariantId", options.leftVariantId);
  appendString(params, "leftVariantLabel", options.leftVariantLabel);
  appendInteger(params, "leftListingId", options.leftListingId);
  appendInteger(params, "rightVariantId", options.rightVariantId);
  appendString(params, "rightVariantLabel", options.rightVariantLabel);
  appendInteger(params, "rightListingId", options.rightListingId);
  appendString(params, "leftQuery", options.leftQuery);
  appendString(params, "rightQuery", options.rightQuery);
  appendInteger(params, "marketId", options.marketId);

  const query = params.toString();
  return query ? `/compare?${query}` : "/compare";
}

export function buildComparePairLabel(labels: Array<string | null | undefined>) {
  const parts = labels
    .map((label) => String(label || "").trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "Selected vehicles";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} vs ${parts[1]}`;
}

export function enrichCompareFollowUpMessage(
  message: string,
  labels: Array<string | null | undefined>
) {
  const trimmed = message.trim();
  const normalized = trimmed.toLowerCase();
  const compareLabels = labels
    .map((label) => String(label || "").trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!trimmed || compareLabels.length < 2) return trimmed;

  const alreadyMentionsVehicles = compareLabels.some((label) =>
    normalized.includes(label.toLowerCase())
  );

  if (alreadyMentionsVehicles) return trimmed;

  return `Compare ${compareLabels[0]} and ${compareLabels[1]}. ${trimmed}`;
}
