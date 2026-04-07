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
    profile.passenger_count ? `${profile.passenger_count} passengers` : null,
    profile.city_vs_highway_ratio ? `${profile.city_vs_highway_ratio.replaceAll("_", " ")} use` : null,
  ]
    .filter(Boolean)
    .join(", ");
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

  if (!variantIds.length) return { reviewMap, marketSignalMap, specMap, featureMap };

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

  return { reviewMap, marketSignalMap, specMap, featureMap };
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
    LIMIT 140
  `;

  const [rows] = await ctx.sequelize.query(sql, { replacements: { market_id } });
  const variantIds = rows.map((row) => Number(row.variant_id)).filter((value) => Number.isInteger(value));
  const { reviewMap, marketSignalMap, specMap, featureMap } = await loadRecommendationEnrichment(ctx, variantIds, market_id);

  const evaluated = rows
    .map((row) => {
      const variantId = Number(row.variant_id);
      const candidate = {
        ...row,
        ...(reviewMap.get(variantId) ?? {}),
        ...(marketSignalMap.get(variantId) ?? {}),
        ...(specMap.get(variantId) ?? {}),
        feature_map: featureMap.get(variantId) ?? {},
        name: [row.model_year, row.make_name, row.model_name, row.trim_name].filter(Boolean).join(" "),
      };
      const evaluation = evaluateRecommendationCandidate(candidate, normalizedProfile);
      return {
        ...candidate,
        evaluation,
        score: evaluation.final_score,
      };
    })
    .filter((item) => !item.evaluation.hard_fail)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  const links = await linkRecommendationTargets(ctx, evaluated);
  const ranked = evaluated.map((item, index, array) => {
    const evaluation = item.evaluation;
    return {
      variant_id: item.variant_id ?? null,
      name: item.name,
      score: evaluation.final_score,
      fit_label: fitLabel(evaluation.final_score),
      reasons: buildRecommendationReasons(item, evaluation),
      caveats: buildRecommendationCaveats(evaluation),
      market_summary: buildMarketSummary(item),
      links: links[index] ?? null,
      fit_scores: evaluation.fit_scores,
      top_mismatches: evaluation.top_mismatches,
      best_for: evaluation.best_for,
      why_this_over_alternatives: buildAlternativeRationale(item, array[index + 1] ?? null),
    };
  });

  const profileSummary = buildProfileSummary(normalizedProfile);
  const marketCoverage = evaluated.filter((item) => item.market_summary).length;
  const reviewCoverage = evaluated.filter((item) => (item.review_count ?? 0) > 0).length;
  const specCoverage = evaluated.filter((item) => Object.keys(item.feature_map ?? {}).length > 0 || item.power_hp != null).length;

  return recommendationResultSchema.parse({
    intent: "recommend_car",
    ranked_vehicles: ranked,
    profile_summary: profileSummary || "partial buyer profile",
    confidence: buildConfidence(
      clamp(
        0.45 +
          Object.keys(normalizedProfile || {}).length * 0.01 +
          (marketCoverage / Math.max(evaluated.length, 1)) * 0.12 +
          (reviewCoverage / Math.max(evaluated.length, 1)) * 0.08 +
          (specCoverage / Math.max(evaluated.length, 1)) * 0.12,
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
