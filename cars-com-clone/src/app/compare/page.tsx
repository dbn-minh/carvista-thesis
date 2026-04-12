"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  Bot,
  CarFront,
  CircleDollarSign,
  Loader2,
  Shield,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import EmptyState from "@/components/common/EmptyState";
import StatusBanner from "@/components/common/StatusBanner";
import Header from "@/components/layout/Header";
import {
  buildListingTitle,
  formatBodyType,
  formatFuelType,
  formatListingPrice,
  formatLocation,
  formatMileage,
  formatTransmission,
  getListingImages,
} from "@/components/listings/listing-utils";
import { getStoredAdvisorProfile } from "@/lib/advisor-profile";
import { aiApi, catalogApi, listingsApi } from "@/lib/carvista-api";
import { apiFetch, toCurrency } from "@/lib/api-client";
import { useRequireLogin } from "@/lib/auth-guard";
import {
  buildCompareHref,
  buildComparePairLabel,
  enrichCompareFollowUpMessage,
} from "@/lib/compare";
import type {
  AiCompareItem,
  AiCompareResponse,
  AiConfidence,
  AiInsightCard,
  ChatResponse,
  ListingDetail,
  VariantDetail,
  VariantListItem,
} from "@/lib/types";

type SelectedVehicle = {
  variantId: number | null;
  label: string;
  query: string;
  listingId: number | null;
  listing: ListingDetail | null;
  variantImageUrl: string | null;
  resolutionNote: string | null;
  source: "listing" | "variant" | "query" | "search";
};

type SearchState = {
  loading: boolean;
  error: string;
  options: VariantListItem[];
};

type ResolutionStatus = "empty" | "exact" | "multiple" | "unsupported";

type ResolutionResult = {
  selection: SelectedVehicle | null;
  status: ResolutionStatus;
  note: string | null;
  searchQuery?: string;
};

type FollowUpMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  cards?: AiInsightCard[];
  confidence?: AiConfidence | null;
  caveats?: string[];
  followUps?: string[];
};

type VerdictCard = {
  key: string;
  title: string;
  winner: string;
  description: string;
  icon: typeof Users;
};

type WinnerHighlight = {
  key: string;
  title: string;
  score: number;
};

const emptySearchState: SearchState = {
  loading: false,
  error: "",
  options: [],
};

const followUpSuggestions = [
  "Which is better for a family of 5?",
  "Which one is cheaper to own over 5 years?",
  "Which one is better for resale?",
  "Give me the pros and cons only.",
];

const compareTableLabels: Record<string, string> = {
  latest_price: "Market price",
  engine: "Engine",
  fuel_type: "Fuel type",
  transmission: "Transmission",
  drivetrain: "Drivetrain",
  seats: "Seats",
  avg_rating: "Owner rating",
  "0_100_kmh": "0-100 km/h",
  top_speed_kmh: "Top speed",
  fuel_consumption_l_100km: "Fuel use",
  energy_consumption_kwh_100km: "Energy use",
  ground_clearance_mm: "Ground clearance",
  cargo_capacity_l: "Cargo space",
  towing_capacity_kg: "Towing capacity",
  wheel_size_inch: "Wheel size",
  safety_rating: "Safety rating",
  airbags_count: "Airbags",
  adas_level: "ADAS level",
  lane_keep_assist: "Lane keep assist",
  adaptive_cruise_control: "Adaptive cruise",
  blind_spot_monitor: "Blind-spot monitor",
  charging_dc_kw: "DC fast charging",
};

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toPositiveInteger(value: string | null) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function buildVariantLabel(item: VariantListItem) {
  return [item.model_year, item.make_name, item.model_name, item.trim_name]
    .filter(Boolean)
    .join(" ");
}

function buildCompareItemLabel(item: AiCompareItem) {
  return [item.year, item.make, item.model, item.trim].filter(Boolean).join(" ");
}

function buildLabelFromVariantDetailPayload(variant: Record<string, unknown> | null) {
  if (!variant) return "";
  return [variant.model_year, variant.make_name, variant.model_name, variant.trim_name]
    .filter(Boolean)
    .map((value) => String(value))
    .join(" ");
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function buildCatalogSupportMessage(label?: string | null) {
  const prefix = label?.trim() ? label.trim() : "This vehicle";
  return `${prefix} is not available as a compare-ready CarVista catalog variant yet. Compare only works with catalog-backed vehicles.`;
}

function stripLeadingYearQuery(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^(19|20)\d{2}\s+/, "").trim();
}

function getImageUrl(image: Record<string, unknown>) {
  const value = image.url ?? image.image_url ?? image.src ?? image.image;
  return typeof value === "string" && value ? value : null;
}

function getVariantDetailImage(detail: VariantDetail | null | undefined) {
  if (!detail?.images?.length) return null;
  return detail.images.map(getImageUrl).find((image): image is string => Boolean(image)) ?? null;
}

async function fetchCompareReadyVariants(query: string) {
  const qs = new URLSearchParams();
  qs.set("q", query);
  qs.set("compareReady", "true");
  return apiFetch<{ items: VariantListItem[] }>(`/catalog/variants?${qs.toString()}`);
}

async function fetchCompareReadyVariantDetail(variantId: number) {
  const qs = new URLSearchParams();
  qs.set("compareReady", "true");
  return apiFetch<VariantDetail>(`/catalog/variants/${variantId}?${qs.toString()}`);
}

function pickBestVariantMatch(query: string, items: VariantListItem[]) {
  const normalizedQuery = normalizeLabel(query);
  const ranked = [...items].sort((left, right) => {
    const leftLabel = normalizeLabel(buildVariantLabel(left));
    const rightLabel = normalizeLabel(buildVariantLabel(right));
    const leftExact =
      leftLabel === normalizedQuery ? 4 : leftLabel.startsWith(normalizedQuery) ? 3 : leftLabel.includes(normalizedQuery) ? 2 : 1;
    const rightExact =
      rightLabel === normalizedQuery ? 4 : rightLabel.startsWith(normalizedQuery) ? 3 : rightLabel.includes(normalizedQuery) ? 2 : 1;

    return (
      rightExact - leftExact ||
      Number(right.model_year) - Number(left.model_year) ||
      (Number(left.msrp_base) || Number.MAX_SAFE_INTEGER) - (Number(right.msrp_base) || Number.MAX_SAFE_INTEGER)
    );
  });

  return ranked[0] ?? null;
}

