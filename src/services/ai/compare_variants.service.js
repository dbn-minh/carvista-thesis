import { clamp } from "./_helpers.js";
import { buildConfidence, buildEvidence } from "./contracts.js";
import { buildComparePresentation } from "./presentation.service.js";
import { buildInternalSource, fetchOfficialVehicleSignals } from "./source_retrieval.service.js";

const SPEC_WHITELIST = [
  "0_100_kmh",
  "top_speed_kmh",
  "fuel_consumption_l_100km",
  "energy_consumption_kwh_100km",
  "ground_clearance_mm",
  "cargo_capacity_l",
  "towing_capacity_kg",
  "wheel_size_inch",
  "safety_rating",
  "airbags_count",
  "adas_level",
  "lane_keep_assist",
  "adaptive_cruise_control",
  "blind_spot_monitor",
  "charging_dc_kw",
];

function buildProsCons(item) {
  const pros = [];
  const cons = [];
  const specs = item.specs ?? {};
  const fuelEconomy = item.official_signals?.fuel_economy;
  const recallCount = item.official_signals?.recalls?.length ?? 0;

  if (specs.power_hp != null && Number(specs.power_hp) >= 250) pros.push("Strong performance output for its class.");
  if (item.avg_rating != null && item.avg_rating >= 4.0) pros.push("Strong owner sentiment in local review data.");
  if (item.latest_price != null) pros.push("Backed by recent market pricing in the local dataset.");
  if (fuelEconomy?.combined_mpg != null) pros.push(`Official fuel economy fallback available at about ${fuelEconomy.combined_mpg} mpg combined.`);
  if (item.body_type && ["suv", "mpv", "cuv"].includes(item.body_type)) pros.push("Good everyday practicality for mixed family use.");

  if (specs.curb_weight_kg != null && Number(specs.curb_weight_kg) >= 2200) cons.push("Higher curb weight may blunt efficiency and agility.");
  if (item.avg_rating != null && item.avg_rating < 3.0) cons.push("Local review sentiment is weaker than ideal.");
  if (recallCount > 0) cons.push(`Official recall lookup returned ${recallCount} item(s), so safety diligence matters.`);
  if (item.latest_price == null && item.msrp_base == null) cons.push("Market value is less grounded because pricing data is limited.");

  return {
    pros: pros.slice(0, 4),
    cons: cons.slice(0, 4),
  };
}

function computeUseCaseFit(item, buyerProfile) {
  if (!buyerProfile) return 0;
  let score = 0;

  if (buyerProfile.environment === "city" && (["sedan", "hatchback", "cuv"].includes(item.body_type) || ["hybrid", "ev"].includes(item.fuel_type))) {
    score += 8;
  }
  if (buyerProfile.environment === "rural" && ["suv", "mpv", "pickup"].includes(item.body_type)) {
    score += 8;
  }
  if (buyerProfile.long_trip_habit === "frequent" && ["gasoline", "hybrid", "diesel"].includes(item.fuel_type)) {
    score += 6;
  }
  if (buyerProfile.preferred_body_type && buyerProfile.preferred_body_type !== "any" && buyerProfile.preferred_body_type === item.body_type) {
    score += 8;
  }
  if (buyerProfile.preferred_fuel_type && buyerProfile.preferred_fuel_type !== "any" && buyerProfile.preferred_fuel_type === item.fuel_type) {
    score += 6;
  }
  if ((buyerProfile.passenger_count ?? 0) >= 6 && Number(item.seats) >= 6) {
    score += 8;
  }
  if (buyerProfile.budget_max && Number.isFinite(Number(item.latest_price ?? item.msrp_base))) {
    const price = Number(item.latest_price ?? item.msrp_base);
    if (price <= buyerProfile.budget_max) score += 7;
  }

  return clamp(score, 0, 24);
}

