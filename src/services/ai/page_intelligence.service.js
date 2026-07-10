import { buildConfidence } from "./contracts.js";
import { linkRecommendationTargets } from "./recommendation_linking.service.js";
import { loadVariantContext } from "./source_retrieval.service.js";
import {
  calculateTcoWithCache,
  predictPriceWithCache,
} from "../cache/cached-ai.service.js";
import { evaluateVariantFit } from "./recommendation.service.js";
import { summarizePreferenceProfile } from "./user_preference_profile.service.js";

function hasProfile(profile) {
  return profile && Object.keys(profile).length > 0;
}

function buildActionPath({
  type,
  label,
  url,
  note = null,
  match_confidence = null,
  related_listing_ids = [],
}) {
  return {
    type,
    label,
    url,
    note,
    match_confidence,
    related_listing_ids,
  };
}

function buildNarrativeSection(key, title, narrative, action_paths = [], extra = {}) {
  if (!narrative) return null;
  return {
    key,
    title,
    assistant_message: narrative.assistant_message,
    highlights: narrative.highlights ?? [],
    insight_cards: narrative.insight_cards ?? [],
    confidence: narrative.confidence ?? null,
    caveats: narrative.caveats ?? [],
    sources: narrative.sources ?? [],
    freshness_note: narrative.freshness_note ?? null,
    action_paths,
    ...extra,
  };
}

