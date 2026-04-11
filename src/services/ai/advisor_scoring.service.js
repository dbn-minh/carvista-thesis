import { clamp } from "./_helpers.js";
import { normalizePreferenceProfile } from "./advisor_profile.service.js";

const PREMIUM_BRANDS = new Set(["bmw", "mercedes-benz", "mercedes", "audi", "lexus", "volvo", "land rover", "mini"]);
const EXOTIC_BRANDS = new Set(["ferrari", "lamborghini", "mclaren", "aston martin", "porsche"]);

function toNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedPrice(item) {
  return toNumberOrNull(item.latest_price ?? item.avg_asking_price ?? item.msrp_base);
}

function isPremium(item) {
  return PREMIUM_BRANDS.has(String(item.make_name || "").toLowerCase()) || (normalizedPrice(item) ?? 0) >= 1_400_000_000;
}

function isExotic(item) {
  return EXOTIC_BRANDS.has(String(item.make_name || "").toLowerCase()) || (normalizedPrice(item) ?? 0) >= 3_500_000_000;
}

function isExoticBrand(item) {
  return EXOTIC_BRANDS.has(String(item.make_name || "").toLowerCase());
}

function isPerformanceFirstProfile(profile) {
  return (
    profile.performance_priority >= 0.7 ||
    profile.primary_use_cases?.includes("lifestyle") ||
    profile.tradeoff_preferences?.includes("performance_over_reliability") ||
    profile.emotional_motivators?.includes("sporty_identity")
  );
}

function boolFromValue(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "available", "standard"].includes(normalized);
}

function featureMap(item) {
  return item.feature_map ?? {};
}

function getFeature(item, key) {
  return featureMap(item)?.[key] ?? null;
}

function hasFeature(item, key) {
  return boolFromValue(getFeature(item, key));
}

function firstNumericFeature(item, keys = []) {
  for (const key of keys) {
    const numeric = toNumberOrNull(getFeature(item, key));
    if (numeric != null) return numeric;
  }
  return null;
}

function safeScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function average(scores = []) {
  const filtered = scores.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 50;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function buildBudgetFit(item, profile) {
  const price = normalizedPrice(item);
  const target = profile.budget_target ?? profile.budget_ceiling ?? null;
  const ceiling = profile.budget_ceiling ?? profile.budget_target ?? null;
  if (price == null || target == null) return { score: 62, reasons: [], mismatches: [] };

  if (ceiling != null && price > ceiling) {
    const overPct = (price - ceiling) / ceiling;
    return {
      score: safeScore(18 - overPct * 120),
      reasons: [],
      mismatches: [`sits above your hard budget ceiling by about ${(overPct * 100).toFixed(0)}%`],
      hard_fail: overPct > 0.08 && !["medium", "high"].includes(profile.budget_flexibility ?? ""),
    };
  }

  if (price <= target) {
    const closeness = target > 0 ? 1 - Math.abs(target - price) / target : 0.8;
    return {
      score: safeScore(82 + closeness * 18),
      reasons: ["fits your target budget without stretching into the next tier"],
      mismatches: [],
    };
  }

  const stretchPct = target > 0 ? (price - target) / target : 0;
  return {
    score: safeScore(78 - stretchPct * 60),
    reasons: stretchPct <= 0.08 ? ["only stretches the target budget slightly"] : [],
    mismatches: stretchPct > 0.08 ? ["needs a budget stretch versus the range you said looks ideal"] : [],
  };
}

function useCaseScore(useCase, item, profile) {
  const body = String(item.body_type || "");
  const fuel = String(item.fuel_type || "");
  const seats = Number(item.seats || 5);
  const hp = toNumberOrNull(item.power_hp) ?? firstNumericFeature(item, ["power_hp"]) ?? 150;

  switch (useCase) {
    case "daily_commute":
    case "city_driving":
      return average([
        ["sedan", "hatchback", "cuv"].includes(body) ? 92 : ["suv", "mpv"].includes(body) ? 72 : 60,
        ["hybrid", "ev"].includes(fuel) ? 92 : fuel === "gasoline" ? 72 : 65,
        profile.parking_constraints === "tight" && ["pickup", "mpv"].includes(body) ? 40 : 85,
      ]);
    case "family":
      return average([
        seats >= 7 ? 96 : seats >= 5 ? 82 : 40,
        ["suv", "mpv", "wagon"].includes(body) ? 94 : body === "sedan" ? 70 : 58,
      ]);
    case "road_trip":
      return average([
        ["suv", "sedan", "wagon", "mpv"].includes(body) ? 88 : 65,
        hp >= 180 ? 82 : 68,
      ]);
    case "business":
      return average([isPremium(item) ? 92 : 70, ["sedan", "suv"].includes(body) ? 88 : 64]);
    case "commercial_service":
      return average([fuel === "hybrid" ? 92 : fuel === "gasoline" ? 78 : 70, seats >= 5 ? 82 : 60]);
    case "cargo":
      return average([["pickup", "mpv", "suv"].includes(body) ? 92 : 50, seats >= 5 ? 78 : 60]);
    case "offroad":
      return average([["suv", "pickup"].includes(body) ? 92 : 42, item.drivetrain?.toLowerCase().includes("4") ? 90 : 62]);
    case "lifestyle":
      return average([isPremium(item) || isExotic(item) ? 92 : 70, hp >= 220 ? 86 : 66]);
    default:
      return 68;
  }
}

function buildUseCaseFit(item, profile) {
  const useCases = profile.primary_use_cases?.length ? profile.primary_use_cases : ["daily_commute"];
  const score = average(useCases.map((useCase) => useCaseScore(useCase, item, profile)));
  const reasons = [];
  if (useCases.includes("family") && ["suv", "mpv"].includes(item.body_type)) reasons.push("matches your family-focused use case better than a smaller body style");
  if ((useCases.includes("daily_commute") || useCases.includes("city_driving")) && ["hybrid", "ev"].includes(item.fuel_type)) reasons.push("makes everyday commuting easier with a more efficient powertrain");
  if (useCases.includes("road_trip") && (toNumberOrNull(item.power_hp) ?? 0) >= 180) reasons.push("has enough performance headroom for highway and out-of-town use");
  if (useCases.includes("lifestyle") && ((toNumberOrNull(item.power_hp) ?? 0) >= 180 || isPremium(item) || isExotic(item))) reasons.push("leans toward a more engaging fun-driving profile");
  return { score: safeScore(score), reasons, mismatches: [] };
}

function buildSizeSpaceFit(item, profile) {
  const seats = toNumberOrNull(item.seats) ?? 5;
  const cargo = firstNumericFeature(item, ["cargo_capacity_l", "cargo_l", "trunk_l"]);
  const body = String(item.body_type || "");
  const seatRequirement = String(profile.seat_requirement || "").toLowerCase();
  let score = 72;
  const reasons = [];
  const mismatches = [];

  if (profile.needs_7_seats) {
    score = seats >= 7 ? 95 : seatRequirement === "soft" ? 58 : 18;
    if (seats >= 7) reasons.push("covers your seating requirement without relying on compromises");
    else mismatches.push("does not meet the 7-seat flexibility you asked for");
  } else if ((profile.regular_passenger_count ?? 0) >= 5 || profile.child_present || profile.elderly_present) {
    score += seats >= 5 ? 16 : -28;
    if (["suv", "mpv", "wagon"].includes(body)) score += 10;
    if (cargo != null && cargo >= 450) score += 8;
  } else if ((profile.regular_passenger_count ?? 0) <= 2 && profile.parking_constraints === "tight") {
    score += ["sedan", "hatchback", "cuv"].includes(body) ? 12 : -8;
  }

  if (profile.cargo_needs === "high" && cargo != null && cargo < 400) mismatches.push("cargo space may feel tight for the amount of gear you plan to carry");
  return { score: safeScore(score), reasons, mismatches, hard_fail: profile.needs_7_seats && seatRequirement !== "soft" && seats < 7 };
}

function buildDrivingConditionFit(item, profile) {
  const body = String(item.body_type || "");
  const clearance = firstNumericFeature(item, ["ground_clearance_mm"]);
  const length = toNumberOrNull(item.length_mm);
  let score = 70;
  const reasons = [];
  const mismatches = [];

  if (profile.city_vs_highway_ratio === "mostly_city") {
    score += ["sedan", "hatchback", "cuv"].includes(body) ? 18 : -6;
    if (profile.parking_constraints === "tight" && length != null && length > 4900) {
      score -= 25;
      mismatches.push("may feel bulky for your parking situation");
    }
  }
  if (profile.city_vs_highway_ratio === "mostly_highway") {
    score += ["sedan", "suv", "wagon"].includes(body) ? 12 : 0;
  }
  if (profile.road_conditions?.includes("rough_roads") || profile.flood_risk) {
    score += ["suv", "pickup", "mpv"].includes(body) ? 16 : -18;
    if (clearance != null && clearance < 170) mismatches.push("ground clearance looks limited for rougher roads or flood-prone areas");
  }
  if (profile.awd_need && !String(item.drivetrain || "").toLowerCase().includes("4")) {
    score -= 20;
    mismatches.push("does not really meet the AWD or traction need you described");
  }

  return { score: safeScore(score), reasons, mismatches, hard_fail: profile.parking_constraints === "tight" && length != null && length > 5050 };
}

function buildOperatingCostFit(item, profile) {
  const fuel = String(item.fuel_type || "");
  const combined = firstNumericFeature(item, ["mpg_combined", "combined_mpg", "combined_km_per_l"]);
  let score = 62;
  const reasons = [];
  const mismatches = [];

  if (fuel === "hybrid") score += 24;
  else if (fuel === "ev") score += profile.charging_availability === "none" ? -28 : 18;
  else if (fuel === "diesel") score += 8;
  else if (fuel === "gasoline") score += 4;
  if (combined != null) score += clamp((combined - 20) / 15, -0.3, 0.4) * 40;
  if (isPremium(item)) score -= 10;
  if (isExotic(item)) score -= 22;
  if (profile.fuel_saving_priority >= 0.8 && !["hybrid", "ev"].includes(fuel)) mismatches.push("is not the most efficient option for someone prioritizing low running cost");
  if (profile.maintenance_cost_priority >= 0.8 && isPremium(item)) mismatches.push("will likely cost more to maintain than a mainstream alternative");
  if (profile.reliability_priority >= 0.8 && !isPremium(item)) reasons.push("leans toward an easier long-term ownership path");
  return { score: safeScore(score), reasons, mismatches, hard_fail: fuel === "ev" && profile.charging_availability === "none" };
}

function buildPerformanceFit(item, profile) {
  const hp = toNumberOrNull(item.power_hp) ?? 160;
  let score = clamp((hp - 110) / 2.2, 20, 96);
  if (profile.performance_priority <= 0.4) score = average([score, 58]);
  if (profile.primary_use_cases?.includes("lifestyle") || profile.personality === "sporty") score += isExotic(item) ? 10 : isPremium(item) ? 5 : 0;
  return { score: safeScore(score), reasons: hp >= 220 ? ["delivers stronger performance than the average mainstream option"] : [], mismatches: hp < 150 && profile.performance_priority >= 0.7 ? ["may feel too mild for the performance priority you described"] : [] };
}

function buildComfortFit(item, profile) {
  const wheelbase = toNumberOrNull(item.wheelbase_mm);
  const body = String(item.body_type || "");
  const premium = isPremium(item) || isExotic(item);
  const score = average([
    premium ? 88 : 68,
    wheelbase != null ? clamp((wheelbase - 2550) / 6, 45, 92) : ["suv", "mpv", "wagon"].includes(body) ? 82 : 65,
    hasFeature(item, "ventilated_seats") || hasFeature(item, "power_tailgate") ? 84 : 66,
  ]);
  return { score: safeScore(score), reasons: premium ? ["feels more polished on comfort and cabin ambience"] : [], mismatches: [] };
}

function buildTechnologyFit(item) {
  const features = ["apple_carplay", "android_auto", "camera_360", "blind_spot_monitor", "adaptive_cruise_control", "lane_keep_assist"].filter((key) => hasFeature(item, key)).length;
  const score = safeScore(48 + features * 8 + (Number(item.model_year || 0) >= new Date().getFullYear() - 1 ? 10 : 0));
  return { score, reasons: features >= 3 ? ["carries a stronger tech stack for daily convenience"] : [], mismatches: [] };
}

function buildSafetyFit(item, profile) {
  const airbags = firstNumericFeature(item, ["airbags_count"]);
  const safetyRating = firstNumericFeature(item, ["safety_rating"]);
  const adasCount = ["blind_spot_monitor", "lane_keep_assist", "adaptive_cruise_control", "automatic_emergency_braking"].filter((key) => hasFeature(item, key)).length;
  let score = average([
    airbags != null ? clamp((airbags - 2) * 12, 35, 92) : 60,
    safetyRating != null ? clamp(safetyRating * 18, 35, 96) : 62,
    52 + adasCount * 12,
  ]);
  if (profile.safety_priority >= 0.8 && adasCount >= 2) score += 8;
  return { score: safeScore(score), reasons: adasCount >= 2 ? ["brings a better active-safety package to the table"] : [], mismatches: profile.safety_priority >= 0.8 && adasCount === 0 ? ["does not stand out on advanced safety assistance"] : [] };
}

function buildBrandEmotionalFit(item, profile) {
  const brand = String(item.make_name || "").toLowerCase();
  let score = 60;
  const reasons = [];
  const mismatches = [];
  if (profile.brand_preferences?.includes(brand)) {
    score += 28;
    reasons.push("comes from a brand you already feel good about");
  }
  if (profile.brand_rejections?.includes(brand)) {
    score = 0;
    mismatches.push("belongs to a brand you explicitly want to avoid");
  }
  if (isPerformanceFirstProfile(profile) && isExoticBrand(item)) {
    score += 20;
    reasons.push("matches the supercar and performance-first direction you described");
  }
  if (profile.style_priority >= 0.7 && (isPremium(item) || isExotic(item))) score += 16;
  if (profile.emotional_motivators?.includes("sporty_identity") && (isExotic(item) || (toNumberOrNull(item.power_hp) ?? 0) >= 220)) score += 14;
  return { score: safeScore(score), reasons, mismatches, hard_fail: profile.brand_rejections?.includes(brand) };
}

function buildTradeoffFit(item, profile) {
  const preferences = profile.tradeoff_preferences ?? [];
  let score = 68;
  if (preferences.includes("space_over_performance")) score += ["suv", "mpv", "wagon"].includes(item.body_type) ? 18 : -12;
  if (preferences.includes("brand_over_features")) score += isPremium(item) ? 16 : -6;
  if (preferences.includes("efficiency_over_performance")) score += ["hybrid", "ev"].includes(item.fuel_type) ? 18 : -10;
  if (preferences.includes("comfort_over_performance")) score += isPremium(item) ? 12 : 0;
  if (preferences.includes("reliability_over_tech")) score += isPremium(item) ? -8 : 10;
  if (preferences.includes("reliability_over_performance")) score += isPremium(item) || isExotic(item) ? -10 : 12;
  if (preferences.includes("performance_over_reliability")) score += (toNumberOrNull(item.power_hp) ?? 0) >= 180 || isPremium(item) ? 14 : -6;
  return { score: safeScore(score), reasons: [], mismatches: [] };
}

function evaluateFeatureHardFilters(item, profile) {
  const missingMustHave = (profile.must_have_features ?? []).filter((feature) => !hasFeature(item, feature));
  return {
    missingMustHave,
    hard_fail: missingMustHave.length > 0,
  };
}

function buildPerformanceFirstBonus(item, profile) {
  if (!isPerformanceFirstProfile(profile)) return null;

  const price = normalizedPrice(item);
  const budget = profile.budget_target ?? profile.budget_ceiling ?? null;
  const hp = toNumberOrNull(item.power_hp) ?? firstNumericFeature(item, ["power_hp"]);
  let value = 0;

  if (isExoticBrand(item)) value += 8;
  if ((hp ?? 0) >= 600) value += 5;
  else if ((hp ?? 0) >= 450) value += 3;

  if (budget != null && budget >= 5_000_000_000 && price != null) {
    const budgetUseRatio = price / budget;
    if (budgetUseRatio >= 0.55) value += 4;
    else if (budgetUseRatio >= 0.35) value += 2;
  }

  return value > 0 ? { label: "performance-first high-budget alignment", value } : null;
}

function weightedScore(fitScores, weights) {
  let total = 0;
  for (const [key, value] of Object.entries(fitScores)) {
    total += (weights[key] ?? 0) * value;
  }
  return total;
}

export function evaluateRecommendationCandidate(item, rawProfile = {}) {
  const profile = normalizePreferenceProfile(rawProfile);
  const budgetFit = buildBudgetFit(item, profile);
  const useCaseFit = buildUseCaseFit(item, profile);
  const sizeFit = buildSizeSpaceFit(item, profile);
  const drivingFit = buildDrivingConditionFit(item, profile);
  const costFit = buildOperatingCostFit(item, profile);
  const performanceFit = buildPerformanceFit(item, profile);
  const comfortFit = buildComfortFit(item, profile);
  const technologyFit = buildTechnologyFit(item, profile);
  const safetyFit = buildSafetyFit(item, profile);
  const brandFit = buildBrandEmotionalFit(item, profile);
  const tradeoffFit = buildTradeoffFit(item, profile);
  const featureFilters = evaluateFeatureHardFilters(item, profile);

  const fit_scores = {
    budget_fit: budgetFit.score,
    use_case_fit: useCaseFit.score,
    size_space_fit: sizeFit.score,
    driving_condition_fit: drivingFit.score,
    operating_cost_fit: costFit.score,
    performance_fit: performanceFit.score,
    comfort_fit: comfortFit.score,
    technology_fit: technologyFit.score,
    safety_fit: safetyFit.score,
    brand_emotional_fit: brandFit.score,
    tradeoff_fit: tradeoffFit.score,
  };

  const hard_fail =
    budgetFit.hard_fail ||
    sizeFit.hard_fail ||
    drivingFit.hard_fail ||
    costFit.hard_fail ||
    brandFit.hard_fail ||
    featureFilters.hard_fail;

  const penalties = [];
  const bonuses = [];
  const performanceFirstBonus = buildPerformanceFirstBonus(item, profile);
  if ((profile.primary_use_cases ?? []).some((useCase) => useCaseScore(useCase, item, profile) >= 88)) bonuses.push({ label: "strong use-case alignment", value: 4 });
  if (profile.brand_preferences?.includes(String(item.make_name || "").toLowerCase())) bonuses.push({ label: "preferred brand match", value: 3 });
  if (performanceFirstBonus) bonuses.push(performanceFirstBonus);
  if (featureFilters.missingMustHave.length > 0) penalties.push({ label: `missing must-have: ${featureFilters.missingMustHave.join(", ")}`, value: 24 });
  if ((profile.parking_constraints === "tight") && ["pickup", "mpv"].includes(item.body_type)) penalties.push({ label: "large footprint for tight parking", value: 8 });
  if (profile.fuel_saving_priority >= 0.8 && isExotic(item)) penalties.push({ label: "running cost mismatch", value: 10 });

  const final_score = safeScore(
    weightedScore(fit_scores, profile.inferred_priority_weights) -
      penalties.reduce((sum, entry) => sum + entry.value, 0) +
      bonuses.reduce((sum, entry) => sum + entry.value, 0) -
      (hard_fail ? 65 : 0)
  );

  const reasonPool = [
    ...budgetFit.reasons,
    ...useCaseFit.reasons,
    ...sizeFit.reasons,
    ...drivingFit.reasons,
    ...costFit.reasons,
    ...performanceFit.reasons,
    ...comfortFit.reasons,
    ...technologyFit.reasons,
    ...safetyFit.reasons,
    ...brandFit.reasons,
  ];
  const mismatchPool = [
    ...budgetFit.mismatches,
    ...sizeFit.mismatches,
    ...drivingFit.mismatches,
    ...costFit.mismatches,
    ...performanceFit.mismatches,
    ...safetyFit.mismatches,
    ...brandFit.mismatches,
    ...featureFilters.missingMustHave.map((feature) => `does not include ${feature.replaceAll("_", " ")}`),
  ];

  return {
    profile,
    fit_scores,
    final_score,
    hard_fail,
    penalties,
    bonuses,
    top_matched_reasons: reasonPool.slice(0, 4),
    top_mismatches: mismatchPool.slice(0, 4),
    best_for: profile.primary_use_cases?.slice(0, 2).map((useCase) => useCase.replaceAll("_", " ")) ?? [],
  };
}

export function scoreRecommendationCandidate(item, profile) {
  return evaluateRecommendationCandidate(item, profile).final_score;
}

export function fitLabel(score) {
  if (score >= 82) return "Excellent fit";
  if (score >= 68) return "Strong fit";
  if (score >= 54) return "Good fit";
  if (score >= 40) return "Partial fit";
  return "Weak fit";
}
