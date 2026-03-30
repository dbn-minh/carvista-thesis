import { buildConfidence } from "./contracts.js";
import { predictPrice } from "./predict_price.service.js";
import {
  evaluateVariantFit,
  recommendCars,
} from "./recommendation.service.js";
import { linkRecommendationTargets } from "./recommendation_linking.service.js";
import { loadVariantContext } from "./source_retrieval.service.js";
import { calculateTco } from "./tco.service.js";
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

function buildFitSection(fitAssessment, recommendationPaths = []) {
  if (!fitAssessment) return null;

  return {
    key: "fit_for_you",
    title: "Fit for your needs",
    assistant_message:
      fitAssessment.reasons.length > 0
        ? `${fitAssessment.name} looks like a ${fitAssessment.fit_label.toLowerCase()} for the profile currently on file because it ${fitAssessment.reasons.join(", ")}.`
        : `${fitAssessment.name} looks like a ${fitAssessment.fit_label.toLowerCase()} based on the profile currently on file.`,
    highlights: [
      `Current fit score: ${fitAssessment.score}`,
      fitAssessment.profile_summary ? `Profile used: ${fitAssessment.profile_summary}` : null,
    ].filter(Boolean),
    insight_cards: [
      {
        title: "Fit score",
        value: fitAssessment.score,
        description: fitAssessment.fit_label,
      },
      {
        title: "Why it fits",
        value: fitAssessment.reasons[0] || "Profile alignment",
        description:
          fitAssessment.reasons.slice(1).join(", ") ||
          "The current buyer profile aligns reasonably well with this vehicle.",
      },
    ],
    confidence: buildConfidence(0.72, [
      "Fit scoring is computed from the current saved buyer preference profile.",
    ]),
    caveats: [],
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
}) {
  const variantContext = await loadVariantContext(ctx, {
    variant_id: variantId,
    market_id: marketId,
  });
  if (!variantContext) {
    throw { status: 404, safe: true, message: "Variant not found." };
  }

  const actionPaths = await buildVariantActionPaths(ctx, variantContext);
  const [tcoResult, predictionResult, fitAssessment, recommendations] = await Promise.all([
    calculateTco(ctx, {
      variant_id: variantId,
      market_id: marketId,
      ownership_years: ownershipYears,
      km_per_year: kmPerYear ?? undefined,
    }).catch(() => null),
    predictPrice(ctx, {
      variant_id: variantId,
      market_id: marketId,
      horizon_months: 6,
    }).catch(() => null),
    hasProfile(profile)
      ? evaluateVariantFit(ctx, { variant_id: variantId, profile, market_id: marketId }).catch(() => null)
      : Promise.resolve(null),
    hasProfile(profile)
      ? recommendCars(ctx, { profile, market_id: marketId }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const recommendationPaths = (recommendations?.ranked_vehicles ?? [])
    .filter((vehicle) => vehicle.variant_id !== variantId)
    .map((vehicle) => vehicle.links)
    .filter(Boolean);

  return {
    subject: {
      kind: "variant",
      variant_id: variantId,
      market_id: marketId,
      label: variantContext.variant.label,
      profile_snapshot: summarizePreferenceProfile(profile) || null,
    },
    sections: [
      buildNarrativeSection("ownership_cost", "Ownership Cost Snapshot", tcoResult, actionPaths),
      buildNarrativeSection("price_outlook", "AI Price Outlook", predictionResult, actionPaths),
      buildFitSection(fitAssessment, recommendationPaths),
    ].filter(Boolean),
    recommendation_paths: recommendationPaths,
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
}) {
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
  });
  const baseActionPaths = intelligence.sections.flatMap((section) => section.action_paths ?? []).slice(0, 3);
  const predictionResult = await predictPrice(ctx, {
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
