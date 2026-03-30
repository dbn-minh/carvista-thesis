import { clamp } from "./_helpers.js";
import { buildConfidence } from "./contracts.js";
import { recommendationResultSchema } from "./dtos.js";
import { linkRecommendationTargets } from "./recommendation_linking.service.js";
import { buildInternalSource, loadVariantContext } from "./source_retrieval.service.js";

function toNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedPrice(item) {
  return toNumberOrNull(item.latest_price ?? item.avg_asking_price ?? item.msrp_base);
}

function isPremiumLeaning(item) {
  const price = normalizedPrice(item);
  return (price != null && price >= 1_500_000_000) || ["bmw", "mercedes-benz", "mercedes", "audi", "lexus"].includes(String(item.make_name || "").toLowerCase());
}

export function scoreRecommendationCandidate(item, profile) {
  let score = 0;
  const price = normalizedPrice(item);
  const avgRating = toNumberOrNull(item.avg_rating);
  const reviewCount = toNumberOrNull(item.review_count) ?? 0;
  const activeListingCount = toNumberOrNull(item.active_listing_count) ?? 0;
  const priceSpreadPct = toNumberOrNull(item.price_spread_pct);
  const scarcityScore = toNumberOrNull(item.scarcity_score);
  const currentYear = new Date().getFullYear();

  if (profile?.budget_max && Number.isFinite(price)) {
    if (price <= profile.budget_max) {
      score += 32;
      score += clamp(1 - Math.abs(profile.budget_max - price) / profile.budget_max, 0, 1) * 8;
    } else {
      score -= clamp((price - profile.budget_max) / profile.budget_max, 0, 1) * 18;
    }
  }

  if (profile?.preferred_body_type && profile.preferred_body_type !== "any" && item.body_type === profile.preferred_body_type) score += 18;
  if (profile?.preferred_fuel_type && profile.preferred_fuel_type !== "any" && item.fuel_type === profile.preferred_fuel_type) score += 14;
  if (profile?.environment === "city" && (["sedan", "hatchback", "cuv"].includes(item.body_type) || ["hybrid", "ev"].includes(item.fuel_type))) score += 10;
  if (profile?.environment === "rural" && ["suv", "pickup", "mpv"].includes(item.body_type)) score += 10;
  if (profile?.long_trip_habit === "frequent" && ["gasoline", "diesel", "hybrid"].includes(item.fuel_type)) score += 8;
  if ((profile?.passenger_count ?? 0) >= 6 && Number(item.seats) >= 6) score += 10;
  if ((profile?.passenger_count ?? 0) <= 4 && Number(item.seats) <= 5) score += 4;
  if (profile?.maintenance_sensitivity === "high" && ["hybrid", "gasoline"].includes(item.fuel_type)) score += 3;
  if (profile?.maintenance_sensitivity === "high" && avgRating != null) score += avgRating >= 4.1 ? 5 : avgRating < 3.4 ? -4 : 0;
  if (profile?.personality === "sporty" && ["sedan", "coupe"].includes(item.body_type)) score += 5;
  if (profile?.personality === "family" && ["suv", "mpv"].includes(item.body_type)) score += 5;
  if (profile?.personality === "premium" && isPremiumLeaning(item)) score += 5;
  if (profile?.new_vs_used === "new" && Number(item.model_year) >= currentYear - 1) score += 4;
  if (profile?.new_vs_used === "used" && Number(item.model_year) <= currentYear - 2) score += 2;
  if (avgRating != null) score += clamp((avgRating - 3.1) / 1.7, 0, 1) * 10;
  if (reviewCount >= 6) score += 3;
  if (activeListingCount > 0) score += clamp(activeListingCount / 6, 0, 1) * 6;
  if (priceSpreadPct != null) score += clamp(1 - priceSpreadPct * 4, 0, 1) * 4;
  if (scarcityScore != null) score += clamp(scarcityScore, 0, 1) * 3;

  return Math.round(score * 10) / 10;
}