function compactFitSignal(text, kind = "good") {
  const normalized = String(text || "").trim().replace(/[.]+$/g, "");
  if (!normalized) return null;

  const rules =
    kind === "good"
      ? [
          [/family-focused use case/i, "Family-friendly layout"],
          [/everyday commuting easier|efficient powertrain/i, "Efficient daily driving"],
          [/performance headroom|highway and out-of-town/i, "Confident highway pace"],
          [/engaging fun-driving profile|engaging/i, "More engaging drive"],
          [/seating requirement/i, "Good seating fit"],
          [/long-term ownership/i, "Easier long-term ownership"],
          [/brand you already feel good about/i, "Brand preference match"],
          [/supercar and performance-first/i, "Fits performance brief"],
          [/owner sentiment|review pool/i, "Positive owner feedback"],
          [/market activity|volatile asking prices/i, "Steadier market support"],
        ]
      : [
          [/7-seat flexibility/i, "Short on seven seats"],
          [/cargo space/i, "Tight cargo room"],
          [/bulky|tight parking/i, "Bulky for parking"],
          [/ground clearance/i, "Limited ground clearance"],
          [/awd|traction need/i, "AWD need unmet"],
          [/not the most efficient|running cost mismatch/i, "Higher running costs"],
          [/cost more to maintain|ownership complexity/i, "Higher upkeep likely"],
          [/brand you explicitly want to avoid|brand/i, "Brand mismatch"],
          [/does not include|missing must-have/i, "Missing must-have feature"],
          [/large footprint/i, "Large urban footprint"],
        ];

  for (const [pattern, label] of rules) {
    if (pattern.test(normalized)) return label;
  }

  if (kind === "good") {
    if (/comfort|refinement/i.test(normalized)) return "Comfortable day to day";
    if (/resale|market/i.test(normalized)) return "Stronger resale outlook";
    if (/performance|sport|fun/i.test(normalized)) return "Stronger driving feel";
    if (/seat/i.test(normalized)) return "Better passenger fit";
  } else {
    if (/comfort|refinement/i.test(normalized)) return "Comfort could feel average";
    if (/resale|market/i.test(normalized)) return "Weaker market outlook";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function compactFitSignals(items = [], kind = "good", limit = 3) {
  const seen = new Set();
  return items
    .map((item) => compactFitSignal(item, kind))
    .filter(Boolean)
    .filter((item) => {
      const key = String(item).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function buildFitSection(fitAssessment, recommendationPaths = []) {
  if (!fitAssessment) return null;

  const goodPoints = compactFitSignals(fitAssessment.reasons, "good", 3);
  const watchOuts = compactFitSignals(fitAssessment.caveats, "bad", 2);

  return {
    key: "fit_for_you",
    title: "Fit for your needs",
    assistant_message: `${fitAssessment.name} looks like a ${fitAssessment.fit_label.toLowerCase()} for the profile currently on file.`,
    highlights: goodPoints,
    insight_cards: [
      {
        title: "Fit score",
        value: fitAssessment.score,
        description: fitAssessment.fit_label,
      },
    ],
    confidence: buildConfidence(0.72, [
      "Fit scoring is computed from the current saved buyer preference profile.",
    ]),
    caveats: watchOuts,
    sources: [],
    freshness_note: null,
    action_paths: recommendationPaths.slice(0, 2).map((path) =>
      buildActionPath({
        type: "vehicle_detail",
        label: `Explore ${path.display_name}`,
        url: path.detail_page_url || path.fallback_search_url,
        note: path.match_label,
        match_confidence: path.match_confidence,
        related_listing_ids: path.related_listing_ids,
      })
    ),
  };
}

async function buildVariantActionPaths(ctx, variantContext) {
  const links = await linkRecommendationTargets(ctx, [
    {
      variant_id: variantContext.variant.variant_id,
      name: variantContext.variant.label,
      make_name: variantContext.variant.make_name,
      model_name: variantContext.variant.model_name,
      trim_name: variantContext.variant.trim_name,
      model_year: variantContext.variant.model_year,
    },
  ]);

  const primary = links[0] ?? null;
  if (!primary) return [];

  return [
    primary.detail_page_url
      ? buildActionPath({
          type: "vehicle_detail",
          label: "Open vehicle detail",
          url: primary.detail_page_url,
          note: primary.match_label,
          match_confidence: primary.match_confidence,
        })
      : null,
    primary.related_listings_url
      ? buildActionPath({
          type: "related_listings",
          label:
            primary.related_listings_count > 0
              ? `Browse ${primary.related_listings_count} matching listing(s)`
              : "Browse related listings",
          url: primary.related_listings_url,
          note: primary.match_label,
          match_confidence: primary.match_confidence,
          related_listing_ids: primary.related_listing_ids,
        })
      : null,
    primary.fallback_search_url
      ? buildActionPath({
          type: "fallback_search",
          label: "Search similar vehicles",
          url: primary.fallback_search_url,
          note: "Fallback search path",
          match_confidence: primary.match_confidence,
        })
      : null,
  ].filter(Boolean);
}

export async function buildVariantPageIntelligence(ctx, {
  variantId,
  marketId = 1,
  ownershipYears = 5,
  kmPerYear = null,
  profile = {},
  skipSections = [],
}) {
  const hiddenSections = new Set(
    (skipSections ?? []).map((item) => String(item || "").trim()).filter(Boolean),
  );
  const variantContext = await loadVariantContext(ctx, {
    variant_id: variantId,
    market_id: marketId,
  });
  if (!variantContext) {
    throw { status: 404, safe: true, message: "Variant not found." };
  }

  const actionPaths = await buildVariantActionPaths(ctx, variantContext);
  const shouldIncludeFit = hasProfile(profile) && !hiddenSections.has("fit_for_you");
  const shouldIncludeOwnership = !hiddenSections.has("ownership_cost");
  const shouldIncludePriceOutlook = !hiddenSections.has("price_outlook");

  const [fitAssessment, tcoResult, predictionResult] = await Promise.all([
    shouldIncludeFit
      ? evaluateVariantFit(ctx, {
          variant_id: variantId,
          market_id: marketId,
          profile,
        }).catch(() => null)
      : Promise.resolve(null),
    shouldIncludeOwnership
      ? calculateTcoWithCache(ctx, {
          variant_id: variantId,
          market_id: marketId,
          ownership_years: ownershipYears,
          km_per_year: kmPerYear ?? undefined,
        }).catch(() => null)
      : Promise.resolve(null),
    shouldIncludePriceOutlook
      ? predictPriceWithCache(ctx, {
          variant_id: variantId,
          market_id: marketId,
          horizon_months: 6,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    subject: {
      kind: "variant",
      variant_id: variantId,
      market_id: marketId,
      label: variantContext.variant.label,
      profile_snapshot: summarizePreferenceProfile(profile) || null,
    },
    sections: [
      buildFitSection(fitAssessment, actionPaths),
      buildNarrativeSection("ownership_cost", "Ownership Cost Snapshot", tcoResult, actionPaths),
      buildNarrativeSection("price_outlook", "AI Price Outlook", predictionResult, actionPaths),
    ].filter(Boolean),
    recommendation_paths: [],
  };
}

function buildListingValueSection(listing, predictionResult, actionPaths) {
  if (!predictionResult) return null;

  const fairValue = Number(predictionResult.fair_value_estimate);
  const askingPrice = Number(listing.asking_price);
  let position = "Pricing looks roughly in line with the current fair-value estimate.";
  if (Number.isFinite(fairValue) && Number.isFinite(askingPrice)) {
    if (askingPrice > fairValue * 1.08) position = "This listing is priced above the current fair-value midpoint.";
    else if (askingPrice < fairValue * 0.92) position = "This listing looks attractively priced versus the current fair-value midpoint.";
  }

  return {
    key: "listing_value_position",
    title: "Listing Price Position",
    assistant_message: position,
    highlights: [
      `Asking price: ${listing.asking_price}`,
      predictionResult.fair_value_estimate != null ? `Fair-value midpoint: ${predictionResult.fair_value_estimate}` : null,
    ].filter(Boolean),
    insight_cards: [
      {
        title: "Ask vs fair value",
        value: null,
        description: position,
      },
    ],
    confidence: predictionResult.confidence ?? null,
    caveats: predictionResult.caveats ?? [],
    sources: predictionResult.sources ?? [],
    freshness_note: predictionResult.freshness_note ?? null,
    action_paths: actionPaths,
  };
}

export async function buildListingPageIntelligence(ctx, {
  listingId,
  marketId = 1,
  ownershipYears = 5,
  kmPerYear = null,
  profile = {},
  skipSections = [],
}) {
  const hiddenSections = new Set(
    (skipSections ?? []).map((item) => String(item || "").trim()).filter(Boolean),
  );
  const listing = await ctx.models.Listings.findByPk(listingId);
  if (!listing) {
    throw { status: 404, safe: true, message: "Listing not found." };
  }

  const intelligence = await buildVariantPageIntelligence(ctx, {
    variantId: listing.variant_id,
    marketId,
    ownershipYears,
    kmPerYear: kmPerYear ?? undefined,
    profile,
    skipSections,
  });
  const baseActionPaths = intelligence.sections.flatMap((section) => section.action_paths ?? []).slice(0, 3);
  const predictionResult = hiddenSections.has("listing_value_position")
    ? null
    : await predictPriceWithCache(ctx, {
        variant_id: listing.variant_id,
        market_id: marketId,
        horizon_months: 6,
      }).catch(() => null);

  return {
    subject: {
      kind: "listing",
      listing_id: listingId,
      variant_id: listing.variant_id,
      market_id: marketId,
      label: intelligence.subject.label,
      profile_snapshot: intelligence.subject.profile_snapshot,
    },
    sections: [
      buildListingValueSection(listing, predictionResult, baseActionPaths) ?? null,
      ...intelligence.sections,
    ].filter(Boolean),
    recommendation_paths: intelligence.recommendation_paths,
  };
}