function findExactVariantMatch(query: string, items: VariantListItem[]) {
  const normalizedQuery = normalizeLabel(query);
  const exactMatches = items.filter(
    (item) => normalizeLabel(buildVariantLabel(item)) === normalizedQuery
  );
  if (exactMatches.length === 1) return exactMatches[0];
  return null;
}

async function resolveSelectionFromParams({
  listingId,
  variantId,
  variantLabel,
  query,
}: {
  listingId: number | null;
  variantId: number | null;
  variantLabel: string;
  query: string;
}): Promise<ResolutionResult> {
  if (listingId) {
    const detail = await listingsApi.detail(listingId);
    const label = buildListingTitle(detail.listing);
    const resolvedVariantId = detail.listing.variant_id ?? variantId;
    if (!resolvedVariantId) {
      return {
        selection: null,
        status: "unsupported",
        note: buildCatalogSupportMessage(label),
        searchQuery: "",
      };
    }
    try {
      const variantDetail = await fetchCompareReadyVariantDetail(resolvedVariantId);
      return {
        selection: {
          variantId: resolvedVariantId,
          label,
          query: label,
          listingId,
          listing: detail,
          variantImageUrl: getVariantDetailImage(variantDetail),
          resolutionNote: null,
          source: "listing",
        },
        status: "exact",
        note: null,
        searchQuery: label,
      };
    } catch {
      return {
        selection: null,
        status: "unsupported",
        note: buildCatalogSupportMessage(label),
        searchQuery: "",
      };
    }
  }

  if (variantId) {
    let label = variantLabel.trim();
    try {
      const detail = await fetchCompareReadyVariantDetail(variantId);
      if (!label) {
        label = buildLabelFromVariantDetailPayload(detail.variant);
      }
      return {
        selection: {
          variantId,
          label: label || query.trim() || "Selected vehicle",
          query: label || query.trim() || "Selected vehicle",
          listingId: null,
          listing: null,
          variantImageUrl: getVariantDetailImage(detail),
          resolutionNote: null,
          source: "variant",
        },
        status: "exact",
        note: null,
        searchQuery: label || query.trim() || "Selected vehicle",
      };
    } catch {
      const fallbackLabel = label || query.trim() || "This vehicle";
      return {
        selection: null,
        status: "unsupported",
        note: buildCatalogSupportMessage(fallbackLabel),
        searchQuery: "",
      };
    }
  }

  if (query.trim().length >= 2) {
    const trimmedQuery = query.trim();
    const response = await fetchCompareReadyVariants(trimmedQuery);
    const exactMatch = findExactVariantMatch(trimmedQuery, response.items);
    if (exactMatch) {
      const detail = await fetchCompareReadyVariantDetail(exactMatch.variant_id);
      return {
        selection: {
          variantId: exactMatch.variant_id,
          label: buildVariantLabel(exactMatch),
          query: buildVariantLabel(exactMatch),
          listingId: null,
          listing: null,
          variantImageUrl: getVariantDetailImage(detail),
          resolutionNote: null,
          source: "query",
        },
        status: "exact",
        note: null,
        searchQuery: buildVariantLabel(exactMatch),
      };
    }
    if (response.items.length === 1) {
      const candidate = response.items[0];
      const detail = await fetchCompareReadyVariantDetail(candidate.variant_id);
      return {
        selection: {
          variantId: candidate.variant_id,
          label: buildVariantLabel(candidate),
          query: buildVariantLabel(candidate),
          listingId: null,
          listing: null,
          variantImageUrl: getVariantDetailImage(detail),
          resolutionNote: `Matched the closest supported catalog variant for "${trimmedQuery}".`,
          source: "query",
        },
        status: "exact",
        note: `Matched the closest supported catalog variant for "${trimmedQuery}".`,
        searchQuery: buildVariantLabel(candidate),
      };
    }
    if (response.items.length > 1) {
      return {
        selection: null,
        status: "multiple",
        note: `${response.items.length} supported variants match "${trimmedQuery}". Choose the exact trim to compare.`,
        searchQuery: trimmedQuery,
      };
    }

    const fallbackQuery = stripLeadingYearQuery(trimmedQuery);
    if (fallbackQuery && fallbackQuery !== trimmedQuery) {
      const fallbackResponse = await fetchCompareReadyVariants(fallbackQuery);
      const fallbackExact = findExactVariantMatch(fallbackQuery, fallbackResponse.items);
      if (fallbackExact) {
        const detail = await fetchCompareReadyVariantDetail(fallbackExact.variant_id);
        return {
          selection: {
            variantId: fallbackExact.variant_id,
            label: buildVariantLabel(fallbackExact),
            query: buildVariantLabel(fallbackExact),
            listingId: null,
            listing: null,
            variantImageUrl: getVariantDetailImage(detail),
            resolutionNote: `The exact year from "${trimmedQuery}" is not in the current compare catalog. Using the supported match below instead.`,
            source: "query",
          },
          status: "exact",
          note: `The exact year from "${trimmedQuery}" is not in the current compare catalog. Using a supported match instead.`,
          searchQuery: buildVariantLabel(fallbackExact),
        };
      }
      if (fallbackResponse.items.length === 1) {
        const candidate = fallbackResponse.items[0];
        const detail = await fetchCompareReadyVariantDetail(candidate.variant_id);
        return {
          selection: {
            variantId: candidate.variant_id,
            label: buildVariantLabel(candidate),
            query: buildVariantLabel(candidate),
            listingId: null,
            listing: null,
            variantImageUrl: getVariantDetailImage(detail),
            resolutionNote: `The exact year from "${trimmedQuery}" is not in the current compare catalog. Using the only supported variant found for ${fallbackQuery}.`,
            source: "query",
          },
          status: "exact",
          note: `The exact year from "${trimmedQuery}" is not in the current compare catalog. Using the only supported variant found for ${fallbackQuery}.`,
          searchQuery: buildVariantLabel(candidate),
        };
      }
      if (fallbackResponse.items.length > 1) {
        return {
          selection: null,
          status: "multiple",
          note: `${trimmedQuery} is not in the current compare catalog. Choose one of the supported ${fallbackQuery} variants instead.`,
          searchQuery: fallbackQuery,
        };
      }
    }

    return {
      selection: null,
      status: "unsupported",
      note: buildCatalogSupportMessage(trimmedQuery),
      searchQuery: "",
    };
  }

  return {
    selection: null,
    status: "empty",
    note: null,
    searchQuery: "",
  };
}

function getSelectionImage(selection: SelectedVehicle | null) {
  if (!selection) return null;
  if (selection.listing) {
    const images = getListingImages(selection.listing.listing);
    return images[0] ?? selection.listing.images[0]?.url ?? selection.variantImageUrl ?? null;
  }
  return selection.variantImageUrl ?? null;
}