export function buildRecommendationReasons(item, profile) {
  const reasons = [];
  const avgRating = toNumberOrNull(item.avg_rating);
  const reviewCount = toNumberOrNull(item.review_count) ?? 0;
  const activeListingCount = toNumberOrNull(item.active_listing_count) ?? 0;
  const priceSpreadPct = toNumberOrNull(item.price_spread_pct);
  const price = normalizedPrice(item);

  if (profile?.preferred_body_type && profile.preferred_body_type === item.body_type) reasons.push(`matches your preferred ${item.body_type} body style`);
  if (profile?.preferred_fuel_type && profile.preferred_fuel_type === item.fuel_type) reasons.push(`matches your preferred ${item.fuel_type} powertrain`);
  if (profile?.environment === "city" && ["sedan", "hatchback", "cuv"].includes(item.body_type)) reasons.push("is easier to live with in denser city driving");
  if (profile?.environment === "rural" && ["suv", "pickup", "mpv"].includes(item.body_type)) reasons.push("makes more sense for mixed roads and rougher daily use");
  if (profile?.long_trip_habit === "frequent" && ["hybrid", "diesel", "gasoline"].includes(item.fuel_type)) reasons.push("is easier to recommend for frequent long-distance use");
  if ((profile?.passenger_count ?? 0) >= 6 && Number(item.seats) >= 6) reasons.push("covers your usual passenger load without feeling tight");
  if (profile?.personality === "sporty" && ["sedan", "coupe"].includes(item.body_type)) reasons.push("leans toward a more engaging driving feel");
  if (profile?.personality === "family" && ["suv", "mpv"].includes(item.body_type)) reasons.push("leans toward family-friendly space and easier everyday practicality");
  if (profile?.personality === "premium" && isPremiumLeaning(item)) reasons.push("delivers a more premium feel than mainstream alternatives");
  if (profile?.budget_max && price != null && price <= profile.budget_max) reasons.push("fits your budget without stretching into the next price tier");
  if (avgRating != null && avgRating >= 4.1 && reviewCount >= 4) reasons.push("shows stronger owner sentiment in the current review pool");
  if (activeListingCount >= 2 && priceSpreadPct != null && priceSpreadPct <= 0.12) reasons.push("has healthier market activity without unusually volatile asking prices");
  if ((toNumberOrNull(item.scarcity_score) ?? 0) >= 0.55) reasons.push("has slightly tighter supply, which can help value retention if demand stays steady");
  return reasons.slice(0, 5);
}

function buildRecommendationCaveats(item, profile) {
  const caveats = [];
  const price = normalizedPrice(item);
  const reviewCount = toNumberOrNull(item.review_count) ?? 0;
  const activeListingCount = toNumberOrNull(item.active_listing_count) ?? 0;
  const priceSpreadPct = toNumberOrNull(item.price_spread_pct);

  if (profile?.budget_max && price != null && price > profile.budget_max) {
    caveats.push("sits above the target budget, so the fit depends on how much stretch you are comfortable with");
  }
  if (reviewCount > 0 && reviewCount < 4) {
    caveats.push("still has a thin local owner-feedback sample, so reliability confidence is not as strong as it could be");
  }
  if (activeListingCount === 0) {
    caveats.push("current live-listing coverage is still thin, so market-liquidity confidence is lower");
  }
  if (priceSpreadPct != null && priceSpreadPct >= 0.18) {
    caveats.push("current asking prices are a bit scattered, which makes the market picture less stable");
  }
  if (profile?.maintenance_sensitivity === "high" && ["diesel", "phev"].includes(item.fuel_type)) {
    caveats.push("may need a closer ownership-cost check if you want the simplest long-term maintenance path");
  }
  return caveats.slice(0, 3);
}