function computeScores(items, buyerProfile) {
  const priced = items.filter((item) => item.latest_price != null).map((item) => Number(item.latest_price));
  const minPrice = priced.length ? Math.min(...priced) : null;
  const maxPrice = priced.length ? Math.max(...priced) : null;

  for (const item of items) {
    const ratingScore = item.avg_rating != null ? clamp(Number(item.avg_rating), 0, 5) * 10 : 0;

    let priceScore = 0;
    if (minPrice != null && maxPrice != null && item.latest_price != null) {
      priceScore = minPrice === maxPrice ? 15 : 30 * (1 - (Number(item.latest_price) - minPrice) / (maxPrice - minPrice));
    } else if (item.msrp_base != null) {
      priceScore = 12;
    }

    let practicalityScore = 0;
    if (item.seats != null) practicalityScore += Number(item.seats) >= 7 ? 6 : Number(item.seats) >= 5 ? 4 : 2;
    if (["suv", "cuv", "mpv", "pickup"].includes(item.body_type)) practicalityScore += 5;
    if (["hybrid", "ev"].includes(item.fuel_type)) practicalityScore += 3;
    practicalityScore = clamp(practicalityScore, 0, 15);

    let safetyScore = 0;
    if (item.official_signals?.recalls?.length === 0) safetyScore += 6;
    if (item.specs?.safety_rating != null) safetyScore += clamp(Number(item.specs.safety_rating), 0, 5) * 1.5;
    safetyScore = clamp(safetyScore, 0, 12);

    const useCaseFitScore = computeUseCaseFit(item, buyerProfile);

    item._scores = {
      rating_score: ratingScore,
      price_score: clamp(priceScore, 0, 30),
      practicality_score: practicalityScore,
      safety_score: safetyScore,
      use_case_fit_score: useCaseFitScore,
      final_score: ratingScore + clamp(priceScore, 0, 30) + practicalityScore + safetyScore + useCaseFitScore,
    };
  }
}

function buildProfileFitSummary(buyerProfile) {
  if (!buyerProfile) return null;
  const parts = [];
  if (buyerProfile.budget_max) parts.push("budget-aware");
  if (buyerProfile.environment) parts.push(`${buyerProfile.environment}-driving fit`);
  if (buyerProfile.long_trip_habit) parts.push(`${buyerProfile.long_trip_habit} trip profile`);
  if (buyerProfile.passenger_count) parts.push(`${buyerProfile.passenger_count}-passenger use`);
  return parts.length ? `Weighted for ${parts.join(", ")}.` : null;
}

