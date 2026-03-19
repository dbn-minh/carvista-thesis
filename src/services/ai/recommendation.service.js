import { clamp } from "./_helpers.js";
import { buildConfidence } from "./contracts.js";
import { recommendationResultSchema } from "./dtos.js";
import { buildInternalSource } from "./source_retrieval.service.js";

function scoreRecommendation(item, profile) {
  let score = 0;
  const price = Number(item.latest_price ?? item.msrp_base);

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

  return score;
}

function buildReasons(item, profile) {
  const reasons = [];
  if (profile?.preferred_body_type && profile.preferred_body_type === item.body_type) reasons.push(`matches the preferred ${item.body_type} body style`);
  if (profile?.preferred_fuel_type && profile.preferred_fuel_type === item.fuel_type) reasons.push(`matches the preferred ${item.fuel_type} powertrain`);
  if (profile?.environment === "city" && ["sedan", "hatchback", "cuv"].includes(item.body_type)) reasons.push("fits city driving well");
  if (profile?.long_trip_habit === "frequent" && ["hybrid", "diesel", "gasoline"].includes(item.fuel_type)) reasons.push("is practical for longer trips");
  if ((profile?.passenger_count ?? 0) >= 6 && Number(item.seats) >= 6) reasons.push("covers the usual passenger count");
  return reasons.slice(0, 3);
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
  const ranked = rows
    .map((row) => ({
      ...row,
      score: scoreRecommendation(row, profile),
      reasons: buildReasons(row, profile),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const profileSummary = [
    profile?.budget_max ? `budget around ${profile.budget_max}` : null,
    profile?.environment ? `${profile.environment} driving` : null,
    profile?.long_trip_habit ? `${profile.long_trip_habit} longer trips` : null,
    profile?.preferred_body_type && profile.preferred_body_type !== "any" ? `${profile.preferred_body_type} preference` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return recommendationResultSchema.parse({
    intent: "recommend_car",
    ranked_vehicles: ranked.map((item) => ({
      variant_id: item.variant_id ?? null,
      name: [item.model_year, item.make_name, item.model_name, item.trim_name].filter(Boolean).join(" "),
      score: item.score,
      reasons: item.reasons,
    })),
    profile_summary: profileSummary || "partial buyer profile",
    confidence: buildConfidence(
      clamp(0.42 + Object.keys(profile || {}).length * 0.08, 0.42, 0.82),
      ["The recommendation is grounded to the current internal catalog and buyer profile."]
    ),
    assumptions: [
      { label: "Recommendations are based on current catalog coverage, not the full market.", type: "verified" },
      { label: "Trim-specific equipment can vary by region.", type: "estimated" },
    ],
    sources: [buildInternalSource("Local catalog and market price data used for recommendation ranking")],
  });
}