function getListingStatus(selection: SelectedVehicle | null) {
  return selection?.listing?.listing.status ?? null;
}

function findCompareItem(
  result: AiCompareResponse | null,
  selection: SelectedVehicle | null
) {
  if (!result || !selection?.variantId) return null;
  return result.items.find((item) => item.variant_id === selection.variantId) ?? null;
}

function scoreFamilyUse(item: AiCompareItem) {
  return (
    item.scores.practicality_score +
    item.scores.comfort_score +
    (Number(item.seats) >= 7 ? 2.5 : Number(item.seats) >= 5 ? 1 : 0)
  );
}

function scoreCityUse(item: AiCompareItem) {
  const bodyBonus = ["sedan", "hatchback", "cuv"].includes((item.body_type || "").toLowerCase())
    ? 1.5
    : 0;
  const fuelBonus = ["hybrid", "ev"].includes((item.fuel_type || "").toLowerCase()) ? 1.25 : 0;
  return item.scores.efficiency_score + item.scores.maintenance_score + bodyBonus + fuelBonus;
}

function scoreValue(item: AiCompareItem) {
  return item.scores.price_score + item.scores.resale_score * 0.45;
}

function scoreOwnershipCost(item: AiCompareItem) {
  return item.scores.efficiency_score + item.scores.maintenance_score + item.scores.price_score * 0.35;
}

function createVerdictCard(
  items: AiCompareItem[],
  key: string,
  title: string,
  scorer: (item: AiCompareItem) => number,
  description: (winner: AiCompareItem) => string,
  icon: typeof Users
): VerdictCard {
  const sorted = [...items].sort((left, right) => scorer(right) - scorer(left));
  const winner = sorted[0];

  return {
    key,
    title,
    winner: buildCompareItemLabel(winner),
    description: description(winner),
    icon,
  };
}

function buildVerdictCards(items: AiCompareItem[]): VerdictCard[] {
  if (items.length < 2) return [];

  return [
    createVerdictCard(items, "overall", "Best overall", (item) => item.scores.final_score, () => "Leads on the broadest mix of value, practicality, and day-to-day fit.", Sparkles),
    createVerdictCard(items, "family", "Best for family use", scoreFamilyUse, (winner) => `${Number(winner.seats) || 0} seats, a ${winner.body_type || "versatile"} layout, and the stronger practicality case.`, Users),
    createVerdictCard(items, "city", "Best for city driving", scoreCityUse, () => "Makes the better running-cost and city-use case from the current data.", CarFront),
    createVerdictCard(items, "cost", "Best for lower ownership cost", scoreOwnershipCost, () => "Edges ahead on efficiency, maintenance comfort, and price positioning.", Wrench),
    createVerdictCard(items, "resale", "Best resale outlook", (item) => item.scores.resale_score, () => "Looks more resilient on resale and local market stability right now.", Shield),
    createVerdictCard(items, "value", "Best value for money", scoreValue, () => "Brings the cleaner value story once price and resale are weighed together.", CircleDollarSign),
  ];
}

function buildVehicleStrengths(item: AiCompareItem) {
  return [
    { label: "family practicality", score: scoreFamilyUse(item) },
    { label: "city commuting", score: scoreCityUse(item) },
    { label: "ownership cost", score: scoreOwnershipCost(item) },
    { label: "premium comfort", score: item.scores.comfort_score + item.scores.technology_score * 0.6 },
    { label: "resale confidence", score: item.scores.resale_score },
    { label: "overall value", score: scoreValue(item) },
  ]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((item) => item.label);
}

function buildWinnerHighlights(
  winner: AiCompareItem | null,
  runnerUp: AiCompareItem | null
): WinnerHighlight[] {
  if (!winner || !runnerUp) return [];

  const comfortTechWinner = winner.scores.comfort_score + winner.scores.technology_score * 0.6;
  const comfortTechRunnerUp = runnerUp.scores.comfort_score + runnerUp.scores.technology_score * 0.6;
  const ownershipWinner = scoreOwnershipCost(winner);
  const ownershipRunnerUp = scoreOwnershipCost(runnerUp);
  const valueWinner = scoreValue(winner);
  const valueRunnerUp = scoreValue(runnerUp);

  return [
    {
      key: "value",
      title: "Better value overall",
      score: valueWinner - valueRunnerUp,
    },
    {
      key: "ownership",
      title: "Easier daily ownership",
      score: ownershipWinner - ownershipRunnerUp,
    },
    {
      key: "fit",
      title: "Closer profile match",
      score: winner.scores.use_case_fit_score - runnerUp.scores.use_case_fit_score,
    },
    {
      key: "comfort",
      title: "More polished cabin",
      score: comfortTechWinner - comfortTechRunnerUp,
    },
    {
      key: "safety",
      title: "Stronger safety case",
      score: winner.scores.safety_score - runnerUp.scores.safety_score,
    },
    {
      key: "overall",
      title: "Stronger all-round balance",
      score: winner.scores.final_score - runnerUp.scores.final_score,
    },
  ].sort((left, right) => right.score - left.score).slice(0, 3);
}

function formatCompareValue(key: string, value: unknown) {
  if (value == null) return "Not available";

  if (typeof value === "object" && value !== null && "value" in value) {
    const candidate = value as { value?: unknown; unit?: string | null };
    if (candidate.value == null) return "Not available";
    return `${candidate.value}${candidate.unit ? ` ${candidate.unit}` : ""}`;
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "latest_price") return formatListingPrice(value);
  if (key === "avg_rating" && Number.isFinite(Number(value))) return `${Number(value).toFixed(1)} / 5`;
  if (key === "fuel_consumption_l_100km" && Number.isFinite(Number(value))) return `${Number(value)} L/100 km`;
  if (key === "energy_consumption_kwh_100km" && Number.isFinite(Number(value))) return `${Number(value)} kWh/100 km`;
  if (key === "cargo_capacity_l" && Number.isFinite(Number(value))) return `${toCurrency(value)} L`;
  if (key === "ground_clearance_mm" && Number.isFinite(Number(value))) return `${toCurrency(value)} mm`;
  if (key === "towing_capacity_kg" && Number.isFinite(Number(value))) return `${toCurrency(value)} kg`;
  if (key === "wheel_size_inch" && Number.isFinite(Number(value))) return `${value}"`;
  if (key === "0_100_kmh" && Number.isFinite(Number(value))) return `${Number(value)} sec`;
  if (key === "top_speed_kmh" && Number.isFinite(Number(value))) return `${toCurrency(value)} km/h`;

  return String(value);
}

