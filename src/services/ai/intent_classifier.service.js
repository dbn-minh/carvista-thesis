import { intentResultSchema } from "./dtos.js";
import { classifyConversationRoute, normalizeConversationText } from "./conversation_orchestrator.service.js";

const KNOWN_COUNTRIES = [
  ["vietnam", "Vietnam"],
  ["viet nam", "Vietnam"],
  ["usa", "United States"],
  ["us", "United States"],
  ["singapore", "Singapore"],
  ["uk", "United Kingdom"],
];

const FOCUS_REFERENCE_PATTERN = /\b(this car|this vehicle|this one|that car|that vehicle|that one|current car|current vehicle|xe nay|xe do|mau nay|mau do)\b/i;
const COMPARE_FOLLOW_UP_PATTERN =
  /\b(which is better|which one is better|which one|better for|best for|cheaper to own|pros and cons|resale|value for money|ownership cost|city driving|long trips|long-distance|comfort first|family of|family use|cargo|practical|fuel economy|plain english|short verdict|smarter buy|should i choose|hidden cost|confidence is lower)\b/i;

function hasCompareContext(context = {}) {
  return Array.isArray(context.compare_variant_ids) && context.compare_variant_ids.filter((value) => Number.isInteger(value)).length >= 2;
}

function extractBudget(message) {
  const normalized = normalizeConversationText(message);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(billion|million|thousand|k|m|ty|ti|trieu|usd|vnd)?/i);
  if (!match) return null;

  const signal = /\b(budget|under|around|about|max|price|gia|duoi|tam|vnd|usd|million|billion|ty|ti|trieu)\b/i.test(normalized);
  if (!signal) return null;

  let amount = Number(String(match[1]).replace(/,/g, "."));
  if (!Number.isFinite(amount)) return null;
  const unit = String(match[2] || "").toLowerCase();
  if (["billion", "ty", "ti"].includes(unit)) amount *= 1_000_000_000;
  if (["million", "m", "trieu"].includes(unit)) amount *= 1_000_000;
  if (["thousand", "k"].includes(unit)) amount *= 1_000;
  return amount;
}

function extractOwnershipYears(message) {
  const normalized = normalizeConversationText(message);
  const match = normalized.match(/(\d+)\s*(year|years|nam)/i);
  return match ? Number(match[1]) : null;
}

function extractAnnualMileage(message) {
  const normalized = normalizeConversationText(message);
  const match = normalized.match(/(\d[\d,.]*)\s*(km|kilometer|kilometres|miles?)\s*(per year|\/year|a year|yearly)?/i);
  if (!match) return null;
  const value = Number(String(match[1]).replace(/[,.]/g, ""));
  if (!Number.isFinite(value)) return null;
  return /mile/i.test(match[2]) ? Math.round(value * 1.60934) : value;
}

function extractCountry(message) {
  const normalized = normalizeConversationText(message);
  const found = KNOWN_COUNTRIES.find(([keyword]) => normalized.includes(keyword));
  return found?.[1] ?? null;
}

function extractVehicleMentions(message, context = {}) {
  const mentions = new Set();
  if (
    typeof context.focus_variant_label === "string" &&
    context.focus_variant_label.trim() &&
    FOCUS_REFERENCE_PATTERN.test(String(message || ""))
  ) {
    mentions.add(context.focus_variant_label.trim());
  }

  const compareParts = String(message || "")
    .split(/\b(?:vs|versus|compare|and|instead of|instead)\b/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const genericPhrase = /\b(this|that|it|car|vehicle|xe nay|xe do|estimate|predict|forecast|tco|compare|help|can you|could you|please)\b/i;
  const vehicleSignal =
    /\b(19\d{2}|20\d{2}|toyota|honda|mazda|ford|bmw|mercedes|benz|audi|vinfast|hyundai|kia|lexus|nissan|tesla|porsche|mitsubishi|suzuki|subaru|volvo|peugeot|byd|isuzu|chevrolet|chevy|land rover|range rover|camry|civic|mazda3|corolla|cx-5|cr-v|accord|model 3|model y|mustang|fortuner|everest|corolla cross|tucson|santa fe|seltos|carnival|x5|320i|c300|glc|q5|a4|nx|es|vf 6|vf 8|seal|atto 3|xpander|terra|forester)\b/i;
  for (const part of compareParts) {
    if (part.length < 4 || !/[a-z]/i.test(part)) continue;
    if (!vehicleSignal.test(part)) continue;
    if (genericPhrase.test(part) && !/\b(19\d{2}|20\d{2})\b/.test(part)) continue;
    mentions.add(part);
  }

  return [...mentions].slice(0, 4);
}

function mapRouteToIntent(route, message, context) {
  const normalized = normalizeConversationText(message);
  const compareContextActive = hasCompareContext(context);

  if (route === "compare") return "compare_car";
  if (
    compareContextActive &&
    ["advisor", "vehicle_question"].includes(route) &&
    COMPARE_FOLLOW_UP_PATTERN.test(normalized)
  ) {
    return "compare_car";
  }
  if (route === "predict_price") {
    return /\b(trend|market|xu huong)\b/i.test(message) ? "market_trend_analysis" : "predict_vehicle_value";
  }
  if (route === "calculate_tco") return "calculate_tco";
  if (route === "vehicle_question") return "vehicle_general_qa";
  if (route === "small_talk") return "small_talk";
  if (route === "off_topic") return "out_of_scope";

  if (context.focus_variant_id && /\b(this car|this vehicle|xe nay)\b/i.test(normalized)) return "vehicle_general_qa";
  return "recommend_car";
}

function buildMissingFields(intent, entities, context) {
  const missing = [];
  if (intent === "compare_car" && entities.vehicles.length < 2 && !context.focus_variant_id && !hasCompareContext(context)) missing.push("vehicles");
  if (intent === "predict_vehicle_value" && entities.vehicles.length < 1 && !context.focus_variant_id) missing.push("vehicle");
  if (intent === "market_trend_analysis" && entities.vehicles.length < 1 && !context.focus_variant_id) missing.push("vehicle");
  if (intent === "calculate_tco") {
    if (entities.country == null && context.market_id == null) missing.push("country");
    if (entities.vehicles.length < 1 && !context.focus_variant_id && entities.budget == null) missing.push("vehicle_or_price");
  }
  if (intent === "recommend_car" && entities.budget == null && !context.advisor_profile?.budget_flexibility) missing.push("budget");
  return missing;
}

export function classifyIntent(message, context = {}) {
  const route = classifyConversationRoute(message, { focus_variant_id: context.focus_variant_id });
  const intent = mapRouteToIntent(route, message, context);
  const entities = {
    vehicles: extractVehicleMentions(message, context),
    country: extractCountry(message) ?? context.country ?? null,
    budget: extractBudget(message) ?? context.budget ?? context.advisor_profile?.budget_max ?? null,
    ownership_period_years: extractOwnershipYears(message) ?? context.ownership_period_years ?? null,
    annual_mileage_km: extractAnnualMileage(message) ?? context.annual_mileage_km ?? null,
    market_id: context.market_id ?? null,
    focus_variant_id: context.focus_variant_id ?? null,
  };

  const missing_fields = buildMissingFields(intent, entities, context);
  const confidence =
    intent === "unknown"
      ? 0.2
      : intent === "small_talk" || intent === "out_of_scope"
        ? 0.9
        : missing_fields.length === 0
          ? 0.82
          : 0.64;

  return intentResultSchema.parse({
    intent,
    confidence,
    entities,
    needs_clarification: missing_fields.length > 0,
    missing_fields,
  });
}
