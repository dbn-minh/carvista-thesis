import { clamp } from "./_helpers.js";
import { buildConfidence } from "./contracts.js";
import { recommendationResultSchema } from "./dtos.js";
import { normalizePreferenceProfile } from "./advisor_profile.service.js";
import { evaluateRecommendationCandidate, fitLabel, scoreRecommendationCandidate } from "./advisor_scoring.service.js";
import { linkRecommendationTargets } from "./recommendation_linking.service.js";
import { buildInternalSource, loadVariantContext } from "./source_retrieval.service.js";

function toNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedPrice(item) {
  return toNumberOrNull(item.latest_price ?? item.avg_asking_price ?? item.msrp_base);
}

function isAvailableCatalogCandidate(item) {
  if (item.is_placeholder === true || item.is_placeholder === 1 || item.is_placeholder === "1") return false;
  if (String(item.status || "").toLowerCase() === "unavailable") return false;
  return true;
}

function matchesDealBreaker(item, dealBreaker) {
  const normalized = String(dealBreaker || "").toLowerCase();
  if (!normalized) return false;
  if (normalized === "manual_transmission") return String(item.transmission || "").toLowerCase().includes("manual");
  if (normalized === "ev_powertrain") return String(item.fuel_type || "").toLowerCase() === "ev";
  if (normalized === "oversized_vehicle") {
    const length = toNumberOrNull(item.length_mm);
    return ["pickup", "full_size_suv"].includes(String(item.body_type || "").toLowerCase()) || (length != null && length > 4900);
  }
  if (normalized === "avoid_chinese_brands") return ["byd", "vinfast", "mg", "great wall", "haval", "geely", "chery"].includes(String(item.make_name || "").toLowerCase());
  return false;
}

function buildHardFilterFailures(item, profile = {}) {
  const failures = [];
  const price = normalizedPrice(item);
  const preferredBodies = (profile.preferred_body_types ?? [])
    .map((value) => String(value || "").toLowerCase())
    .filter((value) => value && value !== "any");
  const rejectedBodies = (profile.rejected_body_types ?? [])
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);
  const preferredFuels = (profile.preferred_fuel_types ?? [])
    .map((value) => String(value || "").toLowerCase())
    .filter((value) => value && value !== "any");
  const rejectedFuels = (profile.rejected_fuel_types ?? [])
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);
  const seatNeed = profile.needs_7_seats
    ? 7
    : toNumberOrNull(profile.regular_passenger_count ?? profile.family_size ?? profile.passenger_count);
  const seats = toNumberOrNull(item.seats);
  const bodyType = String(item.body_type || "").toLowerCase();
  const fuelType = String(item.fuel_type || "").toLowerCase();
  const bodyRequirement = String(profile.body_type_requirement || "").toLowerCase();
  const fuelRequirement = String(profile.fuel_type_requirement || "").toLowerCase();
  const seatRequirement = String(profile.seat_requirement || "").toLowerCase();
  const brandRejections = (profile.brand_rejections ?? []).map((value) => String(value || "").toLowerCase()).filter(Boolean);
  const dealBreakers = (profile.deal_breakers ?? []).map((value) => String(value || "").toLowerCase()).filter(Boolean);

  if (!isAvailableCatalogCandidate(item)) failures.push("not available in the catalog");
  if (rejectedBodies.includes(bodyType)) failures.push("explicitly excluded body style");
  if (preferredBodies.length && bodyRequirement === "hard" && !preferredBodies.includes(bodyType)) {
    failures.push("different vehicle type");
  }
  if (preferredFuels.length && fuelRequirement === "hard" && !preferredFuels.includes(fuelType)) {
    failures.push("different fuel type");
  }
  if (rejectedFuels.includes(fuelType)) failures.push("explicitly excluded fuel type");
  if (brandRejections.includes(String(item.make_name || "").toLowerCase())) failures.push("belongs to an excluded brand");
  if (seatNeed != null && seats != null && seats < Math.min(seatNeed, 7) && seatRequirement !== "soft") {
    failures.push("below requested seating");
  }
  if (profile.budget_ceiling != null && price != null && price > profile.budget_ceiling * 1.08) {
    failures.push("above budget range");
  }
  for (const dealBreaker of dealBreakers) {
    if (matchesDealBreaker(item, dealBreaker)) failures.push(`hits deal-breaker: ${dealBreaker.replaceAll("_", " ")}`);
  }

  return failures;
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