function buildMarketSummary(item) {
  const activeListingCount = toNumberOrNull(item.active_listing_count);
  const avgAsking = toNumberOrNull(item.avg_asking_price);
  const priceSpreadPct = toNumberOrNull(item.price_spread_pct);
  if (activeListingCount == null && avgAsking == null && priceSpreadPct == null) return null;

  return [
    activeListingCount != null ? `${activeListingCount} live-style market signal(s)` : null,
    avgAsking != null ? `average asking near ${Math.round(avgAsking).toLocaleString("en-US")}` : null,
    priceSpreadPct != null ? `price spread about ${(priceSpreadPct * 100).toFixed(1)}%` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

async function loadRecommendationEnrichment(ctx, variantIds = [], market_id = 1) {
  const reviewMap = new Map();
  const marketSignalMap = new Map();

  if (!variantIds.length) return { reviewMap, marketSignalMap };

  try {
    const [reviewRows] = await ctx.sequelize.query(
      `
        SELECT variant_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
        FROM car_reviews
        WHERE variant_id IN (:ids)
        GROUP BY variant_id
      `,
      { replacements: { ids: variantIds } }
    );
    for (const row of reviewRows) {
      reviewMap.set(Number(row.variant_id), {
        avg_rating: toNumberOrNull(row.avg_rating),
        review_count: Number(row.review_count || 0),
      });
    }
  } catch {
    // Optional enrichment only. Recommendation should remain available without review aggregation.
  }

  try {
    const [signalRows] = await ctx.sequelize.query(
      `
        SELECT vms.variant_id, vms.active_listing_count, vms.avg_asking_price, vms.price_spread_pct, vms.scarcity_score, vms.data_confidence
        FROM vehicle_market_signals vms
        JOIN (
          SELECT variant_id, MAX(snapshot_date) AS latest_snapshot
          FROM vehicle_market_signals
          WHERE market_id = :market_id AND variant_id IN (:ids)
          GROUP BY variant_id
        ) latest_signal
          ON latest_signal.variant_id = vms.variant_id
         AND latest_signal.latest_snapshot = vms.snapshot_date
        WHERE vms.market_id = :market_id
      `,
      { replacements: { market_id, ids: variantIds } }
    );
    for (const row of signalRows) {
      marketSignalMap.set(Number(row.variant_id), {
        active_listing_count: Number(row.active_listing_count || 0),
        avg_asking_price: toNumberOrNull(row.avg_asking_price),
        price_spread_pct: toNumberOrNull(row.price_spread_pct),
        scarcity_score: toNumberOrNull(row.scarcity_score),
        data_confidence: toNumberOrNull(row.data_confidence),
      });
    }
  } catch {
    // Optional enrichment only. Recommendation should remain available without persisted market snapshots.
  }

  return { reviewMap, marketSignalMap };
}

function buildProfileSummary(profile = {}) {
  return [
    profile?.budget_max ? `budget around ${profile.budget_max}` : null,
    profile?.environment ? `${profile.environment} driving` : null,
    profile?.long_trip_habit ? `${profile.long_trip_habit} longer trips` : null,
    profile?.preferred_body_type && profile.preferred_body_type !== "any" ? `${profile.preferred_body_type} preference` : null,
    profile?.preferred_fuel_type && profile.preferred_fuel_type !== "any" ? `${profile.preferred_fuel_type} preference` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function fitLabel(score) {
  if (score >= 68) return "Strong fit";
  if (score >= 48) return "Good fit";
  if (score >= 28) return "Partial fit";
  return "Weak fit";
}

function candidateFromVariantContext(context) {
  return {
    variant_id: context.variant.variant_id,
    model_year: context.variant.model_year,
    trim_name: context.variant.trim_name,
    body_type: context.variant.body_type,
    fuel_type: context.variant.fuel_type,
    engine: context.variant.engine,
    transmission: context.variant.transmission,
    drivetrain: context.variant.drivetrain,
    seats: context.variant.seats,
    msrp_base: context.variant.msrp_base,
    model_name: context.variant.model_name,
    make_name: context.variant.make_name,
    latest_price: context.variant.latest_price,
  };
}

export async function evaluateVariantFit(ctx, { variant_id, profile, market_id = 1 }) {
  const context = await loadVariantContext(ctx, { variant_id, market_id });
  if (!context) return null;

  const candidate = {
    ...candidateFromVariantContext(context),
    avg_rating: toNumberOrNull(context.review_summary?.avg_rating),
    review_count: Number(context.review_summary?.review_count || 0),
  };
  const score = scoreRecommendationCandidate(candidate, profile);
  const reasons = buildRecommendationReasons(candidate, profile);
  const caveats = buildRecommendationCaveats(candidate, profile);
  const links = await linkRecommendationTargets(ctx, [
    {
      variant_id: candidate.variant_id,
      name: context.variant.label,
      make_name: candidate.make_name,
      model_name: candidate.model_name,
      trim_name: candidate.trim_name,
      model_year: candidate.model_year,
      body_type: candidate.body_type,
      fuel_type: candidate.fuel_type,
      latest_price: candidate.latest_price,
    },
  ]);

  return {
    variant_id: candidate.variant_id,
    name: context.variant.label,
    score,
    fit_label: fitLabel(score),
    reasons,
    caveats,
    profile_summary: buildProfileSummary(profile) || "partial buyer profile",
    links: links[0] ?? null,
  };
}

export async function recommendCars(ctx, { profile, market_id = 1 }) {
  const sql = `
    SELECT
      cv.variant_id,
      cv.model_year,
      cv.trim_name,
      cv.body_type,
      cv.fuel_type,
      cv.engine,
      cv.transmission,
      cv.drivetrain,
      cv.seats,
      cv.msrp_base,
      cm.name AS model_name,
      mk.name AS make_name,
      latest.price AS latest_price
    FROM car_variants cv
    JOIN car_models cm ON cm.model_id = cv.model_id
    JOIN car_makes mk ON mk.make_id = cm.make_id
    LEFT JOIN (
      SELECT x.variant_id, x.price
      FROM variant_price_history x
      JOIN (
        SELECT variant_id, MAX(captured_at) AS max_captured_at
        FROM variant_price_history
        WHERE market_id = :market_id AND price_type = 'avg_market'
        GROUP BY variant_id
      ) latest_source
        ON latest_source.variant_id = x.variant_id
       AND latest_source.max_captured_at = x.captured_at
      WHERE x.market_id = :market_id AND x.price_type = 'avg_market'
    ) latest ON latest.variant_id = cv.variant_id
    ORDER BY cv.model_year DESC, mk.name, cm.name
    LIMIT 80
  `;

  const [rows] = await ctx.sequelize.query(sql, { replacements: { market_id } });
  const variantIds = rows.map((row) => Number(row.variant_id)).filter((value) => Number.isInteger(value));
  const { reviewMap, marketSignalMap } = await loadRecommendationEnrichment(ctx, variantIds, market_id);
  const rankedBase = rows
    .map((row) => {
      const review = reviewMap.get(Number(row.variant_id)) ?? {};
      const marketSignal = marketSignalMap.get(Number(row.variant_id)) ?? {};
      const name = [row.model_year, row.make_name, row.model_name, row.trim_name].filter(Boolean).join(" ");
      const candidate = {
        ...row,
        ...review,
        ...marketSignal,
      };
      return {
        ...candidate,
        name,
        fit_label: null,
        score: scoreRecommendationCandidate(candidate, profile),
        reasons: buildRecommendationReasons(candidate, profile),
        caveats: buildRecommendationCaveats(candidate, profile),
        market_summary: buildMarketSummary(candidate),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  for (const item of rankedBase) {
    item.fit_label = fitLabel(item.score);
  }

  const links = await linkRecommendationTargets(ctx, rankedBase);
  const ranked = rankedBase.map((item, index) => ({
    variant_id: item.variant_id ?? null,
    name: item.name,
    score: item.score,
    fit_label: item.fit_label,
    reasons: item.reasons,
    caveats: item.caveats,
    market_summary: item.market_summary,
    links: links[index] ?? null,
  }));

  const profileSummary = buildProfileSummary(profile);
  const marketCoverage = rankedBase.filter((item) => item.market_summary).length;
  const reviewCoverage = rankedBase.filter((item) => (item.review_count ?? 0) > 0).length;

  return recommendationResultSchema.parse({
    intent: "recommend_car",
    ranked_vehicles: ranked,
    profile_summary: profileSummary || "partial buyer profile",
    confidence: buildConfidence(
      clamp(0.42 + Object.keys(profile || {}).length * 0.07 + (marketCoverage / Math.max(rankedBase.length, 1)) * 0.1 + (reviewCoverage / Math.max(rankedBase.length, 1)) * 0.06, 0.42, 0.86),
      [
        "The recommendation is grounded to the current internal catalog, marketplace listings, and buyer profile.",
        marketCoverage > 0 ? "Persisted market-signal snapshots improved the ranking." : "Market-signal coverage is still partial for some candidates.",
        reviewCoverage > 0 ? "Local owner-review data was used where available." : "Owner-review coverage is still light for some candidates.",
      ]
    ),
    assumptions: [
      { label: "Recommendations are based on current catalog and listing coverage, not the full market.", type: "verified" },
      { label: "Trim-specific equipment can vary by region.", type: "estimated" },
    ],
    sources: [buildInternalSource("Local catalog, marketplace listings, and market price data used for recommendation ranking")],
  });
}