export async function compareVariants(ctx, input) {
  const variantIds = input?.variant_ids;
  const market_id = input?.market_id == null ? null : Number(input.market_id);
  const price_type = input?.price_type ?? "avg_market";
  const buyerProfile = input?.buyer_profile ?? null;

  if (!Array.isArray(variantIds) || variantIds.length < 2 || variantIds.length > 5) {
    throw { status: 400, message: "variant_ids must be array length 2..5" };
  }

  const ids = variantIds.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (ids.length !== variantIds.length) throw { status: 400, message: "variant_ids must be numeric" };
  if (market_id != null && !Number.isInteger(market_id)) throw { status: 400, message: "market_id must be int" };

  const {
    sequelize,
    models: { VariantSpecs, VariantSpecKv },
  } = ctx;

  const sqlBase = `
    SELECT
      cv.variant_id, cv.model_id, cv.model_year, cv.trim_name, cv.body_type, cv.fuel_type,
      cv.engine, cv.transmission, cv.drivetrain, cv.seats, cv.doors, cv.msrp_base,
      cm.name AS model_name,
      mk.name AS make_name
    FROM car_variants cv
    JOIN car_models cm ON cm.model_id = cv.model_id
    JOIN car_makes mk ON mk.make_id = cm.make_id
    WHERE cv.variant_id IN (:ids)
  `;
  const [baseRows] = await sequelize.query(sqlBase, { replacements: { ids } });

  const foundIds = new Set(baseRows.map((row) => Number(row.variant_id)));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length) {
    return {
      status: "partial",
      missing_variant_ids: missing,
      items: baseRows,
      notes: "Some variant_ids not found",
    };
  }

  const [specsRows, kvRows, ratingRows] = await Promise.all([
    VariantSpecs.findAll({ where: { variant_id: ids } }),
    VariantSpecKv.findAll({
      where: { variant_id: ids, spec_key: SPEC_WHITELIST },
      order: [["created_at", "DESC"]],
    }),
    sequelize.query(
      `
        SELECT variant_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
        FROM car_reviews
        WHERE variant_id IN (:ids)
        GROUP BY variant_id
      `,
      { replacements: { ids } }
    ),
  ]);

  let priceMap = new Map();
  if (market_id != null) {
    const [priceRows] = await sequelize.query(
      `
        SELECT x.variant_id, x.price
        FROM variant_price_history x
        JOIN (
          SELECT variant_id, MAX(captured_at) AS max_captured_at
          FROM variant_price_history
          WHERE market_id = :market_id AND price_type = :price_type AND variant_id IN (:ids)
          GROUP BY variant_id
        ) t ON t.variant_id = x.variant_id AND t.max_captured_at = x.captured_at
        WHERE x.market_id = :market_id AND x.price_type = :price_type
      `,
      { replacements: { market_id, price_type, ids } }
    );
    priceMap = new Map(priceRows.map((row) => [Number(row.variant_id), Number(row.price)]));
  }

  const specsMap = new Map(specsRows.map((row) => [Number(row.variant_id), row.toJSON()]));
  const kvMap = new Map();
  for (const row of kvRows) {
    const variantId = Number(row.variant_id);
    if (!kvMap.has(variantId)) kvMap.set(variantId, new Map());
    const bucket = kvMap.get(variantId);
    if (!bucket.has(row.spec_key)) {
      bucket.set(row.spec_key, {
        value: row.spec_value,
        unit: row.unit ?? null,
        source: row.source ?? null,
      });
    }
  }

  const ratings = ratingRows[0];
  const ratingMap = new Map(
    ratings.map((row) => [
      Number(row.variant_id),
      {
        avg_rating: row.avg_rating != null ? Number(row.avg_rating) : null,
        review_count: Number(row.review_count || 0),
      },
    ])
  );

  const officialSignals = await Promise.all(
    baseRows.map((row) =>
      fetchOfficialVehicleSignals({
        year: row.model_year,
        make: row.make_name,
        model: row.model_name,
      })
    )
  );

  const items = baseRows.map((row, index) => {
    const variantId = Number(row.variant_id);
    const official = officialSignals[index];
    const rating = ratingMap.get(variantId) ?? { avg_rating: null, review_count: 0 };
    const item = {
      variant_id: variantId,
      make: row.make_name,
      model: row.model_name,
      year: row.model_year,
      trim: row.trim_name,
      body_type: row.body_type,
      fuel_type: row.fuel_type,
      engine: row.engine,
      transmission: row.transmission,
      drivetrain: row.drivetrain,
      seats: row.seats,
      doors: row.doors,
      msrp_base: row.msrp_base != null ? Number(row.msrp_base) : null,
      specs: specsMap.get(variantId) ?? null,
      specs_kv_selected: kvMap.has(variantId) ? Object.fromEntries(kvMap.get(variantId).entries()) : {},
      latest_price: priceMap.get(variantId) ?? null,
      avg_rating: rating.avg_rating,
      review_count: rating.review_count,
      official_signals: official,
    };

    const prosCons = buildProsCons(item);
    item.pros = prosCons.pros;
    item.cons = prosCons.cons;
    return item;
  });

  computeScores(items, buyerProfile);

  const comparisonTable = {};
  const tableKeys = [
    "engine",
    "fuel_type",
    "transmission",
    "drivetrain",
    "seats",
    "latest_price",
    "avg_rating",
    ...SPEC_WHITELIST,
  ];

  for (const key of tableKeys) {
    const row = {};
    for (const item of items) {
      let value = null;
      if (key in item) value = item[key];
      else if (item.specs && key in item.specs) value = item.specs[key];
      else if (item.specs_kv_selected && item.specs_kv_selected[key]) value = item.specs_kv_selected[key];
      row[String(item.variant_id)] = value;
    }
    const allNull = Object.values(row).every((value) => value == null || (typeof value === "object" && value.value == null));
    if (!allNull) comparisonTable[key] = row;
  }

  const sorted = [...items].sort((a, b) => b._scores.final_score - a._scores.final_score);
  const best = sorted[0] ?? null;
  const officialCoverage = items.filter((item) => item.official_signals.sources.length > 0).length;
  const priceCoverage = items.filter((item) => item.latest_price != null).length;
  const confidence = buildConfidence(
    clamp(0.45 + (officialCoverage / items.length) * 0.2 + (priceCoverage / items.length) * 0.2 + (buyerProfile ? 0.1 : 0), 0, 0.92),
    [
      officialCoverage === items.length ? "All compared vehicles were enriched with official external data." : "Only part of the comparison had official external enrichment.",
      priceCoverage >= 2 ? "Local price history was available for multiple vehicles." : "Price coverage is still limited for some vehicles.",
      buyerProfile ? "The verdict was tailored to the stated buyer profile." : "The verdict is an all-round recommendation rather than a user-specific one.",
    ]
  );

  const sources = [
    buildInternalSource("Structured comparison built from local catalog, review, and market tables"),
    ...items.flatMap((item) => item.official_signals.sources),
  ];

  const caveats = [
    market_id == null ? "No market_id was provided, so current market pricing could be incomplete." : null,
    ...items.flatMap((item) => item.official_signals.caveats),
    "Trim-specific equipment and regional packaging can still change the real-world comparison.",
  ].filter(Boolean);

  const result = {
    items: items.map((item) => ({
      ...item,
      scores: item._scores,
      recommendation_reason:
        best?.variant_id === item.variant_id
          ? `Winner based on ${item._scores.final_score.toFixed(1)} total points, with strength in ${describeWinnerReason(item)}.`
          : null,
    })),
    comparison_table: comparisonTable,
    recommended_variant_id: best?.variant_id ?? null,
    recommendation_reason: best ? `Winner selected from structured scoring, official safety/efficiency signals, and buyer-profile fit.` : null,
    notes: market_id == null ? "market_id not provided; latest_price may be incomplete" : "",
    comparison_focus: buyerProfile ? "Buyer-profile weighted comparison" : "All-round comparison",
    profile_fit_summary: buildProfileFitSummary(buyerProfile),
    confidence,
    evidence: buildEvidence({
      verified: [
        "Vehicle identity, local specs, reviews, and market price signals were grounded to the local database.",
        officialCoverage > 0 ? "Official NHTSA and FuelEconomy.gov fallbacks were used when available." : null,
      ].filter(Boolean),
      inferred: ["The verdict blends value, safety, practicality, and buyer-fit rather than only raw specifications."],
      estimated: priceCoverage < items.length ? ["Some pricing gaps required a more qualitative comparison for certain vehicles."] : [],
    }),
    sources,
    caveats,
  };

  return {
    ...result,
    ...buildComparePresentation(result),
  };
}

function describeWinnerReason(item) {
  const reasons = [];
  if (item._scores.use_case_fit_score >= 10) reasons.push("use-case fit");
  if (item._scores.price_score >= 18) reasons.push("value");
  if (item._scores.rating_score >= 35) reasons.push("owner sentiment");
  if (item._scores.safety_score >= 8) reasons.push("safety context");
  return reasons.slice(0, 3).join(", ") || "balanced scoring";
}