function buildProfileSummary(profile = {}) {
  return [
    profile.primary_use_cases?.length ? `main use: ${profile.primary_use_cases.slice(0, 2).join(" & ").replaceAll("_", " ")}` : null,
    profile.budget_target ? `target budget ${profile.budget_target.toLocaleString("en-US")}` : null,
    profile.budget_ceiling && profile.budget_ceiling !== profile.budget_target ? `ceiling ${profile.budget_ceiling.toLocaleString("en-US")}` : null,
    profile.budget_mode === "open" ? "open budget" : null,
    profile.price_positioning ? `${profile.price_positioning} positioning` : null,
    profile.passenger_count ? `${profile.passenger_count} passengers` : null,
    profile.rejected_body_types?.length ? `avoid ${profile.rejected_body_types.slice(0, 2).join(" & ")}` : null,
    profile.city_vs_highway_ratio ? `${profile.city_vs_highway_ratio.replaceAll("_", " ")} use` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildPriceStats(rows = []) {
  const prices = rows.map((row) => normalizedPrice(row)).filter((value) => Number.isFinite(value));
  if (!prices.length) return { min: null, max: null, range: null };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return {
    min,
    max,
    range: Math.max(max - min, 1),
  };
}

function isPremiumLikeCandidate(item) {
  const make = String(item.make_name || "").toLowerCase();
  return ["bmw", "mercedes-benz", "mercedes", "audi", "lexus", "volvo", "land rover", "porsche", "ferrari", "lamborghini", "mclaren", "aston martin"].includes(make) || (normalizedPrice(item) ?? 0) >= 1_400_000_000;
}

function buildPricePositioningAdjustment(item, profile = {}, stats = {}) {
  const price = normalizedPrice(item);
  if (price == null || stats.min == null || stats.max == null || !profile.price_positioning) {
    return { value: 0, reason: null };
  }

  const priceRank = stats.range > 0 ? (price - stats.min) / stats.range : 0.5;
  switch (profile.price_positioning) {
    case "flagship":
      return {
        value: clamp(Math.round(priceRank * 18 + (isPremiumLikeCandidate(item) ? 3 : 0)), 0, 22),
        reason: priceRank >= 0.6 ? "sits at the flagship end of the current catalog" : null,
      };
    case "premium":
      return {
        value: clamp(Math.round(priceRank * 10 + (isPremiumLikeCandidate(item) ? 3 : 0)), 0, 14),
        reason: priceRank >= 0.5 ? "leans toward the premium end of the current catalog" : null,
      };
    case "value":
      return {
        value: clamp(Math.round((1 - priceRank) * 10 + (!isPremiumLikeCandidate(item) ? 2 : 0)), 0, 12),
        reason: priceRank <= 0.45 ? "lands closer to the stronger value end of the catalog" : null,
      };
    case "budget":
      return {
        value: clamp(Math.round((1 - priceRank) * 14 + (!isPremiumLikeCandidate(item) ? 2 : 0)), 0, 16),
        reason: priceRank <= 0.35 ? "stays closer to the more accessible end of the catalog" : null,
      };
    default:
      return { value: 0, reason: null };
  }
}

function buildPreferenceAdjustment(item, profile = {}) {
  const bodyType = String(item.body_type || "").toLowerCase();
  const fuelType = String(item.fuel_type || "").toLowerCase();
  const preferredBodies = (profile.preferred_body_types ?? []).map((value) => String(value || "").toLowerCase()).filter((value) => value && value !== "any");
  const rejectedBodies = (profile.rejected_body_types ?? []).map((value) => String(value || "").toLowerCase()).filter(Boolean);
  const preferredFuels = (profile.preferred_fuel_types ?? []).map((value) => String(value || "").toLowerCase()).filter((value) => value && value !== "any");
  const rejectedFuels = (profile.rejected_fuel_types ?? []).map((value) => String(value || "").toLowerCase()).filter(Boolean);
  const reasons = [];
  let value = 0;

  if (preferredBodies.includes(bodyType)) {
    value += profile.body_type_requirement === "hard" ? 10 : 7;
    reasons.push("matches your preferred body style");
  } else if (preferredBodies.length && profile.body_type_requirement !== "hard") {
    value -= 4;
  }

  if (rejectedBodies.includes(bodyType)) value -= 12;

  if (preferredFuels.includes(fuelType)) {
    value += profile.fuel_type_requirement === "hard" ? 8 : 5;
    reasons.push("fits your preferred fuel type");
  } else if (preferredFuels.length && profile.fuel_type_requirement !== "hard") {
    value -= 3;
  }

  if (rejectedFuels.includes(fuelType)) value -= 8;

  return {
    value: clamp(value, -16, 16),
    reasons: reasons.slice(0, 2),
  };
}

function candidateFromVariantContext(context) {
  const kv = Object.fromEntries((context.kv ?? []).map((item) => [String(item.spec_key || "").toLowerCase(), item.spec_value]));
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
    ...(context.spec ?? {}),
    feature_map: kv,
    avg_rating: toNumberOrNull(context.review_summary?.avg_rating),
    review_count: Number(context.review_summary?.review_count || 0),
  };
}

async function loadRecommendationEnrichment(ctx, variantIds = [], market_id = 1) {
  const reviewMap = new Map();
  const marketSignalMap = new Map();
  const specMap = new Map();
  const featureMap = new Map();
  const imageMap = new Map();

  if (!variantIds.length) return { reviewMap, marketSignalMap, specMap, featureMap, imageMap };

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
    // Optional enrichment.
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
    // Optional enrichment.
  }

  if (ctx.models?.VariantSpecs?.findAll) {
    try {
      const specRows = await ctx.models.VariantSpecs.findAll({ where: { variant_id: variantIds } });
      for (const row of specRows) {
        const plain = row.toJSON ? row.toJSON() : row;
        specMap.set(Number(plain.variant_id), plain);
      }
    } catch {
      // Optional enrichment.
    }
  }

  if (ctx.models?.VariantSpecKv?.findAll) {
    try {
      const kvRows = await ctx.models.VariantSpecKv.findAll({ where: { variant_id: variantIds } });
      for (const row of kvRows) {
        const plain = row.toJSON ? row.toJSON() : row;
        const variantId = Number(plain.variant_id);
        const current = featureMap.get(variantId) ?? {};
        current[String(plain.spec_key || "").toLowerCase()] = plain.spec_value;
        featureMap.set(variantId, current);
      }
    } catch {
      // Optional enrichment.
    }
  }

  if (ctx.models?.VariantImages?.findAll) {
    try {
      const imageRows = await ctx.models.VariantImages.findAll({
        where: { variant_id: variantIds },
        attributes: ["variant_id", "url", "sort_order"],
        order: [["variant_id", "ASC"], ["sort_order", "ASC"]],
      });
      for (const row of imageRows) {
        const plain = row.toJSON ? row.toJSON() : row;
        const variantId = Number(plain.variant_id);
        if (!Number.isInteger(variantId) || imageMap.has(variantId)) continue;
        imageMap.set(variantId, plain.url ?? null);
      }
    } catch {
      // Optional enrichment.
    }
  }

  return { reviewMap, marketSignalMap, specMap, featureMap, imageMap };
}