function buildListingMarketPosition(selection: SelectedVehicle | null, item: AiCompareItem | null) {
  const askingPrice = selection?.listing?.listing.asking_price;
  const marketPrice = item?.latest_price;

  if (!Number.isFinite(Number(askingPrice)) || !Number.isFinite(Number(marketPrice))) return null;

  const delta = Number(askingPrice) - Number(marketPrice);
  const ratio = Math.abs(delta) / Math.max(Number(marketPrice), 1);

  if (ratio <= 0.05) return "Asking price is close to the current market signal.";
  if (delta > 0) return `Asking price sits about ${Math.round(ratio * 100)}% above the latest market signal.`;
  return `Asking price sits about ${Math.round(ratio * 100)}% below the latest market signal.`;
}

function CompareSearchPanel({
  title,
  value,
  onChange,
  searchState,
  selected,
  helperNote,
  helperTone = "info",
  onSelect,
  onClear,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  searchState: SearchState;
  selected: SelectedVehicle | null;
  helperNote?: string | null;
  helperTone?: "info" | "error";
  onSelect: (item: VariantListItem) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-cars-gray-light/70 bg-white p-5 shadow-[0_18px_40px_rgba(15,45,98,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">{title}</p>
          <p className="mt-2 text-sm leading-6 text-cars-gray">
            Search the compare-ready catalog only. Select an exact supported variant before comparing.
          </p>
        </div>
        {selected ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-cars-primary/15 px-3 py-1.5 text-xs font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
          >
            Change
          </button>
        ) : null}
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search compare-ready year, make, model, or trim"
        className="mt-4 h-12 w-full rounded-2xl border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
      />

      {selected ? (
        <div className="mt-4 rounded-[22px] bg-cars-off-white px-4 py-4">
          <p className="text-sm font-semibold text-cars-primary">{selected.label}</p>
          {selected.resolutionNote ? (
            <p className="mt-2 text-xs leading-5 text-cars-gray">{selected.resolutionNote}</p>
          ) : null}
        </div>
      ) : null}

      {searchState.loading ? (
        <p className="mt-4 text-sm text-cars-gray">Searching vehicles...</p>
      ) : null}

      {searchState.error ? (
        <p className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchState.error}
        </p>
      ) : null}

      {!selected && helperNote ? (
        <p
          className={`mt-4 rounded-[18px] border px-4 py-3 text-sm ${
            helperTone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {helperNote}
        </p>
      ) : null}

      {!selected && searchState.options.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
            Supported variants
          </p>
          {searchState.options.map((item) => (
            <button
              key={item.variant_id}
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full flex-col rounded-[20px] border border-cars-gray-light/70 px-4 py-3 text-left transition-colors hover:border-cars-accent/30 hover:bg-cars-off-white"
            >
              <span className="text-sm font-semibold text-cars-primary">{buildVariantLabel(item)}</span>
              <span className="mt-1 text-xs text-cars-gray">
                {formatBodyType(item.body_type)} · {formatFuelType(item.fuel_type)} · {formatTransmission(item.transmission)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompareFollowUpAnswer({
  message,
}: {
  message: FollowUpMessage;
}) {
  return (
    <div
      className={
        message.role === "user"
          ? "ml-auto max-w-[85%] rounded-[24px] rounded-br-md bg-cars-primary px-4 py-3 text-sm leading-6 text-white"
          : "max-w-[92%] rounded-[24px] rounded-bl-md border border-cars-gray-light/80 bg-white px-4 py-3 text-sm leading-6 text-cars-primary shadow-sm"
      }
    >
      <p>{message.content}</p>
      {message.confidence ? (
        <div className="mt-3 inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-cars-primary">
          {message.confidence.label}
        </div>
      ) : null}
      {message.cards?.length ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {message.cards.slice(0, 4).map((card, index) => (
            <div key={`${card.title}-${index}`} className="rounded-[18px] bg-cars-off-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cars-accent">
                {card.title}
              </p>
              {card.value != null ? (
                <p className="mt-2 text-base font-apercu-bold text-cars-primary">
                  {typeof card.value === "number" ? toCurrency(card.value) : String(card.value)}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-cars-gray">{card.description}</p>
            </div>
          ))}
        </div>
      ) : null}
      {message.caveats?.length ? (
        <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          {message.caveats[0]}
        </div>
      ) : null}
      {message.followUps?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.followUps.slice(0, 3).map((followUp) => (
            <span
              key={followUp}
              className="rounded-full bg-cars-off-white px-3 py-2 text-xs font-medium text-cars-primary"
            >
              {followUp}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ComparePageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const suffix = searchParams.toString();
    return suffix ? `${pathname}?${suffix}` : pathname || "/compare";
  }, [pathname, searchParams]);
  const ready = useRequireLogin(nextPath);

  const marketId = toPositiveInteger(searchParams.get("marketId")) ?? 1;
  const [leftSelection, setLeftSelection] = useState<SelectedVehicle | null>(null);
  const [rightSelection, setRightSelection] = useState<SelectedVehicle | null>(null);
  const [leftQuery, setLeftQuery] = useState(searchParams.get("leftQuery") || searchParams.get("leftVariantLabel") || "");
  const [rightQuery, setRightQuery] = useState(searchParams.get("rightQuery") || searchParams.get("rightVariantLabel") || "");
  const [leftSearch, setLeftSearch] = useState<SearchState>(emptySearchState);
  const [rightSearch, setRightSearch] = useState<SearchState>(emptySearchState);
  const [leftHelperNote, setLeftHelperNote] = useState<string | null>(null);
  const [rightHelperNote, setRightHelperNote] = useState<string | null>(null);
  const [leftHelperTone, setLeftHelperTone] = useState<"info" | "error">("info");
  const [rightHelperTone, setRightHelperTone] = useState<"info" | "error">("info");
  const [loadingSelections, setLoadingSelections] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [result, setResult] = useState<AiCompareResponse | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [followUpSessionId, setFollowUpSessionId] = useState<number | null>(null);
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([]);
  const autoRunKeyRef = useRef("");
  const leftHasInitialInput = Boolean(
    searchParams.get("leftListingId") ||
      searchParams.get("leftVariantId") ||
      searchParams.get("leftQuery") ||
      searchParams.get("leftVariantLabel")
  );
  const rightHasInitialInput = Boolean(
    searchParams.get("rightListingId") ||
      searchParams.get("rightVariantId") ||
      searchParams.get("rightQuery") ||
      searchParams.get("rightVariantLabel")
  );

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    async function resolveSelections() {
      setLoadingSelections(true);
      setTone("info");
      setMessage("");
      setResult(null);
      setFollowUpMessages([]);
      setFollowUpSessionId(null);
      setLeftHelperNote(null);
      setRightHelperNote(null);
      autoRunKeyRef.current = "";

      try {
        const [resolvedLeft, resolvedRight] = await Promise.all([
          resolveSelectionFromParams({
            listingId: toPositiveInteger(searchParams.get("leftListingId")),
            variantId: toPositiveInteger(searchParams.get("leftVariantId")),
            variantLabel: searchParams.get("leftVariantLabel") || "",
            query: searchParams.get("leftQuery") || "",
          }),
          resolveSelectionFromParams({
            listingId: toPositiveInteger(searchParams.get("rightListingId")),
            variantId: toPositiveInteger(searchParams.get("rightVariantId")),
            variantLabel: searchParams.get("rightVariantLabel") || "",
            query: searchParams.get("rightQuery") || "",
          }),
        ]);

        if (cancelled) return;

        setLeftSelection(resolvedLeft.selection);
        setRightSelection(resolvedRight.selection);
        setLeftQuery(
          resolvedLeft.selection?.query ??
            resolvedLeft.searchQuery ??
            ""
        );
        setRightQuery(
          resolvedRight.selection?.query ??
            resolvedRight.searchQuery ??
            ""
        );

        setLeftHelperNote(resolvedLeft.note);
        setRightHelperNote(resolvedRight.note);
        setLeftHelperTone(resolvedLeft.status === "unsupported" ? "error" : "info");
        setRightHelperTone(resolvedRight.status === "unsupported" ? "error" : "info");

        const blockingNotes: string[] = [];
        const infoNotes: string[] = [];

        if (leftHasInitialInput && resolvedLeft.status === "unsupported") {
          blockingNotes.push(
            resolvedLeft.note ||
              "Vehicle A could not be matched to a CarVista catalog variant yet. Search again to pick a supported vehicle."
          );
        }
        if (rightHasInitialInput && resolvedRight.status === "unsupported") {
          blockingNotes.push(
            resolvedRight.note ||
              "Vehicle B could not be matched to a CarVista catalog variant yet. Search again to pick a supported vehicle."
          );
        }
        if (resolvedLeft.status === "multiple" && resolvedLeft.note) infoNotes.push(`Vehicle A: ${resolvedLeft.note}`);
        if (resolvedRight.status === "multiple" && resolvedRight.note) infoNotes.push(`Vehicle B: ${resolvedRight.note}`);
        if (resolvedLeft.status === "exact" && resolvedLeft.note) infoNotes.push(resolvedLeft.note);
        if (resolvedRight.status === "exact" && resolvedRight.note) infoNotes.push(resolvedRight.note);

        if (blockingNotes.length > 0) {
          setTone("error");
          setMessage(blockingNotes.join(" "));
        } else if (infoNotes.length > 0) {
          setTone("info");
          setMessage(infoNotes.join(" "));
        }
      } catch (error) {
        if (cancelled) return;
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Could not prepare the comparison right now.");
      } finally {
        if (!cancelled) {
          setLoadingSelections(false);
        }
      }
    }

    void resolveSelections();

    return () => {
      cancelled = true;
    };
  }, [ready, searchParams]);

  function resetResults() {
    setResult(null);
    setFollowUpMessages([]);
    setFollowUpSessionId(null);
    autoRunKeyRef.current = "";
  }

  function updateSide(side: "left" | "right", selection: SelectedVehicle | null, query: string) {
    resetResults();
    if (side === "left") {
      setLeftSelection(selection);
      setLeftQuery(query);
      setLeftHelperNote(null);
      setLeftHelperTone("info");
      return;
    }

    setRightSelection(selection);
    setRightQuery(query);
    setRightHelperNote(null);
    setRightHelperTone("info");
  }

  async function buildSearchSelection(item: VariantListItem, source: "search" | "query" = "search") {
    const detail = await fetchCompareReadyVariantDetail(item.variant_id);
    return {
      variantId: item.variant_id,
      label: buildVariantLabel(item),
      query: buildVariantLabel(item),
      listingId: null,
      listing: null,
      variantImageUrl: getVariantDetailImage(detail),
      resolutionNote: null,
      source,
    } satisfies SelectedVehicle;
  }

  async function handleSearchSelection(side: "left" | "right", item: VariantListItem) {
    try {
      const selection = await buildSearchSelection(item);
      updateSide(side, selection, buildVariantLabel(item));
    } catch (error) {
      const note =
        error instanceof Error
          ? error.message
          : "Could not load this compare-ready vehicle right now.";
      if (side === "left") {
        setLeftHelperNote(note);
        setLeftHelperTone("error");
      } else {
        setRightHelperNote(note);
        setRightHelperTone("error");
      }
    }
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function searchVariants(
      side: "left" | "right",
      query: string,
      selected: SelectedVehicle | null,
      setter: React.Dispatch<React.SetStateAction<SearchState>>,
      excludeIds: number[]
    ) {
      const trimmed = query.trim();

      if (!trimmed || trimmed.length < 2 || (selected && normalizeLabel(selected.label) === normalizeLabel(trimmed))) {
        setter(emptySearchState);
        if (side === "left") {
          setLeftHelperNote(selected?.resolutionNote ?? null);
          setLeftHelperTone("info");
        } else {
          setRightHelperNote(selected?.resolutionNote ?? null);
          setRightHelperTone("info");
        }
        return;
      }

        setter((prev) => ({ ...prev, loading: true, error: "" }));

      try {
        const response = await fetchCompareReadyVariants(trimmed);
        if (cancelled) return;
        setter({
          loading: false,
          error: "",
          options: response.items
            .filter((item) => !excludeIds.includes(item.variant_id))
            .slice(0, 8),
        });

        if (trimmed.length >= 2 && response.items.length === 0) {
          const note = buildCatalogSupportMessage(trimmed);
          if (side === "left") {
            setLeftHelperNote(note);
            setLeftHelperTone("error");
          } else {
            setRightHelperNote(note);
            setRightHelperTone("error");
          }
        } else if (trimmed.length >= 2 && response.items.length > 1) {
          const note = `${response.items.length} supported variants found. Pick the exact trim to compare.`;
          if (side === "left") {
            setLeftHelperNote(note);
            setLeftHelperTone("info");
          } else {
            setRightHelperNote(note);
            setRightHelperTone("info");
          }
        } else if (trimmed.length >= 2 && response.items.length === 1) {
          const note = "One supported variant found. Select it to compare.";
          if (side === "left") {
            setLeftHelperNote(note);
            setLeftHelperTone("info");
          } else {
            setRightHelperNote(note);
            setRightHelperTone("info");
          }
        }
      } catch (error) {
        if (cancelled) return;
        setter({
          loading: false,
          error: error instanceof Error ? error.message : "Could not search vehicles right now.",
          options: [],
        });
      }
    }

    void searchVariants("left", leftQuery, leftSelection, setLeftSearch, [rightSelection?.variantId ?? -1]);
    void searchVariants("right", rightQuery, rightSelection, setRightSearch, [leftSelection?.variantId ?? -1]);

    return () => {
      cancelled = true;
    };
  }, [ready, leftQuery, rightQuery, leftSelection, rightSelection]);

  async function runCompare(activeLeft = leftSelection, activeRight = rightSelection) {
    if (!activeLeft?.variantId || !activeRight?.variantId) {
      setTone("error");
      setMessage("Compare only works with vehicles that already exist in the CarVista catalog. Search and choose two supported models to continue.");
      return;
    }
    if (activeLeft.variantId === activeRight.variantId) {
      setTone("error");
      setMessage("Pick two different vehicles so the comparison stays useful.");
      return;
    }

    setComparing(true);
    setTone("info");
    setMessage("Building a grounded comparison from CarVista specs, pricing, and market data.");

    try {
      const advisorProfile = getStoredAdvisorProfile();
      const response = await aiApi.compare({
        variant_ids: [activeLeft.variantId, activeRight.variantId],
        market_id: marketId,
        price_type: "avg_market",
        buyer_profile: advisorProfile,
      });

      setResult(response);
      setTone("success");
      setMessage("Comparison ready. Review the verdict, trade-offs, and next actions below.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Compare failed.");
    } finally {
      setComparing(false);
    }
  }

  const compareKey = useMemo(() => {
    if (!leftSelection?.variantId || !rightSelection?.variantId) return "";
    return `${marketId}:${leftSelection.variantId}:${rightSelection.variantId}`;
  }, [marketId, leftSelection?.variantId, rightSelection?.variantId]);

  useEffect(() => {
    if (!ready || loadingSelections || !compareKey) return;
    if (autoRunKeyRef.current === compareKey) return;

    autoRunKeyRef.current = compareKey;
    void runCompare();
  }, [ready, loadingSelections, compareKey]);

  const leftItem = useMemo(() => findCompareItem(result, leftSelection), [result, leftSelection]);
  const rightItem = useMemo(() => findCompareItem(result, rightSelection), [result, rightSelection]);

  const vehicleLabels = useMemo(
    () => [
      leftSelection?.label || (leftItem ? buildCompareItemLabel(leftItem) : null),
      rightSelection?.label || (rightItem ? buildCompareItemLabel(rightItem) : null),
    ],
    [leftSelection?.label, rightSelection?.label, leftItem, rightItem]
  );

  const verdictCards = useMemo(() => (result ? buildVerdictCards(result.items) : []), [result]);
  const compareTitle = buildComparePairLabel(vehicleLabels);
  const compareBlocked =
    Boolean(leftHasInitialInput || leftSelection) &&
    Boolean(rightHasInitialInput || rightSelection) &&
    (!leftSelection?.variantId || !rightSelection?.variantId);
  const recommendedItem = useMemo(
    () =>
      result?.recommended_variant_id
        ? result.items.find((item) => item.variant_id === result.recommended_variant_id) ?? null
        : null,
    [result]
  );
  const runnerUpItem = useMemo(
    () =>
      recommendedItem && result
        ? result.items.find((item) => item.variant_id !== recommendedItem.variant_id) ?? null
        : null,
    [recommendedItem, result]
  );
  const winnerHighlights = useMemo(
    () => buildWinnerHighlights(recommendedItem, runnerUpItem),
    [recommendedItem, runnerUpItem]
  );

  const comparisonRows = useMemo(() => {
    if (!result) return [];

    const customRows = [
      {
        key: "listing_price",
        label: "Asking price",
        left: leftSelection?.listing?.listing.asking_price,
        right: rightSelection?.listing?.listing.asking_price,
      },
      {
        key: "year",
        label: "Model year",
        left: leftItem?.year ?? null,
        right: rightItem?.year ?? null,
      },
      {
        key: "body_type",
        label: "Body style",
        left: leftItem?.body_type ?? null,
        right: rightItem?.body_type ?? null,
      },
      {
        key: "fuel_type_base",
        label: "Fuel / powertrain",
        left: leftItem?.fuel_type ?? null,
        right: rightItem?.fuel_type ?? null,
      },
      {
        key: "transmission_base",
        label: "Transmission",
        left: leftItem?.transmission ?? null,
        right: rightItem?.transmission ?? null,
      },
      {
        key: "mileage",
        label: "Mileage",
        left: leftSelection?.listing?.listing.mileage_km ?? null,
        right: rightSelection?.listing?.listing.mileage_km ?? null,
      },
      {
        key: "location",
        label: "Location",
        left: leftSelection?.listing
          ? formatLocation(
              leftSelection.listing.listing.location_city,
              leftSelection.listing.listing.location_country_code
            )
          : null,
        right: rightSelection?.listing
          ? formatLocation(
              rightSelection.listing.listing.location_city,
              rightSelection.listing.listing.location_country_code
            )
          : null,
      },
    ].filter((row) => row.left != null || row.right != null);

    const tableRows = Object.entries(result.comparison_table)
      .filter(([key]) => compareTableLabels[key])
      .map(([key, values]) => ({
        key,
        label: compareTableLabels[key] || key,
        left: values[String(leftSelection?.variantId ?? "")],
        right: values[String(rightSelection?.variantId ?? "")],
      }))
      .filter((row) => row.left != null || row.right != null);

    return [...customRows, ...tableRows];
  }, [result, leftItem, rightItem, leftSelection, rightSelection]);

  async function sendFollowUp(promptOverride?: string) {
    if (!result || !leftSelection?.variantId || !rightSelection?.variantId) return;

    const draft = (promptOverride ?? followUpInput).trim();
    if (!draft || sendingFollowUp) return;

    const enrichedMessage = enrichCompareFollowUpMessage(draft, vehicleLabels);
    setFollowUpMessages((prev) => [
      ...prev,
      {
        id: buildId("user"),
        role: "user",
        content: draft,
      },
    ]);
    setFollowUpInput("");
    setSendingFollowUp(true);

    try {
      const response: ChatResponse = await aiApi.chat({
        session_id: followUpSessionId || undefined,
        message: enrichedMessage,
        context: {
          market_id: marketId,
          compare_variant_ids: [leftSelection.variantId, rightSelection.variantId],
          compare_variant_labels: vehicleLabels,
          focus_variant_id: recommendedItem?.variant_id ?? leftSelection.variantId,
          focus_variant_label: recommendedItem ? buildCompareItemLabel(recommendedItem) : vehicleLabels[0],
          advisor_profile: getStoredAdvisorProfile(),
        },
      });

      setFollowUpSessionId(response.session_id);
      setFollowUpMessages((prev) => [
        ...prev,
        {
          id: buildId("assistant"),
          role: "assistant",
          content: response.answer,
          cards: response.cards,
          confidence: response.confidence ?? null,
          caveats: response.caveats ?? [],
          followUps: response.follow_up_questions,
        },
      ]);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not send the follow-up question.");
    } finally {
      setSendingFollowUp(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.92))] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Compare
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">
                {compareTitle === "Selected vehicles" ? "Compare two vehicles" : compareTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Review the trade-offs, verdicts, and buyer-fit guidance from a grounded comparison instead of starting with a blank chat.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/listings"
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Browse listings
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_auto_1fr] xl:items-start">
      <CompareSearchPanel
            title="Vehicle A"
            value={leftQuery}
            onChange={(value) => updateSide("left", null, value)}
            searchState={leftSearch}
            selected={leftSelection}
            helperNote={leftHelperNote}
            helperTone={leftHelperTone}
            onSelect={(item) => void handleSearchSelection("left", item)}
            onClear={() => updateSide("left", null, "")}
          />

          <div className="flex items-center justify-center xl:pt-20">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-cars-primary text-white shadow-[0_18px_40px_rgba(15,45,98,0.18)]">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
          </div>

          <CompareSearchPanel
            title="Vehicle B"
            value={rightQuery}
            onChange={(value) => updateSide("right", null, value)}
            searchState={rightSearch}
            selected={rightSelection}
            helperNote={rightHelperNote}
            helperTone={rightHelperTone}
            onSelect={(item) => void handleSearchSelection("right", item)}
            onClear={() => updateSide("right", null, "")}
          />
        </section>

        {!loadingSelections && (!leftSelection?.variantId || !rightSelection?.variantId) ? (
          <div className="mt-6">
            <EmptyState
              title={compareBlocked ? "Compare works with catalog-backed vehicles only" : "Choose two vehicles to compare"}
              description={
                compareBlocked
                  ? "One or both selections are not linked to a CarVista catalog variant yet. Search again and pick supported models to generate the comparison."
                  : "Once both sides are selected, CarVista will build the comparison automatically."
              }
            />
          </div>
        ) : null}

        {loadingSelections || comparing ? (
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[28px] border border-cars-gray-light/70 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,45,98,0.06)]"
              >
                <div className="h-4 w-24 animate-pulse rounded-full bg-cars-gray-light/70" />
                <div className="mt-4 h-28 animate-pulse rounded-[22px] bg-cars-off-white" />
                <div className="mt-4 h-20 animate-pulse rounded-[22px] bg-cars-off-white" />
              </div>
            ))}
          </section>
        ) : null}

        {result ? (
          <>
            <section className="mt-6 section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(15,45,98,0.98),rgba(27,76,160,0.92),rgba(95,150,255,0.82))] p-6 text-white md:p-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
                    Quick verdict
                  </p>
                  <h2 className="mt-2 text-3xl font-apercu-bold">
                    {recommendedItem ? `${buildCompareItemLabel(recommendedItem)} comes out ahead overall.` : "Comparison ready"}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/85">
                    {result.assistant_message}
                  </p>
                  {result.highlights?.length ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {result.highlights.slice(0, 3).map((highlight) => (
                        <span
                          key={highlight}
                          className="rounded-full bg-white/12 px-3 py-2 text-xs font-semibold text-white"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {recommendedItem && winnerHighlights.length ? (
                  <aside className="rounded-[24px] border border-white/12 bg-white/10 px-5 py-5 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                      Winner highlights
                    </p>
                    <h3 className="mt-2 text-lg font-apercu-bold text-white">
                      {buildCompareItemLabel(recommendedItem)}
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {winnerHighlights.map((highlight) => (
                        <li key={highlight.key} className="flex items-center gap-3">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-300" />
                          <p className="text-sm font-semibold text-white">{highlight.title}</p>
                        </li>
                      ))}
                    </ul>
                  </aside>
                ) : null}
              </div>
            </section>

            <section className="mt-6 grid gap-4 xl:grid-cols-3">
              {verdictCards.map((card) => (
                <article
                  key={card.key}
                  className="rounded-[28px] border border-cars-gray-light/70 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,45,98,0.06)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cars-off-white text-cars-accent">
                      <card.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                        {card.title}
                      </p>
                      <h3 className="mt-1 text-lg font-apercu-bold text-cars-primary">{card.winner}</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-cars-gray">{card.description}</p>
                </article>
              ))}
            </section>

            <section className="mt-6 grid gap-5 xl:grid-cols-2">
              {[{ selection: leftSelection, item: leftItem }, { selection: rightSelection, item: rightItem }].map(
                ({ selection, item }, index) => (
                  <article
                    key={selection?.variantId ?? index}
                    className="flex h-full flex-col overflow-hidden rounded-[30px] border border-cars-gray-light/70 bg-white shadow-[0_20px_44px_rgba(15,45,98,0.08)]"
                  >
                    <div className="relative h-56 bg-cars-off-white">
                      {getSelectionImage(selection) ? (
                        <img
                          src={getSelectionImage(selection) || undefined}
                          alt={selection?.label || "Compared vehicle"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-medium text-cars-gray">
                          Photo unavailable
                        </div>
                      )}
                      {getListingStatus(selection) ? (
                        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cars-primary">
                          {getListingStatus(selection)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                            Vehicle {index === 0 ? "A" : "B"}
                          </p>
                          <h3 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                            {selection?.label || (item ? buildCompareItemLabel(item) : "Vehicle")}
                          </h3>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                            {selection?.listing ? "Asking price" : "Market price"}
                          </p>
                          <p className="mt-2 text-xl font-apercu-bold text-cars-primary">
                            {selection?.listing
                              ? formatListingPrice(selection.listing.listing.asking_price)
                              : formatListingPrice(item?.latest_price ?? item?.msrp_base)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[20px] bg-cars-off-white px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cars-accent">
                            Key snapshot
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-cars-primary">
                            <li>{item?.year || "-"} · {formatBodyType(item?.body_type)}</li>
                            <li>{formatFuelType(item?.fuel_type)} · {formatTransmission(item?.transmission)}</li>
                            <li>{selection?.listing ? formatMileage(selection.listing.listing.mileage_km) : `${Number(item?.seats) || "-"} seats`}</li>
                            {selection?.listing ? (
                              <li>
                                {formatLocation(
                                  selection.listing.listing.location_city,
                                  selection.listing.listing.location_country_code
                                )}
                              </li>
                            ) : null}
                          </ul>
                        </div>

                        <div className="rounded-[20px] bg-cars-off-white px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cars-accent">
                            Best fit
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(item ? buildVehicleStrengths(item) : []).map((strength) => (
                              <span
                                key={strength}
                                className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-cars-primary"
                              >
                                {strength}
                              </span>
                            ))}
                          </div>
                          {buildListingMarketPosition(selection, item) ? (
                            <p className="mt-3 text-sm leading-6 text-cars-gray">
                              {buildListingMarketPosition(selection, item)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5 grid flex-1 gap-4 lg:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                            Pros
                          </p>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-cars-primary">
                            {(item?.pros ?? []).slice(0, 4).map((entry) => (
                              <li key={entry}>- {entry}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                            Watch-outs
                          </p>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-cars-primary">
                            {(item?.cons ?? []).slice(0, 4).map((entry) => (
                              <li key={entry}>- {entry}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-auto flex flex-wrap gap-3 pt-5">
                        {selection?.listingId ? (
                          <Link
                            href={`/listings/${selection.listingId}`}
                            className="inline-flex min-h-10 min-w-[132px] items-center justify-center whitespace-nowrap rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                          >
                            View listing
                          </Link>
                        ) : selection?.variantId ? (
                          <Link
                            href={`/catalog/${selection.variantId}`}
                            className="inline-flex min-h-10 min-w-[132px] items-center justify-center whitespace-nowrap rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                          >
                            View vehicle
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              )}
            </section>

            <section className="mt-6 section-shell p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                    Side by side
                  </p>
                  <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                    What changes between these two?
                  </h2>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr>
                      <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        Category
                      </th>
                      <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        {vehicleLabels[0] || "Vehicle A"}
                      </th>
                      <th className="px-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        {vehicleLabels[1] || "Vehicle B"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.key}>
                        <td className="rounded-l-[18px] bg-cars-off-white px-4 py-3 text-sm font-semibold text-cars-primary">
                          {row.label}
                        </td>
                        <td className="bg-white px-4 py-3 text-sm text-cars-gray">
                          {row.key === "body_type"
                            ? formatBodyType(row.left as string | null | undefined)
                            : row.key === "fuel_type_base"
                              ? formatFuelType(row.left as string | null | undefined)
                              : row.key === "transmission_base"
                                ? formatTransmission(row.left as string | null | undefined)
                                : row.key === "listing_price"
                                  ? formatListingPrice(row.left)
                                  : row.key === "mileage"
                                    ? formatMileage(row.left as number | null | undefined)
                                    : formatCompareValue(row.key, row.left)}
                        </td>
                        <td className="rounded-r-[18px] bg-white px-4 py-3 text-sm text-cars-gray">
                          {row.key === "body_type"
                            ? formatBodyType(row.right as string | null | undefined)
                            : row.key === "fuel_type_base"
                              ? formatFuelType(row.right as string | null | undefined)
                              : row.key === "transmission_base"
                                ? formatTransmission(row.right as string | null | undefined)
                                : row.key === "listing_price"
                                  ? formatListingPrice(row.right)
                                  : row.key === "mileage"
                                    ? formatMileage(row.right as number | null | undefined)
                                    : formatCompareValue(row.key, row.right)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="section-shell p-6">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cars-off-white text-cars-accent">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                      Follow-up
                    </p>
                    <h2 className="mt-1 text-2xl font-apercu-bold text-cars-primary">
                      Ask a sharper question
                    </h2>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {followUpSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendFollowUp(suggestion)}
                      className="rounded-full border border-cars-primary/10 bg-white px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendFollowUp();
                  }}
                  className="mt-5 flex flex-col gap-3"
                >
                  <textarea
                    value={followUpInput}
                    onChange={(event) => setFollowUpInput(event.target.value)}
                    placeholder="Ask about family use, resale, comfort, fuel economy, or ownership cost."
                    className="min-h-[120px] rounded-[22px] border border-cars-gray-light bg-white px-4 py-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={sendingFollowUp || !followUpInput.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {sendingFollowUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Ask follow-up
                    </button>
                  </div>
                </form>

                {followUpMessages.length > 0 ? (
                  <div className="mt-5 space-y-4 rounded-[26px] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_50%)] p-4">
                    {followUpMessages.map((message) => (
                      <CompareFollowUpAnswer key={message.id} message={message} />
                    ))}
                  </div>
                ) : null}
              </article>

              <article className="section-shell p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                  Confidence & caveats
                </p>
                <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                  What to keep in mind
                </h2>

                {result.confidence ? (
                  <div className="mt-5 rounded-[22px] bg-cars-off-white px-4 py-4">
                    <p className="text-sm font-semibold text-cars-primary">{result.confidence.label}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-cars-gray">
                      {result.confidence.rationale.slice(0, 4).map((entry) => (
                        <li key={entry}>- {entry}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {result.caveats?.length ? (
                  <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-sm font-semibold text-amber-900">Missing-data transparency</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                      {result.caveats.slice(0, 4).map((entry) => (
                        <li key={entry}>- {entry}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-5 rounded-[22px] border border-cars-gray-light/70 bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-cars-primary">Next actions</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={buildCompareHref({
                        leftVariantId: leftSelection?.variantId ?? undefined,
                        leftVariantLabel: leftSelection?.label ?? undefined,
                        leftListingId: leftSelection?.listingId ?? undefined,
                        marketId,
                      })}
                      className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                    >
                      Compare against another car
                    </Link>
                    <Link
                      href="/listings"
                      className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                    >
                      Browse live listings
                    </Link>
                  </div>
                </div>
              </article>
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="container-cars py-8">
            <div className="rounded-[28px] border border-cars-gray-light/70 bg-white px-5 py-8 text-sm text-cars-gray shadow-[0_18px_40px_rgba(15,45,98,0.06)]">
              Preparing the comparison...
            </div>
          </main>
        </>
      }
    >
      <ComparePageContent />
    </Suspense>
  );
}
