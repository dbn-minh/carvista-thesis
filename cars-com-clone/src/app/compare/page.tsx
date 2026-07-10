"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeftRight, BarChart3, RotateCcw } from "lucide-react";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import StatusBanner from "@/components/common/StatusBanner";
import Header from "@/components/layout/Header";
import {
  buildListingTitle,
  formatBodyType,
  formatFuelType,
  formatListingPrice,
  formatTransmission,
  getListingImages,
} from "@/components/listings/listing-utils";
import { getStoredAdvisorProfile } from "@/lib/advisor-profile";
import { aiApi, catalogApi, listingsApi } from "@/lib/carvista-api";
import { apiFetch, toCurrency } from "@/lib/api-client";
import { useRequireLogin } from "@/lib/auth-guard";
import { buildComparePairLabel } from "@/lib/compare";
import type {
  AiCompareItem,
  AiCompareResponse,
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

type PriceHistoryPoint = {
  captured_at: string;
  price: number;
  source?: string | null;
  price_type?: string | null;
};

type PriceHistorySeries = {
  label: string;
  history: PriceHistoryPoint[];
  color: string;
};

type PriceHistoryState = {
  loading: boolean;
  error: string;
  byVariantId: Record<number, PriceHistoryPoint[]>;
};

const emptySearchState: SearchState = {
  loading: false,
  error: "",
  options: [],
};

const emptyPriceHistoryState: PriceHistoryState = {
  loading: false,
  error: "",
  byVariantId: {},
};

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

function findCompareItem(
  result: AiCompareResponse | null,
  selection: SelectedVehicle | null
) {
  if (!result || !selection?.variantId) return null;
  return result.items.find((item) => item.variant_id === selection.variantId) ?? null;
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

function getVehicleHref(selection: SelectedVehicle | null) {
  if (selection?.listingId) return `/listings/${selection.listingId}`;
  if (selection?.variantId) return `/catalog/${selection.variantId}`;
  return null;
}

const compareTableLabels: Record<string, string> = {
  year: "Model year",
  body_type: "Body style",
  engine: "Engine",
  fuel_type: "Fuel / powertrain",
  transmission: "Transmission",
  drivetrain: "Drivetrain",
  seats: "Seats",
  doors: "Doors",
  latest_price: "Market price",
  msrp_base: "Original MSRP",
  avg_rating: "Owner rating",
  review_count: "Review count",
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

function hasMeaningfulValue(value: unknown) {
  if (value == null) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 && normalized !== "not available" && normalized !== "-";
  }
  return Number.isFinite(Number(value)) || typeof value === "boolean";
}

function formatFullVnd(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not available";
  return `${toCurrency(Math.round(numeric))} VND`;
}

function formatShortVnd(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Not available";
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000_000) {
    return `~${(numeric / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")}B VND`;
  }
  if (abs >= 1_000_000) {
    return `~${Math.round(numeric / 1_000_000).toLocaleString("en-US")}M VND`;
  }
  return formatFullVnd(numeric);
}

function formatComparisonCell(key: string, value: unknown) {
  if (!hasMeaningfulValue(value)) return { text: "Not available", title: undefined };

  if (typeof value === "object" && value !== null && "value" in value) {
    const candidate = value as { value?: unknown; unit?: string | null };
    if (!hasMeaningfulValue(candidate.value)) return { text: "Not available", title: undefined };
    return {
      text: `${candidate.value}${candidate.unit ? ` ${candidate.unit}` : ""}`,
      title: undefined,
    };
  }

  if (key === "body_type") return { text: formatBodyType(String(value)), title: undefined };
  if (key === "fuel_type") return { text: formatFuelType(String(value)), title: undefined };
  if (key === "transmission") return { text: formatTransmission(String(value)), title: undefined };
  if (key === "seats") return { text: `${Number(value)} seats`, title: undefined };
  if (key === "doors") return { text: `${Number(value)} doors`, title: undefined };
  if (key === "latest_price" || key === "msrp_base") return { text: formatShortVnd(value), title: formatFullVnd(value) };
  if (key === "avg_rating" && Number.isFinite(Number(value))) return { text: `${Number(value).toFixed(1)} / 5`, title: undefined };
  if (key === "fuel_consumption_l_100km" && Number.isFinite(Number(value))) return { text: `${Number(value)} L/100 km`, title: undefined };
  if (key === "energy_consumption_kwh_100km" && Number.isFinite(Number(value))) return { text: `${Number(value)} kWh/100 km`, title: undefined };
  if (key === "cargo_capacity_l" && Number.isFinite(Number(value))) return { text: `${Number(value).toLocaleString("en-US")} L`, title: undefined };
  if (key === "ground_clearance_mm" && Number.isFinite(Number(value))) return { text: `${Number(value).toLocaleString("en-US")} mm`, title: undefined };
  if (key === "towing_capacity_kg" && Number.isFinite(Number(value))) return { text: `${Number(value).toLocaleString("en-US")} kg`, title: undefined };
  if (key === "wheel_size_inch" && Number.isFinite(Number(value))) return { text: `${value}"`, title: undefined };
  if (key === "0_100_kmh" && Number.isFinite(Number(value))) return { text: `${Number(value)} sec`, title: undefined };
  if (key === "top_speed_kmh" && Number.isFinite(Number(value))) return { text: `${Number(value).toLocaleString("en-US")} km/h`, title: undefined };

  return { text: String(value), title: undefined };
}

function toTitleLabel(key: string) {
  return compareTableLabels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parsePriceHistoryPoint(row: Record<string, unknown>): PriceHistoryPoint | null {
  const capturedAt = typeof row.captured_at === "string" ? row.captured_at : null;
  const price = Number(row.price);
  if (!capturedAt || !Number.isFinite(price)) return null;

  return {
    captured_at: capturedAt,
    price,
    source: typeof row.source === "string" ? row.source : null,
    price_type: typeof row.price_type === "string" ? row.price_type : null,
  };
}

function formatChartDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function getSortedPriceHistory(history: PriceHistoryPoint[]) {
  return history
    .map((point) => ({
      ...point,
      timestamp: new Date(point.captured_at).getTime(),
    }))
    .filter((point) => Number.isFinite(point.price) && Number.isFinite(point.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
}

function getExpandedPriceDomain(points: ReturnType<typeof getSortedPriceHistory>) {
  const prices = points.map((point) => point.price);
  if (prices.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const rawRange = Math.max(max - min, Math.max(max * 0.04, 1));
  const padding = rawRange * 0.12;
  return {
    min: Math.max(0, min - padding),
    max: max + padding,
  };
}

function getNearestPricePoint(
  points: ReturnType<typeof getSortedPriceHistory>,
  timestamp: number
) {
  return points.reduce<(typeof points)[number] | null>((closest, point) => {
    if (!closest) return point;
    return Math.abs(point.timestamp - timestamp) < Math.abs(closest.timestamp - timestamp)
      ? point
      : closest;
  }, null);
}

function getPriceTrendLabel(points: ReturnType<typeof getSortedPriceHistory>) {
  const first = points[0] ?? null;
  const latest = points.at(-1) ?? null;
  if (!first || !latest) return "Limited data";

  const delta = latest.price - first.price;
  if (Math.abs(delta) < 1) return "Flat";
  return delta > 0 ? "Rising" : "Softening";
}

function CombinedPriceHistoryChart({
  series,
  hoverTimestamp,
  onHoverTimestampChange,
}: {
  series: PriceHistorySeries[];
  hoverTimestamp: number | null;
  onHoverTimestampChange: (timestamp: number | null) => void;
}) {
  const normalizedSeries = series.map((item) => ({
    ...item,
    points: getSortedPriceHistory(item.history),
  }));
  const allPoints = normalizedSeries.flatMap((item) => item.points);
  const drawableSeries = normalizedSeries.filter((item) => item.points.length >= 2);
  const chartSeries = normalizedSeries.map((item) => {
    const domain = getExpandedPriceDomain(item.points);
    return {
      ...item,
      domain,
      latest: item.points.at(-1) ?? null,
    };
  });
  const width = 980;
  const height = 340;
  const paddingLeft = 96;
  const paddingRight = 96;
  const paddingTop = 34;
  const paddingBottom = 48;
  const times = allPoints.map((point) => point.timestamp);
  const minTime = times.length ? Math.min(...times) : 0;
  const maxTime = times.length ? Math.max(...times) : 0;
  const timeRange = Math.max(maxTime - minTime, 1);
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const xForPoint = (timestamp: number) =>
    paddingLeft + ((timestamp - minTime) / timeRange) * plotWidth;
  const yForPoint = (price: number, domain: { min: number; max: number }) =>
    height - paddingBottom - ((price - domain.min) / Math.max(domain.max - domain.min, 1)) * plotHeight;
  const activeTimestamp = hoverTimestamp ?? maxTime;
  const activeRows = chartSeries.map((item) => ({
    ...item,
    activePoint: getNearestPricePoint(item.points, activeTimestamp),
  }));
  const activeX = allPoints.length ? xForPoint(activeTimestamp) : null;
  const hoverRows = hoverTimestamp == null ? [] : activeRows.filter((item) => item.activePoint);
  const hoverDate = hoverRows[0]?.activePoint?.captured_at ?? null;
  const hoverXPercent =
    activeX == null ? 50 : Math.min(92, Math.max(8, (activeX / width) * 100));
  const hoverTooltipTransform =
    hoverXPercent > 72 ? "translateX(-100%)" : hoverXPercent < 28 ? "translateX(0)" : "translateX(-50%)";
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = [0, 0.5, 1];

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!allPoints.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * width;
    const clampedX = Math.min(width - paddingRight, Math.max(paddingLeft, rawX));
    onHoverTimestampChange(minTime + ((clampedX - paddingLeft) / plotWidth) * timeRange);
  }

  return (
    <article className="rounded-[26px] border border-cars-gray-light/70 bg-white p-4 shadow-[0_16px_34px_rgba(15,45,98,0.06)]">
      <div className="grid gap-3 md:grid-cols-2">
        {chartSeries.map((item, index) => {
          return (
            <div key={item.label} className="rounded-[20px] bg-cars-off-white px-4 py-3">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-5 text-cars-primary">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                    {index === 0 ? "Left scale" : "Right scale"} - Latest{" "}
                    {item.latest ? formatShortVnd(item.latest.price) : "No data"} - {getPriceTrendLabel(item.points)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[22px] bg-cars-off-white">
        {drawableSeries.length > 0 ? (
          <>
            {hoverRows.length > 0 ? (
              <div
                className="pointer-events-none absolute top-5 z-20 w-[min(320px,calc(100%-2rem))] rounded-[20px] border border-cars-gray-light/80 bg-white/95 px-4 py-3 text-xs shadow-[0_18px_45px_rgba(15,45,98,0.16)] backdrop-blur-md"
                style={{
                  left: `${hoverXPercent}%`,
                  transform: hoverTooltipTransform,
                }}
              >
                <p className="font-apercu-bold uppercase tracking-[0.14em] text-cars-accent">
                  {hoverDate ? formatChartDate(hoverDate) : "Selected point"}
                </p>
                <div className="mt-2 space-y-2">
                  {hoverRows.map((item) => {
                    const point = item.activePoint;
                    if (!point) return null;
                    return (
                      <div key={`hover-${item.label}`} className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-start gap-2 text-cars-gray">
                          <span
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="line-clamp-2 leading-5">{item.label}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap font-semibold text-cars-primary">
                          {formatFullVnd(point.price)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Compared vehicle price history"
              className="h-[340px] w-full cursor-crosshair touch-none"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => onHoverTimestampChange(null)}
            >
            {yTicks.map((tick) => {
              const y = paddingTop + tick * plotHeight;
              return (
                <line
                  key={tick}
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="#d7e0ef"
                  strokeDasharray="5 7"
                />
              );
            })}
            {chartSeries.slice(0, 2).map((item, index) => {
              const tickDomain = item.domain;
              const textX = index === 0 ? paddingLeft - 12 : width - paddingRight + 12;
              const anchor = index === 0 ? "end" : "start";
              return yTicks.map((tick) => {
                const y = paddingTop + tick * plotHeight;
                const price = tickDomain.max - tick * (tickDomain.max - tickDomain.min);
                return (
                  <text
                    key={`${item.label}-${tick}`}
                    x={textX}
                    y={y + 4}
                    fill={item.color}
                    fontSize="12"
                    fontWeight="600"
                    textAnchor={anchor}
                  >
                    {formatShortVnd(price)}
                  </text>
                );
              });
            })}
            {xTicks.map((tick) => {
              const timestamp = minTime + tick * timeRange;
              const x = paddingLeft + tick * plotWidth;
              return (
                <g key={tick}>
                  <line
                    x1={x}
                    x2={x}
                    y1={paddingTop}
                    y2={height - paddingBottom}
                    stroke="#e3e9f4"
                    strokeDasharray="3 8"
                  />
                  <text x={x} y={height - 16} fill="#62708a" fontSize="12" textAnchor="middle">
                    {allPoints[0] ? formatChartDate(new Date(timestamp).toISOString()) : ""}
                  </text>
                </g>
              );
            })}
            {drawableSeries.map((item) => {
              const domain = getExpandedPriceDomain(item.points);
              const path = item.points
                .map((point, index) => {
                  const x = xForPoint(point.timestamp);
                  const y = yForPoint(point.price, domain);
                  return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
                })
                .join(" ");
              return (
                <g key={item.label}>
                  <path
                    d={path}
                    fill="none"
                    stroke={item.color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="4"
                  />
                  {item.points.map((point, index) => {
                    const showPoint = index === 0 || index === item.points.length - 1 || item.points.length <= 8;
                    if (!showPoint) return null;
                    const y = yForPoint(point.price, domain);
                    return (
                      <circle
                        key={`${item.label}-${point.captured_at}-${index}`}
                        cx={xForPoint(point.timestamp)}
                        cy={y}
                        r="4.5"
                        fill="#ffffff"
                        stroke={item.color}
                        strokeWidth="3"
                      >
                        <title>{`${item.label} - ${formatChartDate(point.captured_at)}: ${formatFullVnd(point.price)}`}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            })}
            {activeX != null ? (
              <line
                x1={activeX}
                x2={activeX}
                y1={paddingTop}
                y2={height - paddingBottom}
                stroke="#17213a"
                strokeOpacity="0.35"
                strokeWidth="2"
              />
            ) : null}
            {activeRows.map((item) => {
              if (!item.activePoint) return null;
              return (
                <circle
                  key={`active-${item.label}`}
                  cx={xForPoint(item.activePoint.timestamp)}
                  cy={yForPoint(item.activePoint.price, item.domain)}
                  r="6"
                  fill="#ffffff"
                  stroke={item.color}
                  strokeWidth="3"
                />
              );
            })}
            </svg>
          </>
        ) : (
          <div className="flex h-[340px] items-center justify-center px-6 text-center text-sm leading-6 text-cars-gray">
            Not enough local price-history points are available for a two-line chart yet.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 text-sm text-cars-gray sm:grid-cols-3">
        {chartSeries.slice(0, 2).map((item, index) => (
          <div key={item.label}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
              {index === 0 ? "Left scale range" : "Right scale range"}
            </p>
            <p className="mt-1 text-cars-primary">
              {item.points.length ? `${formatShortVnd(item.domain.min)} - ${formatShortVnd(item.domain.max)}` : "Not available"}
            </p>
          </div>
        ))}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">Time window</p>
          <p className="mt-1 text-cars-primary">
            {allPoints.length
              ? `${formatChartDate(new Date(minTime).toISOString())} - ${formatChartDate(new Date(maxTime).toISOString())}`
              : "Not available"}
          </p>
        </div>
      </div>
    </article>
  );
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
    <div className="flex h-full flex-col rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(28,32,31,0.96),rgba(16,20,19,0.96))] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.32)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cars-accent">
            {title}
          </p>
          <p className="mt-2 min-h-[3rem] text-sm leading-6 text-white/60">
            Search the compare-ready catalog only. Select an exact supported variant before
            comparing.
          </p>
        </div>
        {selected ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center justify-center self-start rounded-full border border-white/10 px-4 text-xs font-semibold text-white/82 transition-colors hover:bg-white/6"
          >
            Change
          </button>
        ) : null}
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search compare-ready year, make, model, or trim"
        className="mt-4 h-12 w-full rounded-2xl border border-white/8 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-cars-accent/40 focus:ring-2 focus:ring-cars-accent/10"
      />

      {selected ? (
        <div className="mt-4 flex min-h-[6.5rem] flex-col rounded-[22px] border border-white/8 bg-white/6 px-4 py-4">
          <p className="min-h-[2.75rem] break-words text-sm font-semibold leading-6 text-white">
            {selected.label}
          </p>
          {selected.resolutionNote ? (
            <p className="mt-2 overflow-hidden text-xs leading-5 text-white/58 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
              {selected.resolutionNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {searchState.loading ? (
        <p className="mt-4 text-sm text-white/58">Searching vehicles...</p>
      ) : null}

      {searchState.error ? (
        <p className="mt-4 rounded-[18px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {searchState.error}
        </p>
      ) : null}

      {!selected && helperNote ? (
        <p
          className={`mt-4 rounded-[18px] border px-4 py-3 text-sm ${
            helperTone === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-100"
              : "border-white/8 bg-white/6 text-white/70"
          }`}
        >
          {helperNote}
        </p>
      ) : null}

      {!selected && searchState.options.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
            Supported variants
          </p>
          {searchState.options.map((item) => (
            <button
              key={item.variant_id}
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full flex-col rounded-[20px] border border-white/8 bg-white/4 px-4 py-3 text-left transition-colors hover:border-cars-accent/28 hover:bg-white/8"
            >
              <span className="break-words text-sm font-semibold text-white">
                {buildVariantLabel(item)}
              </span>
              <span className="mt-1 text-xs text-white/58">
                {formatBodyType(item.body_type)} / {formatFuelType(item.fuel_type)} / {formatTransmission(item.transmission)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ComparePageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openAssistant } = useAiAssistant();
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
  const [priceHistory, setPriceHistory] = useState<PriceHistoryState>(emptyPriceHistoryState);
  const [priceHoverTimestamp, setPriceHoverTimestamp] = useState<number | null>(null);
  const autoRunKeyRef = useRef("");
  const autoOpenedAssistantKeyRef = useRef("");
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
      setPriceHistory(emptyPriceHistoryState);
      setPriceHoverTimestamp(null);
      setLeftHelperNote(null);
      setRightHelperNote(null);
      autoRunKeyRef.current = "";
      autoOpenedAssistantKeyRef.current = "";

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
  }, [ready, searchParams, leftHasInitialInput, rightHasInitialInput]);

  function resetResults() {
    setResult(null);
    setPriceHistory(emptyPriceHistoryState);
    setPriceHoverTimestamp(null);
    autoRunKeyRef.current = "";
    autoOpenedAssistantKeyRef.current = "";
  }

  function showVehiclePicker() {
    setResult(null);
    setMessage("");
    setPriceHistory(emptyPriceHistoryState);
    setPriceHoverTimestamp(null);
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

  const runCompare = useCallback(
    async (activeLeft = leftSelection, activeRight = rightSelection) => {
      if (!activeLeft?.variantId || !activeRight?.variantId) {
        setTone("error");
        setMessage(
          "Compare only works with vehicles that already exist in the CarVista catalog. Search and choose two supported models to continue."
        );
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
        setMessage("");
      } catch (error) {
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Compare failed.");
      } finally {
        setComparing(false);
      }
    },
    [leftSelection, marketId, rightSelection]
  );

  const compareKey = useMemo(() => {
    if (!leftSelection?.variantId || !rightSelection?.variantId) return "";
    return `${marketId}:${leftSelection.variantId}:${rightSelection.variantId}`;
  }, [marketId, leftSelection?.variantId, rightSelection?.variantId]);

  useEffect(() => {
    if (!ready || loadingSelections || !compareKey) return;
    if (autoRunKeyRef.current === compareKey) return;

    autoRunKeyRef.current = compareKey;
    void runCompare();
  }, [ready, loadingSelections, compareKey, runCompare]);

  const leftItem = useMemo(() => findCompareItem(result, leftSelection), [result, leftSelection]);
  const rightItem = useMemo(() => findCompareItem(result, rightSelection), [result, rightSelection]);

  const vehicleLabels = useMemo(
    () => [
      leftSelection?.label || (leftItem ? buildCompareItemLabel(leftItem) : null),
      rightSelection?.label || (rightItem ? buildCompareItemLabel(rightItem) : null),
    ],
    [leftSelection?.label, rightSelection?.label, leftItem, rightItem]
  );
  const comparePairLabel = useMemo(() => buildComparePairLabel(vehicleLabels), [vehicleLabels]);
  const priceHistorySeries = useMemo<PriceHistorySeries[]>(
    () => [
      {
        label: vehicleLabels[0] || "Vehicle A",
        history: leftItem?.variant_id ? priceHistory.byVariantId[leftItem.variant_id] ?? [] : [],
        color: "#2f6ff2",
      },
      {
        label: vehicleLabels[1] || "Vehicle B",
        history: rightItem?.variant_id ? priceHistory.byVariantId[rightItem.variant_id] ?? [] : [],
        color: "#14b8a6",
      },
    ],
    [vehicleLabels, leftItem?.variant_id, rightItem?.variant_id, priceHistory.byVariantId]
  );

  const comparisonRows = useMemo(() => {
    if (!result || (!leftItem && !rightItem)) return [];
    const leftId = leftItem?.variant_id ? String(leftItem.variant_id) : "";
    const rightId = rightItem?.variant_id ? String(rightItem.variant_id) : "";
    const baseRows = [
      { key: "year", label: "Model year", left: leftItem?.year ?? null, right: rightItem?.year ?? null },
      { key: "body_type", label: "Body style", left: leftItem?.body_type ?? null, right: rightItem?.body_type ?? null },
      { key: "engine", label: "Engine", left: leftItem?.engine ?? null, right: rightItem?.engine ?? null },
      { key: "fuel_type", label: "Fuel / powertrain", left: leftItem?.fuel_type ?? null, right: rightItem?.fuel_type ?? null },
      { key: "transmission", label: "Transmission", left: leftItem?.transmission ?? null, right: rightItem?.transmission ?? null },
      { key: "drivetrain", label: "Drivetrain", left: leftItem?.drivetrain ?? null, right: rightItem?.drivetrain ?? null },
      { key: "seats", label: "Seats", left: leftItem?.seats ?? null, right: rightItem?.seats ?? null },
      { key: "doors", label: "Doors", left: leftItem?.doors ?? null, right: rightItem?.doors ?? null },
      { key: "msrp_base", label: "Original MSRP", left: leftItem?.msrp_base ?? null, right: rightItem?.msrp_base ?? null },
      { key: "latest_price", label: "Market price", left: leftItem?.latest_price ?? null, right: rightItem?.latest_price ?? null },
      { key: "avg_rating", label: "Owner rating", left: leftItem?.avg_rating ?? null, right: rightItem?.avg_rating ?? null },
      { key: "review_count", label: "Review count", left: leftItem?.review_count ?? null, right: rightItem?.review_count ?? null },
    ];
    const baseKeys = new Set(baseRows.map((row) => row.key));
    const dynamicRows = Object.entries(result.comparison_table ?? {})
      .filter(([key]) => !baseKeys.has(key))
      .map(([key, row]) => ({
        key,
        label: toTitleLabel(key),
        left: leftId ? row[leftId] ?? null : null,
        right: rightId ? row[rightId] ?? null : null,
      }));

    return [...baseRows, ...dynamicRows].filter((row) => hasMeaningfulValue(row.left) || hasMeaningfulValue(row.right));
  }, [result, leftItem, rightItem]);

  useEffect(() => {
    const ids = [leftSelection?.variantId, rightSelection?.variantId].filter((id): id is number =>
      Number.isInteger(id)
    );
    if (!result || ids.length < 2) {
      setPriceHistory(emptyPriceHistoryState);
      setPriceHoverTimestamp(null);
      return;
    }

    let cancelled = false;
    setPriceHoverTimestamp(null);
    setPriceHistory((prev) => ({ ...prev, loading: true, error: "" }));

    async function loadPriceHistory() {
      try {
        const entries = await Promise.all(
          ids.map(async (variantId) => {
            const response = await catalogApi.variantPriceHistory(variantId, marketId, 36);
            const history = response.items
              .map(parsePriceHistoryPoint)
              .filter((point): point is PriceHistoryPoint => Boolean(point));
            return [variantId, history] as const;
          })
        );

        if (cancelled) return;
        setPriceHistory({
          loading: false,
          error: "",
          byVariantId: Object.fromEntries(entries),
        });
      } catch (error) {
        if (cancelled) return;
        setPriceHistory({
          loading: false,
          error: error instanceof Error ? error.message : "Could not load local price history.",
          byVariantId: {},
        });
      }
    }

    void loadPriceHistory();

    return () => {
      cancelled = true;
    };
  }, [result, leftSelection?.variantId, rightSelection?.variantId, marketId]);

  useEffect(() => {
    if (!result || !leftSelection?.variantId || !rightSelection?.variantId) return;
    const key = `${marketId}:${leftSelection.variantId}:${rightSelection.variantId}`;
    if (autoOpenedAssistantKeyRef.current === key) return;

    const labels = vehicleLabels.filter((label): label is string => Boolean(label));
    if (labels.length < 2) return;

    autoOpenedAssistantKeyRef.current = key;
    openAssistant({
      marketId,
      variantId: leftSelection.variantId,
      variantLabel: labels[0],
      compareVariantIds: [leftSelection.variantId, rightSelection.variantId],
      compareVariantLabels: labels,
    });
  }, [
    result,
    leftSelection?.variantId,
    rightSelection?.variantId,
    marketId,
    vehicleLabels,
    openAssistant,
  ]);

  if (!ready) return null;

  return (
    <>
      <Header />
      <main className="container-cars py-6 sm:py-8">
        {message ? (
          <div className="mb-6">
            <StatusBanner tone={tone}>{message}</StatusBanner>
          </div>
        ) : null}

        {!result ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch lg:gap-5">
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

            <div className="flex items-center justify-center lg:pt-20">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cars-primary text-white shadow-[0_18px_40px_rgba(15,45,98,0.18)] sm:h-12 sm:w-12">
                <ArrowLeftRight className="h-5 w-5 rotate-90 lg:rotate-0" />
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
        ) : null}

        {loadingSelections || comparing ? (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {["compare-skeleton-a", "compare-skeleton-b", "compare-skeleton-c"].map((key) => (
              <div
                key={key}
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
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                  Side-by-side comparison
                </p>
                <h1 className="mt-2 text-2xl font-apercu-bold leading-tight text-cars-primary sm:text-3xl">
                  {comparePairLabel}
                </h1>
              </div>
              <button
                type="button"
                onClick={showVehiclePicker}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-cars-primary/15 bg-white px-5 text-sm font-semibold text-cars-primary shadow-[0_12px_28px_rgba(15,45,98,0.06)] transition hover:bg-cars-off-white sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                Change vehicles
              </button>
            </div>

            <section className="grid gap-5 xl:grid-cols-2">
              {[
                { selection: leftSelection, item: leftItem },
                { selection: rightSelection, item: rightItem },
              ].map(({ selection, item }, index) => {
                const href = getVehicleHref(selection);
                const image = getSelectionImage(selection);
                const status = getListingStatus(selection);
                const cardKey = selection?.listingId ?? selection?.variantId ?? item?.variant_id ?? index;
                const card = (
                  <article
                    key={cardKey}
                    className={`flex h-full flex-col overflow-hidden rounded-[30px] border border-cars-gray-light/70 bg-white shadow-[0_20px_44px_rgba(15,45,98,0.08)] ${
                      href ? "transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(15,45,98,0.12)]" : ""
                    }`}
                  >
                    <div className="relative h-[240px] bg-cars-off-white sm:h-[300px] lg:h-[340px]">
                      {image ? (
                        <img
                          src={image}
                          alt={selection?.label || "Compared vehicle"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-medium text-cars-gray">
                          Photo unavailable
                        </div>
                      )}
                      {status ? (
                        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cars-primary">
                          {status}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                            Vehicle {index === 0 ? "A" : "B"}
                          </p>
                          <h3 className="mt-2 min-h-[4rem] break-words text-2xl font-apercu-bold leading-tight text-cars-primary">
                            {selection?.label || (item ? buildCompareItemLabel(item) : "Vehicle")}
                          </h3>
                        </div>
                        <div className="sm:min-w-[180px] sm:text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                            {selection?.listing ? "Asking price" : "Market price"}
                          </p>
                          <p className="mt-2 min-h-[3.5rem] break-words text-xl font-apercu-bold leading-tight text-cars-primary">
                            {selection?.listing
                              ? formatListingPrice(selection.listing.listing.asking_price)
                              : formatListingPrice(item?.latest_price ?? item?.msrp_base)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );

                return href ? (
                  <Link
                    key={cardKey}
                    href={href}
                    className="block h-full rounded-[30px] focus:outline-none focus:ring-2 focus:ring-cars-accent/40"
                  >
                    {card}
                  </Link>
                ) : (
                  <div key={cardKey} className="h-full">
                    {card}
                  </div>
                );
              })}
            </section>

            <section className="section-shell p-4 sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                    Side by side comparison
                  </p>
                  <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                    What actually changes?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-cars-gray sm:hidden">
                    Swipe inside the compare table to see every field on smaller screens.
                  </p>
                </div>
              </div>

              <div className="-mx-2 mt-5 overflow-x-auto px-2 pb-2 overscroll-x-contain">
                <table className="min-w-[720px] w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 min-w-[180px] bg-white px-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        Category
                      </th>
                      <th className="min-w-[240px] px-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        {vehicleLabels[0] || "Vehicle A"}
                      </th>
                      <th className="min-w-[240px] px-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        {vehicleLabels[1] || "Vehicle B"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => {
                      const leftCell = formatComparisonCell(row.key, row.left);
                      const rightCell = formatComparisonCell(row.key, row.right);
                      return (
                        <tr key={row.key}>
                          <td className="sticky left-0 rounded-l-[18px] bg-cars-off-white px-4 py-3 text-sm font-semibold text-cars-primary">
                            {row.label}
                          </td>
                          <td
                            title={leftCell.title}
                            className="max-w-[280px] break-words bg-white px-4 py-3 align-top text-sm leading-6 text-cars-gray"
                          >
                            {leftCell.text}
                          </td>
                          <td
                            title={rightCell.title}
                            className="max-w-[280px] break-words rounded-r-[18px] bg-white px-4 py-3 align-top text-sm leading-6 text-cars-gray"
                          >
                            {rightCell.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="section-shell p-4 sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                    Market movement
                  </p>
                  <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                    Price history comparison
                  </h2>
                </div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cars-off-white text-cars-accent">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>

              {priceHistory.error ? (
                <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {priceHistory.error}
                </div>
              ) : null}

              {priceHistory.loading ? (
                <div className="mt-5 h-[420px] animate-pulse rounded-[26px] bg-cars-off-white" />
              ) : (
                <div className="mt-5">
                  <CombinedPriceHistoryChart
                    series={priceHistorySeries}
                    hoverTimestamp={priceHoverTimestamp}
                    onHoverTimestampChange={setPriceHoverTimestamp}
                  />
                </div>
              )}
            </section>

          </div>
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