function buildRecommendationReasons(item, evaluation) {
  const reasons = [...(evaluation.top_matched_reasons ?? [])];
  if ((item.review_count ?? 0) >= 4 && (item.avg_rating ?? 0) >= 4.1) reasons.push("shows better owner sentiment in the available local review pool");
  if ((item.active_listing_count ?? 0) >= 2 && (item.price_spread_pct ?? 1) <= 0.12) reasons.push("has healthier market activity without unusually volatile asking prices");
  return reasons.slice(0, 4);
}

function buildRecommendationCaveats(evaluation) {
  return [
    ...(evaluation.top_mismatches ?? []),
    ...(evaluation.penalties ?? []).map((entry) => entry.label),
  ].slice(0, 3);
}

function buildAlternativeRationale(current, alternative) {
  if (!alternative) return null;
  const betterAreas = Object.entries(alternative.fit_scores ?? {})
    .filter(([key, value]) => value > (current.fit_scores?.[key] ?? 0) + 6)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([key]) => key.replaceAll("_fit", "").replaceAll("_", " "));
  return betterAreas.length ? `looks better if you care more about ${betterAreas.join(" and ")}` : null;
}

export { scoreRecommendationCandidate };

export async function evaluateVariantFit(ctx, { variant_id, profile, market_id = 1 }) {
  const context = await loadVariantContext(ctx, { variant_id, market_id });
  if (!context) return null;

  const normalizedProfile = normalizePreferenceProfile(profile);
  const candidate = candidateFromVariantContext(context);
  const evaluation = evaluateRecommendationCandidate(candidate, normalizedProfile);
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
    score: evaluation.final_score,
    fit_label: fitLabel(evaluation.final_score),
    reasons: buildRecommendationReasons(candidate, evaluation),
    caveats: buildRecommendationCaveats(evaluation),
    profile_summary: buildProfileSummary(normalizedProfile) || "partial buyer profile",
    links: links[0] ?? null,
    fit_scores: evaluation.fit_scores,
    top_mismatches: evaluation.top_mismatches,
  };
}

export async function recommendCars(ctx, { profile, market_id = 1 }) {
  const normalizedProfile = normalizePreferenceProfile(profile);
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
      cv.is_placeholder,
      cm.name AS model_name,
      mk.name AS make_name,
      COALESCE(latest.price, active.avg_asking_price) AS latest_price,
      COALESCE(active.active_listing_count, 0) AS active_listing_count
    FROM car_variants cv
    JOIN car_models cm ON cm.model_id = cv.model_id
    JOIN car_makes mk ON mk.make_id = cm.make_id
    JOIN markets m ON m.market_id = :market_id
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
    LEFT JOIN (
      SELECT l.variant_id, COUNT(*) AS active_listing_count, AVG(l.asking_price) AS avg_asking_price
      FROM listings l
      JOIN markets listing_market ON listing_market.country_code = l.location_country_code
      WHERE listing_market.market_id = :market_id AND l.status = 'active'
      GROUP BY l.variant_id
    ) active ON active.variant_id = cv.variant_id
    WHERE cv.is_placeholder = 0
    ORDER BY cv.model_year DESC, mk.name, cm.name
    LIMIT 140
  `;

  const [rows] = await ctx.sequelize.query(sql, { replacements: { market_id } });
  const priceStats = buildPriceStats(rows);
  const variantIds = rows.map((row) => Number(row.variant_id)).filter((value) => Number.isInteger(value));
  const { reviewMap, marketSignalMap, specMap, featureMap, imageMap } = await loadRecommendationEnrichment(ctx, variantIds, market_id);

  const evaluated = rows
    .map((row) => {
      const variantId = Number(row.variant_id);
      const candidate = {
        ...row,
        ...(reviewMap.get(variantId) ?? {}),
        ...(marketSignalMap.get(variantId) ?? {}),
        ...(specMap.get(variantId) ?? {}),
        feature_map: featureMap.get(variantId) ?? {},
        thumbnail_url: imageMap.get(variantId) ?? null,
        name: [row.model_year, row.make_name, row.model_name, row.trim_name].filter(Boolean).join(" "),
      };
      const evaluation = evaluateRecommendationCandidate(candidate, normalizedProfile);
      const pricePositioningAdjustment = buildPricePositioningAdjustment(candidate, normalizedProfile, priceStats);
      const preferenceAdjustment = buildPreferenceAdjustment(candidate, normalizedProfile);
      return {
        ...candidate,
        evaluation,
        price_positioning_adjustment: pricePositioningAdjustment,
        preference_adjustment: preferenceAdjustment,
        hard_filter_failures: buildHardFilterFailures(candidate, normalizedProfile),
        score: clamp(evaluation.final_score + pricePositioningAdjustment.value + preferenceAdjustment.value, 0, 100),
      };
    })
    .filter((item) => !item.evaluation.hard_fail);

  const strictMatches = evaluated.filter((item) => item.hard_filter_failures.length === 0);
  const closestAvailableFallback = strictMatches.length < Math.min(2, evaluated.length);
  const rankedSource = (closestAvailableFallback ? evaluated : strictMatches)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  const links = await linkRecommendationTargets(ctx, rankedSource);
  const ranked = rankedSource.map((item, index, array) => {
    const evaluation = item.evaluation;
    const reasons = [
      ...(item.price_positioning_adjustment?.reason ? [item.price_positioning_adjustment.reason] : []),
      ...buildRecommendationReasons(item, evaluation),
      ...(item.preference_adjustment?.reasons ?? []),
    ].slice(0, 4);
    return {
      variant_id: item.variant_id ?? null,
      name: item.name,
      body_type: item.body_type ?? null,
      fuel_type: item.fuel_type ?? null,
      seats: toNumberOrNull(item.seats),
      latest_price: normalizedPrice(item),
      score: item.score,
      fit_label: fitLabel(item.score),
      reasons,
      caveats: [
        ...(closestAvailableFallback && item.hard_filter_failures.length ? [`Closest available match: ${item.hard_filter_failures.join(", ")}`] : []),
        ...buildRecommendationCaveats(evaluation),
      ].slice(0, 3),
      thumbnail_url: item.thumbnail_url ?? null,
      market_summary: buildMarketSummary(item),
      links: links[index] ?? null,
      fit_scores: evaluation.fit_scores,
      top_mismatches: evaluation.top_mismatches,
      best_for: evaluation.best_for,
      why_this_over_alternatives: buildAlternativeRationale(item, array[index + 1] ?? null),
    };
  });

  const profileSummary = buildProfileSummary(normalizedProfile);
  const marketCoverage = rankedSource.filter((item) => item.market_summary).length;
  const reviewCoverage = rankedSource.filter((item) => (item.review_count ?? 0) > 0).length;
  const specCoverage = rankedSource.filter((item) => Object.keys(item.feature_map ?? {}).length > 0 || item.power_hp != null).length;
  const coverageDenominator = Math.max(rankedSource.length, 1);

  return recommendationResultSchema.parse({
    intent: "recommend_car",
    ranked_vehicles: ranked,
    profile_summary: closestAvailableFallback
      ? `closest available matches${profileSummary ? ` for ${profileSummary}` : ""}`
      : profileSummary || "partial buyer profile",
    confidence: buildConfidence(
      clamp(
        0.45 +
          Object.keys(normalizedProfile || {}).length * 0.01 +
          (marketCoverage / coverageDenominator) * 0.12 +
          (reviewCoverage / coverageDenominator) * 0.08 +
          (specCoverage / coverageDenominator) * 0.12,
        0.45,
        0.9
      ),
      [
        "The recommendation is grounded to the current internal catalog, marketplace listings, and buyer profile.",
        marketCoverage > 0 ? "Persisted market-signal snapshots improved the ranking." : "Market-signal coverage is still partial for some candidates.",
        reviewCoverage > 0 ? "Local owner-review data was used where available." : "Owner-review coverage is still light for some candidates.",
        specCoverage > 0 ? "Structured vehicle specs and feature signals were used to score practical fit." : "Some trim-level feature detail is still missing for part of the shortlist.",
      ]
    ),
    assumptions: [
      { label: "Recommendations are based on current catalog and listing coverage, not the full market.", type: "verified" },
      { label: "Trim-specific equipment can vary by region, so some convenience and safety fit is estimated from current spec coverage.", type: "estimated" },
    ],
    sources: [buildInternalSource("Local catalog, structured specs, marketplace listings, and market price data used for recommendation ranking")],
  });
}
