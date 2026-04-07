import { clamp } from "./_helpers.js";
import { buildConfidence, buildEvidence } from "./contracts.js";
import { mapAiChatErrorToResponse } from "./error_mapper.service.js";
import { orchestrateChatRequest } from "./chat_orchestrator.service.js";
import { classifyIntent } from "./intent_classifier.service.js";
import { logAiEvent } from "./logger.service.js";
import {
  ADVISOR_DISCOVERY_QUESTIONS,
  buildProfileSnapshot as buildAdvisorProfileSnapshot,
  countAnsweredProfileQuestions,
  extractAdvisorProfilePatch as extractAdvisorProfilePatchFromProfile,
  getQuestionByKey,
  mergePreferenceProfiles,
  pickNextDiscoveryQuestion as pickNextDiscoveryQuestionFromProfile,
  pickNextDiscoveryQuestions as pickNextDiscoveryQuestionsFromProfile,
} from "./advisor_profile.service.js";
import {
  buildActiveTopic,
  buildConversationState,
  classifyConversationTurn,
  isShortClarificationReply,
  pruneConversationContext,
} from "./conversation_state.service.js";

const PROFILE_QUESTIONS = ADVISOR_DISCOVERY_QUESTIONS;

const QUESTION_BY_KEY = Object.fromEntries(PROFILE_QUESTIONS.map((item) => [item.key, getQuestionByKey(item.key) ?? item]));
const REQUIRED_QUESTION_KEYS = PROFILE_QUESTIONS.filter((item) => item.required).map((item) => item.key);
const OPTIONAL_QUESTION_KEYS = PROFILE_QUESTIONS.filter((item) => !item.required).map((item) => item.key);

const WORD_NUMBERS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["mot", 1],
  ["hai", 2],
  ["ba", 3],
  ["bon", 4],
  ["tu", 4],
  ["nam", 5],
  ["sau", 6],
  ["bay", 7],
  ["tam", 8],
  ["chin", 9],
  ["muoi", 10],
  ["solo", 1],
  ["single", 1],
  ["couple", 2],
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(text, term) {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function setIfPresent(target, key, value) {
  if (value != null) target[key] = value;
}

function parseFlexibleNumber(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) {
    const numeric = Number(value.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) {
    const numeric = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(numeric) ? numeric : null;
  }

  const normalized = value.replace(/,/g, ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCompactMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  if (amount >= 1_000_000_000) {
    const billions = amount / 1_000_000_000;
    return `${billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1)} billion VND`;
  }
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)} million VND`;
  }
  if (amount >= 1_000) {
    const thousands = amount / 1_000;
    return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)} thousand`;
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function humanizeQuestionKey(key) {
  const map = {
    primary_use_cases: "Main use case",
    budget_range: "Budget range",
    passenger_setup: "Passenger and seating needs",
    driving_conditions: "Driving conditions",
    top_priorities: "Top priorities",
    tradeoff_preferences: "Trade-off preference",
    preferred_body_types: "Body style preference",
    preferred_fuel_types: "Fuel preference",
    brand_preferences: "Brand preference",
    must_have_features: "Must-have features",
    buying_timeline: "Buying timeline",
  };

  return map[key] || key;
}

function detectIntent(message) {
  const normalized = normalizeText(message);

  if (includesAny(normalized, ["compare", " versus ", " vs ", "so sanh"])) return "compare";
  if (includesAny(normalized, ["predict", "forecast", "future price", "du doan", "xu huong"])) {
    return "predict_price";
  }
  if (includesAny(normalized, ["tco", "ownership cost", "tax", "insurance", "maintenance", "lan banh"])) {
    return "calculate_tco";
  }
  if (includesAny(normalized, ["sell my car", "sell", "listing", "dang ban"])) return "sell_guidance";

  return "advisor";
}

function extractVariantIds(message) {
  const raw = String(message || "");
  const match = raw.match(/\[(\s*\d+\s*(,\s*\d+\s*)+)\]/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed) && parsed.every((item) => Number.isFinite(Number(item)))) {
      return parsed.map((item) => Number(item));
    }
  } catch {
    return null;
  }

  return null;
}

function extractBudget(message) {
  const normalized = normalizeText(message);

  const hasBudgetSignal =
    /\b(budget|price|cost|under|around|about|max|gia|duoi|tam|vnd|usd|dollar|dollars|ty|ti|trieu|million|billion|thousand|grand)\b/i.test(
      normalized
    ) ||
    /\$/.test(normalized) ||
    /\d+(?:[.,]\d+)?\s*(billion|bn|bil|million|m|thousand|k|grand|ty|ti|trieu|usd|vnd)\b/i.test(normalized);

  if (!hasBudgetSignal) {
    return null;
  }

  const match = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(billion|bn|bil|b|million|m|thousand|k|grand|ty|ti|trieu|usd|vnd|dong|\$)?/i
  );
  if (!match) return null;

  let amount = parseFlexibleNumber(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = String(match[2] || "").toLowerCase();
  if (["billion", "bn", "bil", "b", "ty", "ti"].includes(unit)) amount *= 1_000_000_000;
  if (["million", "m", "trieu"].includes(unit)) amount *= 1_000_000;
  if (["thousand", "k", "grand"].includes(unit)) amount *= 1_000;
  if (!unit && amount < 10_000) return null;

  return amount;
}

function extractEnvironment(message) {
  const normalized = normalizeText(message);

  if (includesAny(normalized, ["mixed", "both", "suburb", "suburban", "city and highway", "city + highway", "hon hop", "ca hai"])) {
    return "mixed";
  }
  if (includesAny(normalized, ["rural", "countryside", "country road", "village", "farm", "mountain road", "nong thon", "que"])) {
    return "rural";
  }
  if (includesAny(normalized, ["city", "urban", "downtown", "traffic", "commute", "thanh pho", "do thi", "noi thanh", "saigon", "hanoi", "tphcm", "hcm"])) {
    return "city";
  }

  return null;
}

function extractLongTripHabit(message) {
  const normalized = normalizeText(message);

  if (
    includesAny(normalized, [
      "not really",
      "rarely",
      "hardly ever",
      "almost never",
      "seldom",
      "not often",
      "once or twice a year",
      "a few times a year",
      "it khi",
      "hiem khi",
      "khong thuong",
      "khong nhieu",
      "short trips only",
      "city use only",
      "mostly short",
      "chi di gan",
      "chi trong thanh pho",
    ])
  ) {
    return "rare";
  }
  if (
    includesAny(normalized, [
      "sometimes",
      "occasionally",
      "once in a while",
      "from time to time",
      "depends",
      "every few months",
      "every month",
      "monthly",
      "once a month",
      "twice a month",
      "thinh thoang",
      "doi luc",
      "mot vai lan",
    ])
  ) {
    return "occasional";
  }
  if (includesAny(normalized, ["yes", "yeah", "yep", "often", "frequent", "regularly", "every weekend", "every week", "road trip", "long drive", "highway a lot", "go far often", "hay", "thuong xuyen", "cuoi tuan nao cung"])) {
    return "frequent";
  }
  if (normalized === "no" || normalized === "nah") return "rare";
  if (normalized === "yes" || normalized === "sure") return "frequent";

  return null;
}

function wordToNumber(token) {
  if (!token) return null;
  if (/^\d+$/.test(token)) return Number(token);
  return WORD_NUMBERS.get(token) ?? null;
}

function extractPassengerCount(message) {
  const normalized = normalizeText(message);

  if (includesAny(normalized, ["just me", "myself", "only me", "solo"])) return 1;
  if (includesAny(normalized, ["me and my wife", "me and my husband", "me and my partner", "couple"])) return 2;
  if (includesAny(normalized, ["small family"])) return 4;
  if (includesAny(normalized, ["big family", "extended family"])) return 6;

  const familyOf = normalized.match(/family of (\d+|one|two|three|four|five|six|seven|eight|nine|ten)/);
  if (familyOf) {
    const count = wordToNumber(familyOf[1]);
    if (count != null) return count;
  }

  const matches = [...normalized.matchAll(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(people|person|passengers|passenger|adults|adult|kids|kid|children|child|nguoi)/g)];
  const partnerCount = includesAny(normalized, ["wife", "husband", "partner", "spouse"]) ? 1 : 0;
  const childMatches = [...normalized.matchAll(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(kids|kid|children|child|be|con)/g)];
  if (partnerCount > 0 && childMatches.length > 0) {
    const children = childMatches.reduce((sum, match) => sum + (wordToNumber(match[1]) ?? 0), 0);
    if (children > 0) return 1 + partnerCount + children;
  }

  if (matches.length >= 2) {
    const total = matches.reduce((sum, match) => sum + (wordToNumber(match[1]) ?? 0), 0);
    if (total > 0) return total;
  }
  if (matches.length === 1) {
    const count = wordToNumber(matches[0][1]);
    if (count != null) return count;
  }

  const weAre = normalized.match(/(?:we are|we re|for|there are|co)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/);
  if (weAre) {
    const count = wordToNumber(weAre[1]);
    if (count != null) return count;
  }

  if (childMatches.length > 0) {
    const children = childMatches.reduce((sum, match) => sum + (wordToNumber(match[1]) ?? 0), 0);
    if (children > 0) return 1 + partnerCount + children;
  }

  return null;
}

function extractBodyTypePreference(message) {
  const normalized = normalizeText(message);

  if (includesAny(normalized, ["no preference", "no strong preference", "anything is fine", "open to anything", "bat ky", "gi cung duoc", "khong quan trong"])) {
    return "any";
  }

  const options = [
    ["crossover", "cuv"],
    ["cuv", "cuv"],
    ["suv", "suv"],
    ["sedan", "sedan"],
    ["hatchback", "hatchback"],
    ["mpv", "mpv"],
    ["minivan", "mpv"],
    ["pickup", "pickup"],
    ["truck", "pickup"],
    ["coupe", "coupe"],
    ["wagon", "wagon"],
  ];

  for (const [keyword, value] of options) {
    if (normalized.includes(keyword)) return value;
  }

  return null;
}

function extractFuelPreference(message) {
  const normalized = normalizeText(message);

  if (includesAny(normalized, ["no preference", "no strong preference", "anything is fine", "open to anything", "gi cung duoc", "khong quan trong"])) {
    return "any";
  }

  const options = [
    ["plug in hybrid", "phev"],
    ["plug-in hybrid", "phev"],
    ["phev", "phev"],
    ["hybrid", "hybrid"],
    ["electric", "ev"],
    ["ev", "ev"],
    ["bev", "ev"],
    ["diesel", "diesel"],
    ["petrol", "gasoline"],
    ["gasoline", "gasoline"],
    ["gas car", "gasoline"],
  ];

  for (const [keyword, value] of options) {
    if (containsTerm(normalized, keyword)) return value;
  }

  return null;
}

function extractFavoriteColor(message) {
  const normalized = normalizeText(message);
  const colors = ["black", "white", "silver", "gray", "grey", "blue", "red", "green", "yellow"];
  const color = colors.find((value) => normalized.includes(value));
  return color === "grey" ? "gray" : color ?? null;
}

function extractPersonality(message) {
  const normalized = normalizeText(message);
  const mapping = [
    ["sporty", "sporty"],
    ["performance", "sporty"],
    ["calm", "calm"],
    ["practical", "practical"],
    ["family", "family"],
    ["luxury", "premium"],
    ["premium", "premium"],
  ];

  for (const [keyword, value] of mapping) {
    if (normalized.includes(keyword)) return value;
  }

  return null;
}

function extractNewVsUsed(message) {
  const normalized = normalizeText(message);
  if (includesAny(normalized, ["either", "both are fine", "open to both", "open to either", "ca hai deu duoc"])) {
    return "either";
  }
  if (includesAny(normalized, ["used", "pre owned", "pre-owned", "second hand", "xe luot", "xe cu"])) {
    return "used";
  }
  if (includesAny(normalized, ["new", "brand new", "xe moi"])) {
    return "new";
  }
  return null;
}

function extractMaintenanceSensitivity(message) {
  const normalized = normalizeText(message);
  if (includesAny(normalized, ["very sensitive", "low maintenance", "cheap to maintain", "simple ownership", "avoid repair", "it bao duong", "de nuoi"])) {
    return "high";
  }
  if (includesAny(normalized, ["somewhat sensitive", "balanced", "normal maintenance", "khong qua ngat ngheo"])) {
    return "medium";
  }
  if (includesAny(normalized, ["dont mind maintenance", "don't mind maintenance", "ok with maintenance", "willing to maintain", "chap nhan bao duong", "khong ngai chi phi"])) {
    return "low";
  }
  return null;
}

function extractBrandOpenness(message) {
  const normalized = normalizeText(message);
  if (includesAny(normalized, ["open to any brand", "no brand preference", "any brand is fine", "thuong hieu nao cung duoc", "khong co thuong hieu yeu thich"])) {
    return "open";
  }
  if (includesAny(normalized, ["only", "prefer", "shortlist", "nhat dinh", "uu tien"])) {
    return "shortlist";
  }
  return null;
}

function extractAnswerForQuestion(questionKey, message) {
  switch (questionKey) {
    case "budget_max":
      return extractBudget(message);
    case "environment":
      return extractEnvironment(message);
    case "long_trip_habit":
      return extractLongTripHabit(message);
    case "passenger_count":
      return extractPassengerCount(message);
    case "preferred_body_type":
      return extractBodyTypePreference(message);
    case "preferred_fuel_type":
      return extractFuelPreference(message);
    case "new_vs_used":
      return extractNewVsUsed(message);
    case "maintenance_sensitivity":
      return extractMaintenanceSensitivity(message);
    case "brand_openness":
      return extractBrandOpenness(message);
    default:
      return null;
  }
}

function extractAdvisorProfilePatch(message, expectedQuestionKey = null, currentProfile = {}) {
  return extractAdvisorProfilePatchFromProfile(message, expectedQuestionKey, currentProfile);
}

function nextAdvisorQuestion(profile, mode = "required") {
  const candidates = (mode === "required" ? REQUIRED_QUESTION_KEYS : OPTIONAL_QUESTION_KEYS)
    .map((key) => QUESTION_BY_KEY[key])
    .filter(Boolean);
  return pickNextDiscoveryQuestionFromProfile(profile, candidates, mode);
}

function nextAdvisorQuestions(profile, mode = "required", limit = 3) {
  const candidates = (mode === "required" ? REQUIRED_QUESTION_KEYS : OPTIONAL_QUESTION_KEYS)
    .map((key) => QUESTION_BY_KEY[key])
    .filter(Boolean);
  return pickNextDiscoveryQuestionsFromProfile(profile, candidates, mode, limit);
}

function mergeAdvisorProfile(currentProfile, patch) {
  return mergePreferenceProfiles(currentProfile, patch);
}

function countAnsweredQuestions(profile) {
  return countAnsweredProfileQuestions(profile);
}

function buildProfileSnapshot(profile) {
  return buildAdvisorProfileSnapshot(profile);
}

function wantsTemporaryShortlist(message) {
  const normalized = normalizeText(message);
  return /\b(no more questions|dont ask|don't ask|stop asking|just recommend|give me a shortlist|temporary shortlist|shortlist tam|goi y tam|tam thoi|dung hoi nhieu|khong hoi nhieu|khong muon tra loi nhieu)\b/.test(normalized);
}

function hasDirectionalShortlistProfile(profile = {}) {
  return (
    countAnsweredQuestions(profile) >= 2 &&
    Boolean(
      profile.budget_max ||
        profile.budget_target ||
        profile.budget_ceiling ||
        profile.primary_use_cases?.length ||
        profile.regular_passenger_count ||
        profile.passenger_count ||
        profile.city_vs_highway_ratio ||
        profile.preferred_body_type ||
        profile.preferred_fuel_type
    )
  );
}

function buildQuestionPrompt(question) {
  if (!question) return "";
  return `${question.question} You can answer with something like ${question.examples.map((item) => `"${item}"`).join(", ")}.`;
}

function normalizeQuestionList(questionOrQuestions) {
  if (!questionOrQuestions) return [];
  return Array.isArray(questionOrQuestions) ? questionOrQuestions.filter(Boolean) : [questionOrQuestions];
}

function buildQuestionListPrompt(questionOrQuestions) {
  const questions = normalizeQuestionList(questionOrQuestions).slice(0, 4);
  if (questions.length === 0) return "";
  if (questions.length === 1) return buildQuestionPrompt(questions[0]);

  const numbered = questions.map((question, index) => `${index + 1}. ${question.question}`).join(" ");
  return `I still need a few details before recommending cars responsibly: ${numbered} You can answer all of them in one short message.`;
}

function buildProfileProgressCards(profile, nextQuestion) {
  const nextQuestions = normalizeQuestionList(nextQuestion).slice(0, 4);
  return [
    {
      title: "Profile so far",
      value: `${countAnsweredQuestions(profile)} answers saved`,
      description: buildProfileSnapshot(profile),
    },
    ...nextQuestions.map((question, index) => ({
      title: nextQuestions.length === 1 ? "Still needed" : `Still needed ${index + 1}`,
      value: humanizeQuestionKey(question.key),
      description: buildQuestionPrompt(question),
    })),
  ].filter(Boolean);
}

function buildRecommendationReason(item, profile) {
  const reasons = [];
  if (profile?.preferred_body_type && profile.preferred_body_type !== "any" && item.body_type === profile.preferred_body_type) {
    reasons.push(`matches your preferred ${profile.preferred_body_type} body style`);
  }
  if (profile?.preferred_fuel_type && profile.preferred_fuel_type !== "any" && item.fuel_type === profile.preferred_fuel_type) {
    reasons.push(`fits your ${profile.preferred_fuel_type} preference`);
  }
  if (profile?.environment === "city" && ["sedan", "hatchback", "cuv"].includes(item.body_type)) {
    reasons.push("works well for city driving");
  }
  if (profile?.environment === "rural" && ["suv", "pickup", "mpv"].includes(item.body_type)) {
    reasons.push("suits rougher or mixed road conditions");
  }
  if (profile?.long_trip_habit === "frequent" && ["hybrid", "diesel", "gasoline"].includes(item.fuel_type)) {
    reasons.push("is practical for frequent longer trips");
  }
  if (profile?.long_trip_habit === "rare" && ["ev", "hybrid", "gasoline"].includes(item.fuel_type)) {
    reasons.push("fits a mostly local driving pattern");
  }
  if ((profile?.passenger_count ?? 0) >= 6 && Number(item.seats) >= 6) {
    reasons.push("can handle your usual passenger count");
  }
  if (profile?.personality === "sporty" && ["sedan", "coupe"].includes(item.body_type)) {
    reasons.push("leans more toward a sporty feel");
  }
  if (profile?.personality === "family" && ["suv", "mpv"].includes(item.body_type)) {
    reasons.push("leans more toward family comfort and space");
  }

  return reasons.slice(0, 3);
}

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

  if (profile?.preferred_body_type && profile.preferred_body_type !== "any" && item.body_type === profile.preferred_body_type) {
    score += 18;
  }
  if (profile?.preferred_fuel_type && profile.preferred_fuel_type !== "any" && item.fuel_type === profile.preferred_fuel_type) {
    score += 14;
  }

  if (
    profile?.environment === "city" &&
    (["sedan", "hatchback", "cuv"].includes(item.body_type) || ["hybrid", "ev"].includes(item.fuel_type))
  ) {
    score += 10;
  }
  if (
    profile?.environment === "rural" &&
    (["suv", "pickup", "mpv"].includes(item.body_type) || ["gasoline", "hybrid", "diesel"].includes(item.fuel_type))
  ) {
    score += 10;
  }
  if (profile?.long_trip_habit === "frequent" && ["gasoline", "diesel", "hybrid"].includes(item.fuel_type)) {
    score += 8;
  }
  if (profile?.long_trip_habit === "occasional" && ["hybrid", "gasoline", "ev"].includes(item.fuel_type)) {
    score += 4;
  }
  if (profile?.long_trip_habit === "rare" && ["ev", "hybrid", "gasoline"].includes(item.fuel_type)) {
    score += 6;
  }

  if ((profile?.passenger_count ?? 0) >= 6 && Number(item.seats) >= 6) score += 12;
  if ((profile?.passenger_count ?? 0) <= 4 && Number(item.seats) <= 5) score += 4;

  if (profile?.personality === "sporty" && ["sedan", "coupe"].includes(item.body_type)) score += 8;
  if (profile?.personality === "family" && ["suv", "mpv"].includes(item.body_type)) score += 8;
  if (profile?.personality === "practical" && ["suv", "cuv", "mpv", "pickup"].includes(item.body_type)) score += 8;

  return score;
}

async function recommendVariants(ctx, profile, market_id) {
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

  const [rows] = await ctx.sequelize.query(sql, { replacements: { market_id: market_id ?? 1 } });

  return rows
    .map((row) => {
      const score = scoreRecommendation(row, profile);
      const reasons = buildRecommendationReason(row, profile);
      return {
        ...row,
        score,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function buildRecommendationCards(recommendations, profile) {
  const profileCard = {
    title: "Your profile",
    value: `${countAnsweredQuestions(profile)} answers used`,
    description: buildProfileSnapshot(profile),
  };

  const vehicleCards = recommendations.map((item) => ({
    title: `${item.make_name} ${item.model_name} ${item.trim_name}`,
    value: item.latest_price || item.msrp_base || "Price pending",
    description:
      item.reasons.length > 0
        ? item.reasons.join(", ")
        : "This variant scored well for your profile even though the structured reasons are limited.",
  }));

  return [profileCard, ...vehicleCards];
}

async function loadFocusedVariant(ctx, variant_id, market_id) {
  if (!Number.isInteger(variant_id)) return null;

  const sql = `
    SELECT
      cv.variant_id,
      cv.model_year,
      cv.trim_name,
      cv.body_type,
      cv.fuel_type,
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
    WHERE cv.variant_id = :variant_id
    LIMIT 1
  `;

  const [rows] = await ctx.sequelize.query(sql, {
    replacements: {
      market_id: market_id ?? 1,
      variant_id,
    },
  });

  const variant = rows[0] ?? null;
  if (!variant) return null;

  return {
    ...variant,
    label: [variant.model_year, variant.make_name, variant.model_name, variant.trim_name]
      .filter(Boolean)
      .join(" "),
  };
}

function buildClarificationAnswer(question, profile) {
  const snapshot = buildProfileSnapshot(profile);
  return `I want to make sure I understood your last reply correctly. Right now I know ${snapshot}. ${buildQuestionListPrompt(question)}`;
}

function buildProgressAnswer(profile, nextQuestion) {
  const snapshot = buildProfileSnapshot(profile);
  return `Got it. So far I understand ${snapshot}. ${buildQuestionListPrompt(nextQuestion)}`;
}

function buildRecommendationAnswer(recommendations, profile, nextOptionalQuestion) {
  const [top, second] = recommendations;
  const topLabel = `${top.make_name} ${top.model_name} ${top.trim_name}`.trim();
  const reasons =
    top.reasons.length > 0 ? top.reasons.join(", ") : "matches the driving profile you shared";
  const summary = `Based on what you told me, ${topLabel} looks like the best fit right now because it ${reasons}.`;
  const contrast = second
    ? `A close alternative is ${`${second.make_name} ${second.model_name} ${second.trim_name}`.trim()}, especially if you want a slightly different balance between price and practicality.`
    : "";
  const optionalPrompt = nextOptionalQuestion
    ? `If you want me to refine this further, tell me your ${humanizeQuestionKey(nextOptionalQuestion.key).toLowerCase()}.`
    : "If you want, I can also compare it against another car or break down the ownership cost.";

  return [summary, contrast, optionalPrompt].filter(Boolean).join(" ");
}

function formatCardValue(value, currency = "") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return typeof value === "string" ? value : null;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric)}${
    currency ? ` ${currency}` : ""
  }`;
}

function compactInsight(value, maxLength = 88) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[|]+/g, ", ");
  if (!text) return null;
  const normalized = text.replace(/[.]+$/g, "");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildCardsFromStructuredResult(intent, structuredResult, advisor_profile, nextQuestion = null) {
  if (!structuredResult) {
    return intent === "recommend_car" ? buildProfileProgressCards(advisor_profile, nextQuestion) : [];
  }

  if (intent === "compare_car") {
    const verdictCard =
      structuredResult.recommendation?.winner || structuredResult.recommendation?.reason
        ? {
            title: "Verdict",
            value: structuredResult.recommendation?.winner || "Comparison ready",
            description:
              compactInsight(structuredResult.recommendation?.reason) ||
              "Use this as the main decision anchor.",
          }
        : null;

    const vehicleCards = (structuredResult.vehicles ?? []).map((vehicle) => ({
      title: vehicle.name,
      value: null,
      description: [
        vehicle.pros?.length ? `Strength: ${compactInsight(vehicle.pros[0])}` : null,
        vehicle.cons?.length ? `Watch-out: ${compactInsight(vehicle.cons[0])}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    }));

    return [verdictCard, ...vehicleCards].filter(Boolean);
  }

  if (intent === "predict_vehicle_value") {
    const range = structuredResult.current_fair_value_range;
    return [
      {
        title: "Fair value",
        value: range?.midpoint != null ? formatCardValue(range.midpoint, range.currency) : "Estimate limited",
        description:
          range?.min != null && range?.max != null
            ? `Likely range: ${formatCardValue(range.min, range.currency)} to ${formatCardValue(range.max, range.currency)}`
            : "A wider market band is not available yet.",
      },
      ...(structuredResult.factors ?? []).slice(0, 2).map((factor, index) => ({
        title: `Value driver ${index + 1}`,
        value: "Pricing signal",
        description: factor,
      })),
    ];
  }

  if (intent === "market_trend_analysis") {
    const range = structuredResult.forecast_range;
    return [
      {
        title: "Forecast",
        value: range?.midpoint != null ? formatCardValue(range.midpoint, range.currency) : "Forecast limited",
        description:
          range?.min != null && range?.max != null
            ? `Projected band: ${formatCardValue(range.min, range.currency)} to ${formatCardValue(range.max, range.currency)}`
            : "The market direction is available, but the range is still weak.",
      },
      structuredResult.scarcity_signal
        ? {
            title: "Scarcity",
            value: structuredResult.scarcity_signal,
            description: "This signal affects how resilient the vehicle may be in the market.",
          }
        : null,
      ...(structuredResult.factors ?? []).slice(0, 2).map((factor, index) => ({
        title: `Market factor ${index + 1}`,
        value: "Trend signal",
        description: factor,
      })),
    ].filter(Boolean);
  }

  if (intent === "calculate_tco") {
    const totals = structuredResult.totals ?? {};
    return [
      {
        title: "Ownership total",
        value: totals.total != null ? formatCardValue(totals.total, totals.currency) : "Estimate limited",
        description: `${totals.ownership_years ?? 0} year estimate`,
      },
      {
        title: "Monthly estimate",
        value: totals.monthly_average != null ? formatCardValue(totals.monthly_average, totals.currency) : "Unavailable",
        description: "Average monthly ownership spend",
      },
      {
        title: "One-time costs",
        value:
          structuredResult.one_time_costs?.base_price != null
            ? formatCardValue(structuredResult.one_time_costs.base_price, totals.currency)
            : "Unavailable",
        description: "Vehicle price before recurring running costs",
      },
    ];
  }

  if (intent === "vehicle_general_qa") {
    return (structuredResult.highlights ?? []).slice(0, 3).map((highlight, index) => ({
      title: index === 0 ? "Quick answer" : `Key point ${index + 1}`,
      value: structuredResult.topic || "Vehicle knowledge",
      description: highlight,
    }));
  }

  if (intent === "recommend_car") {
    const profileCard = {
      title: "Buyer profile",
      value: `${countAnsweredQuestions(advisor_profile)} answers saved`,
      description: buildProfileSnapshot(advisor_profile),
    };
    const vehicleCards = (structuredResult.ranked_vehicles ?? []).map((item) => ({
      title: item.name,
      value: `Score ${item.score.toFixed(1)}`,
      description: [
        item.reasons?.length > 0
          ? item.reasons.join(", ")
          : "This car still ranks well, but the structured reasons are limited.",
        item.caveats?.length > 0 ? `Watch-out: ${compactInsight(item.caveats[0])}` : "Watch-out: verify trim-level equipment before deciding.",
        item.best_for?.length > 0 ? `Best for: ${item.best_for.join(", ")}` : "Best for: buyers with the same practical profile.",
        item.links?.detail_page_url ? "Open the vehicle detail page to review specs and ownership insights." : null,
        item.links?.related_listings_url
          ? item.links.related_listings_count > 0
            ? `${item.links.related_listings_count} related listing(s) are available right now.`
            : "No exact listing is live yet, but the closest browse path is ready."
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    }));

    return [profileCard, ...vehicleCards].filter(Boolean);
  }

  return [];
}

function buildSuggestedActions(intent, structuredResult, { market_id, focus_variant_id, nextOptionalQuestion, needs_clarification }) {
  if (needs_clarification) {
    if (intent === "compare_car" && Number.isInteger(focus_variant_id)) {
      return [{ type: "open_compare_modal", payload: { variant_id: focus_variant_id } }];
    }
    if (intent === "recommend_car" && nextOptionalQuestion) {
      return [{ type: "continue_profile", payload: { question_key: nextOptionalQuestion.key } }];
    }
    return [];
  }

  if (intent === "compare_car" && (structuredResult?.vehicles ?? []).length >= 2) {
    const variant_ids = structuredResult.vehicles
      .map((vehicle) => vehicle.variant_id)
      .filter((value) => Number.isInteger(value));
    return variant_ids.length >= 2 ? [{ type: "compare_variants", payload: { variant_ids, market_id } }] : [];
  }

  if (intent === "predict_vehicle_value" && Number.isInteger(structuredResult?.variant_id)) {
    return [{ type: "predict_price", payload: { variant_id: structuredResult.variant_id, market_id, horizon_months: 6 } }];
  }

  if (intent === "market_trend_analysis" && Number.isInteger(structuredResult?.variant_id)) {
    return [
      {
        type: "predict_price",
        payload: { variant_id: structuredResult.variant_id, market_id, horizon_months: structuredResult.horizon_months },
      },
    ];
  }

  if (intent === "calculate_tco") {
    return [
      {
        type: "calculate_tco",
        payload: {
          market_id,
          variant_id: focus_variant_id ?? null,
          ownership_years: structuredResult?.totals?.ownership_years ?? 5,
        },
      },
    ];
  }

  if (intent === "vehicle_general_qa" && Number.isInteger(focus_variant_id)) {
    return [{ type: "open_compare_modal", payload: { variant_id: focus_variant_id } }];
  }

  if (intent === "recommend_car" && structuredResult?.ranked_vehicles?.[0]) {
    const top = structuredResult.ranked_vehicles[0];
    return [
      top.links?.detail_page_url
        ? {
            type: "open_vehicle_detail",
            payload: {
              url: top.links.detail_page_url,
              label: `Open ${top.name}`,
              variant_id: top.variant_id ?? null,
            },
          }
        : null,
      top.links?.related_listings_url
        ? {
            type: "open_related_listings",
            payload: {
              url: top.links.related_listings_url,
              label:
                top.links.related_listings_count > 0
                  ? `Browse ${top.links.related_listings_count} matching listing(s)`
                  : "Browse related listings",
              related_listing_ids: top.links.related_listing_ids,
            },
          }
        : null,
      structuredResult.ranked_vehicles[1]?.links?.detail_page_url
        ? {
            type: "open_vehicle_detail",
            payload: {
              url: structuredResult.ranked_vehicles[1].links.detail_page_url,
              label: `See alternative: ${structuredResult.ranked_vehicles[1].name}`,
              variant_id: structuredResult.ranked_vehicles[1].variant_id ?? null,
            },
          }
        : null,
    ].filter(Boolean);
  }

  if (intent === "recommend_car" && nextOptionalQuestion) {
    return [{ type: "continue_profile", payload: { question_key: nextOptionalQuestion.key } }];
  }

  return [];
}

function buildFactsUsed(intent, structuredResult, market_id) {
  if (intent === "compare_car") {
    return (structuredResult?.vehicles ?? [])
      .map((vehicle) => vehicle.variant_id)
      .filter((value) => Number.isInteger(value))
      .map((id) => ({ source: "car_variants", id }));
  }

  if ((intent === "predict_vehicle_value" || intent === "market_trend_analysis") && Number.isInteger(structuredResult?.variant_id)) {
    return [{ source: "variant_price_history", id: structuredResult.variant_id }, { source: "market", id: market_id }];
  }

  if (intent === "vehicle_general_qa" && Number.isInteger(structuredResult?.variant_id)) {
    return [{ source: "car_variants", id: structuredResult.variant_id }];
  }

  if (intent === "recommend_car") {
    return (structuredResult?.ranked_vehicles ?? [])
      .map((vehicle) => vehicle.variant_id)
      .filter((value) => Number.isInteger(value))
      .map((id) => ({ source: "car_variants", id }));
  }

  return [];
}

function buildFollowUpQuestions(intent, structuredResult, { focus_variant_id, nextOptionalQuestion, needs_clarification, missing_fields = [] }) {
  if (needs_clarification) {
    if (intent === "compare_car") {
      return [
        focus_variant_id != null
          ? "Which second vehicle would you like to compare against the current one?"
          : "Which two vehicles should I compare for you?",
      ];
    }
    if (intent === "predict_vehicle_value" || intent === "market_trend_analysis") {
      return ["Which vehicle should I analyze? You can open a detail page or name the make, model, and year."];
    }
    if (intent === "calculate_tco") {
      if (missing_fields.includes("country")) {
        return ["Which country or market should I use for the ownership-cost estimate?"];
      }
      return ["What vehicle or base purchase price should I use for the ownership-cost estimate?"];
    }
  }

  if (intent === "compare_car") {
    return ["Want me to estimate TCO or forecast value for the winner next?"];
  }
  if (intent === "predict_vehicle_value") {
    return ["Want me to look at the future price trend or compare this car against another option?"];
  }
  if (intent === "market_trend_analysis") {
    return ["Want me to turn that trend into a buying recommendation or compare it to another car?"];
  }
  if (intent === "calculate_tco") {
    return ["Want me to compare the ownership cost against another vehicle or a different ownership period?"];
  }
  if (intent === "vehicle_general_qa" && focus_variant_id != null) {
    return ["Want me to compare this vehicle, forecast its value, or estimate ownership cost next?"];
  }
  if (intent === "recommend_car" && nextOptionalQuestion) {
    return [nextOptionalQuestion.question];
  }
  if (intent === "recommend_car") {
    return [
      "Want me to narrow this down by comfort, ownership cost, or family use?",
      "Want me to compare the top two options side by side?",
    ];
  }
  return ["If you want, I can help with car comparison, price outlook, or ownership costs next."];
}

function createFlowId() {
  return `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function extractRecommendationFocus(structuredResult) {
  const top = structuredResult?.ranked_vehicles?.[0] ?? null;
  if (!top) return { focus_variant_id: null, focus_variant_label: null };
  return {
    focus_variant_id: Number.isInteger(top.variant_id) ? top.variant_id : null,
    focus_variant_label: typeof top.name === "string" && top.name ? top.name : null,
  };
}

function collectCompareVariantIds(intent, structuredResult, contextUpdates = {}, fallback = []) {
  const contextVariantIds = Array.isArray(contextUpdates?.compare_variant_ids)
    ? contextUpdates.compare_variant_ids.filter((value) => Number.isInteger(value))
    : [];
  if (contextVariantIds.length > 0) return contextVariantIds.slice(0, 5);
  if (intent === "compare_car") {
    const resultVariantIds = (structuredResult?.vehicles ?? [])
      .map((vehicle) => vehicle.variant_id)
      .filter((value) => Number.isInteger(value));
    if (resultVariantIds.length > 0) return resultVariantIds.slice(0, 5);
  }
  return Array.isArray(fallback) ? fallback.filter((value) => Number.isInteger(value)).slice(0, 5) : [];
}

function buildPendingFlow({ id, intent, missing_fields = [], context_snapshot = {}, source = "service_validation" }) {
  return {
    id,
    intent,
    status: "clarifying",
    missing_fields,
    source,
    created_at: new Date().toISOString(),
    context_snapshot,
  };
}

function shouldBindPendingFlow(message, pendingFlow, previewIntent, transition, hasVehicleMentions = false) {
  if (!pendingFlow?.intent) return false;
  if (transition && typeof transition.bind_pending_flow === "boolean") return transition.bind_pending_flow;
  if (isShortClarificationReply(message)) return true;
  if (hasVehicleMentions) return true;
  if (previewIntent === pendingFlow.intent) return true;
  return false;
}

function buildAmbiguousTurnPayload({
  session_id,
  flow_id,
  advisor_profile,
  market_id,
  pendingFlow = null,
  activeTopic = null,
  turn,
}) {
  const answer =
    pendingFlow?.missing_fields?.includes("vehicles") || activeTopic?.intent === "compare_car"
      ? "I'm not fully sure which car you mean yet. Tell me the vehicle name directly, or open the vehicle detail page first so I can stay grounded."
      : pendingFlow?.missing_fields?.includes("country")
        ? "I still need the country or market for that estimate. A short answer like 'Vietnam' is enough."
        : "I'm not fully sure what 'this one' points to yet. Tell me the car name directly and I'll continue from there.";

  const followUp =
    pendingFlow?.missing_fields?.includes("country")
      ? "Which country or market should I use?"
      : pendingFlow?.missing_fields?.includes("vehicles") || activeTopic?.intent === "compare_car"
        ? "Which vehicle do you want me to use?"
        : "Which vehicle do you mean?";

  return {
    session_id,
    flow_id,
    intent: pendingFlow?.intent ?? activeTopic?.intent ?? "unknown",
    answer,
    cards: [],
    advisor_profile,
    suggested_actions: [],
    follow_up_questions: [followUp],
    facts_used: [],
    market_id,
    sources: [],
    caveats: [],
    confidence: buildConfidence(0.46, ["The assistant is asking for clarification instead of guessing from weak context."]),
    evidence: buildEvidence({
      verified: ["Conversation state does not contain a confident referent for the latest short reply."],
      inferred: [],
      estimated: [],
    }),
    freshness_note: null,
    needs_clarification: true,
    structured_result: null,
    meta: {
      services_used: ["ConversationStateService", "ClarificationPolicy"],
      sources_used: [],
      fallback_used: false,
      latency_ms: 0,
      route_service: "AmbiguousTurnClarification",
      missing_fields: pendingFlow?.missing_fields ?? [],
      turn_type: turn?.turn_type ?? "ambiguous",
    },
  };
}

async function finalizeTurn({
  session,
  AiChatMessages,
  updatedContext,
  responsePayload,
  tool_name = null,
  tool_payload = null,
}) {
  await session.update({
    last_active_at: new Date(),
    context_json: updatedContext,
  });

  if (tool_payload) {
    await AiChatMessages.create({
      session_id: session.session_id,
      role: "tool",
      content: null,
      tool_name,
      tool_payload,
    });
  }

  await AiChatMessages.create({
    session_id: session.session_id,
    role: "assistant",
    content: responsePayload.answer,
    tool_name: null,
    tool_payload: null,
  });

  return responsePayload;
}

export async function chatAdvisor(ctx, input) {
  const session_id = input?.session_id == null ? null : Number(input.session_id);
  const user_id = input?.user_id == null ? null : Number(input.user_id);
  const message = String(input?.message ?? "").trim();
  const context = input?.context ?? null;

  if (!message) throw { status: 400, message: "message is required" };
  if (session_id != null && !Number.isInteger(session_id)) throw { status: 400, message: "session_id invalid" };
  if (!Number.isInteger(user_id)) throw { status: 401, message: "Authenticated user is required" };

  const {
    models: { AiChatSessions, AiChatMessages },
  } = ctx;

  let session = null;

  if (session_id == null) {
    session = await AiChatSessions.create({
      user_id,
      last_active_at: new Date(),
      context_json: context ?? null,
    });
  } else {
    session = await AiChatSessions.findByPk(session_id);
    if (!session) throw { status: 404, message: "session_id does not exist" };
    await session.update({ last_active_at: new Date() });
  }

  await AiChatMessages.create({
    session_id: session.session_id,
    role: "user",
    content: message,
    tool_name: null,
    tool_payload: null,
  });

  const persistedContext = session.context_json || {};
  const persistedConversationState =
    persistedContext?.conversation_state && typeof persistedContext.conversation_state === "object"
      ? persistedContext.conversation_state
      : null;
  const activeTopic =
    persistedConversationState?.active_topic && typeof persistedConversationState.active_topic === "object"
      ? persistedConversationState.active_topic
      : persistedContext?.active_topic && typeof persistedContext.active_topic === "object"
        ? persistedContext.active_topic
        : null;
  const statePendingClarification =
    persistedConversationState?.pending_clarification &&
    typeof persistedConversationState.pending_clarification === "object"
      ? persistedConversationState.pending_clarification
      : null;
  const pendingFlowFromState = statePendingClarification?.intent
    ? {
        id: statePendingClarification.flow_id ?? persistedConversationState?.active_flow_id ?? createFlowId(),
        intent: statePendingClarification.intent,
        status: "clarifying",
        missing_fields: statePendingClarification.missing_fields ?? (statePendingClarification.field ? [statePendingClarification.field] : []),
        source: statePendingClarification.type ?? "state_rehydration",
        created_at: statePendingClarification.created_at ?? new Date().toISOString(),
        context_snapshot: {
          market_id: persistedContext.market_id ?? persistedConversationState?.active_entities?.market_id ?? 1,
          market_name: persistedContext.market_name ?? persistedConversationState?.active_entities?.market_name ?? null,
          country: persistedContext.country ?? persistedConversationState?.active_entities?.country ?? null,
          focus_variant_id:
            persistedContext.focus_variant_id ?? persistedConversationState?.active_entities?.focus_variant_id ?? null,
          focus_variant_label:
            persistedContext.focus_variant_label ??
            persistedConversationState?.active_entities?.focus_variant_label ??
            null,
          compare_variant_ids:
            persistedContext.compare_variant_ids ??
            persistedConversationState?.active_entities?.compare_variant_ids ??
            [],
          advisor_profile: persistedContext.advisor_profile ?? {},
        },
      }
    : null;
  const initialMarketId =
    context?.market_id != null
      ? Number(context.market_id)
      : Number(persistedContext.market_id ?? persistedConversationState?.active_entities?.market_id ?? 1);
  const initialFocusVariantIdRaw =
    context?.focus_variant_id != null
      ? Number(context.focus_variant_id)
      : persistedContext.focus_variant_id != null
        ? Number(persistedContext.focus_variant_id)
        : persistedConversationState?.active_entities?.focus_variant_id != null
          ? Number(persistedConversationState.active_entities.focus_variant_id)
          : (persistedConversationState?.referenced_vehicle_ids?.length ?? 0) === 1
            ? Number(persistedConversationState.referenced_vehicle_ids[0])
            : null;
  const initialFocusVariantId = Number.isInteger(initialFocusVariantIdRaw) ? initialFocusVariantIdRaw : null;
  const initialFocusVariantLabel =
    typeof context?.focus_variant_label === "string" && context.focus_variant_label
      ? context.focus_variant_label
      : typeof persistedContext.focus_variant_label === "string"
        ? persistedContext.focus_variant_label
        : typeof persistedConversationState?.active_entities?.focus_variant_label === "string"
          ? persistedConversationState.active_entities.focus_variant_label
          : null;
  const initialPendingQuestionKey =
    typeof persistedContext.pending_question_key === "string"
      ? persistedContext.pending_question_key
      : typeof statePendingClarification?.field === "string"
        ? statePendingClarification.field
        : null;
  const initialPendingQuestion = initialPendingQuestionKey ? QUESTION_BY_KEY[initialPendingQuestionKey] ?? null : null;
  const initialPendingFlow =
    persistedContext?.pending_flow && typeof persistedContext.pending_flow === "object"
      ? persistedContext.pending_flow
      : pendingFlowFromState;
  const existingProfile = persistedContext.advisor_profile || {};
  const profilePatch = extractAdvisorProfilePatch(message, initialPendingQuestion?.key ?? null, existingProfile);
  const recognizedPendingQuestion = initialPendingQuestion ? hasOwn(profilePatch, initialPendingQuestion.key) : false;
  const advisor_profile = mergeAdvisorProfile(existingProfile, profilePatch);
  const legacyIntent = detectIntent(message);
  const freshClassifierPreview = classifyIntent(message, {
    market_id: initialMarketId,
    focus_variant_id: initialFocusVariantId,
    focus_variant_label: initialFocusVariantLabel,
    advisor_profile,
    budget: advisor_profile.budget_max ?? null,
  });
  const hasVehicleMentions =
    (freshClassifierPreview.entities?.vehicles?.length ?? 0) > 0;
  const turn = classifyConversationTurn({
    message,
    pendingFlow: initialPendingFlow,
    pendingQuestionKey: initialPendingQuestionKey,
    previewIntent: freshClassifierPreview.intent,
    previewEntities: freshClassifierPreview.entities,
    activeTopic,
    conversationState: persistedConversationState,
    profilePatch,
    recognizedPendingQuestion,
    hasVehicleMentions,
  });
  const turnBaseContext = turn.should_clear_stale_result
    ? pruneConversationContext(persistedContext, {
        topicSwitched: true,
        preserveFocus: turn.preserve_focus,
        turnType: turn.turn_type,
      })
    : { ...(persistedContext || {}) };
  const market_id =
    context?.market_id != null ? Number(context.market_id) : Number(turnBaseContext.market_id ?? initialMarketId ?? 1);
  const focus_variant_id_raw =
    context?.focus_variant_id != null
      ? Number(context.focus_variant_id)
      : turnBaseContext.focus_variant_id != null
        ? Number(turnBaseContext.focus_variant_id)
        : turn.preserve_focus && persistedConversationState?.active_entities?.focus_variant_id != null
          ? Number(persistedConversationState.active_entities.focus_variant_id)
          : turn.preserve_focus && (persistedConversationState?.referenced_vehicle_ids?.length ?? 0) === 1
            ? Number(persistedConversationState.referenced_vehicle_ids[0])
        : null;
  const focus_variant_id = Number.isInteger(focus_variant_id_raw) ? focus_variant_id_raw : null;
  const focus_variant_label =
    typeof context?.focus_variant_label === "string" && context.focus_variant_label
      ? context.focus_variant_label
      : typeof turnBaseContext.focus_variant_label === "string"
        ? turnBaseContext.focus_variant_label
        : turn.preserve_focus && typeof persistedConversationState?.active_entities?.focus_variant_label === "string"
          ? persistedConversationState.active_entities.focus_variant_label
        : null;
  const pending_question_key =
    typeof turnBaseContext.pending_question_key === "string" ? turnBaseContext.pending_question_key : null;
  const pendingQuestion = pending_question_key ? QUESTION_BY_KEY[pending_question_key] ?? null : null;
  const pendingFlow =
    turnBaseContext?.pending_flow && typeof turnBaseContext.pending_flow === "object"
      ? turnBaseContext.pending_flow
      : null;
  const activeFlowId =
    (turn.bind_pending_flow ? pendingFlow?.id : null) ??
    (turn.should_preserve_topic ? persistedConversationState?.active_flow_id : null) ??
    createFlowId();
  const bindPendingFlow = shouldBindPendingFlow(message, pendingFlow, freshClassifierPreview.intent, turn, hasVehicleMentions);
  const forced_intent =
    bindPendingFlow
      ? pendingFlow.intent
      : turn.effective_intent && turn.effective_intent !== freshClassifierPreview.intent
        ? turn.effective_intent
        : null;
  const baseFlowContext = bindPendingFlow
    ? { ...(pendingFlow.context_snapshot || {}) }
    : turn.should_preserve_topic
      ? {
          market_id: turnBaseContext.market_id ?? initialMarketId ?? 1,
          market_name:
            turnBaseContext.market_name ?? persistedConversationState?.active_entities?.market_name ?? null,
          country: turnBaseContext.country ?? persistedConversationState?.active_entities?.country ?? null,
          focus_variant_id,
          focus_variant_label,
          compare_variant_ids:
            turnBaseContext.compare_variant_ids ??
            persistedConversationState?.active_entities?.compare_variant_ids ??
            [],
        }
      : {};
  const classifierPreview = classifyIntent(message, {
    ...baseFlowContext,
    market_id: market_id ?? baseFlowContext.market_id ?? null,
    focus_variant_id: focus_variant_id ?? baseFlowContext.focus_variant_id ?? null,
    focus_variant_label: focus_variant_label ?? baseFlowContext.focus_variant_label ?? null,
    advisor_profile,
    budget: advisor_profile.budget_max ?? null,
  });

  logAiEvent("info", "chat_turn_received", {
    flow_id: activeFlowId,
    session_id: session.session_id,
    pending_intent: pendingFlow?.intent ?? null,
    bind_pending_flow: bindPendingFlow,
    turn_type: turn.turn_type,
    topic_switched: turn.turn_type === "new_topic" || turn.turn_type === "task_replacement",
    preserve_focus: turn.preserve_focus,
    active_topic_intent: activeTopic?.intent ?? null,
    preview_intent: freshClassifierPreview.intent,
    effective_preview_intent: classifierPreview.intent,
    effective_intent: forced_intent ?? classifierPreview.intent,
    follow_up_dimension: turn.follow_up_dimension ?? null,
    notes: turn.notes,
  });

  if (turn.turn_type === "ambiguous") {
    const ambiguousPendingFlow =
      pendingFlow ??
      buildPendingFlow({
        id: activeFlowId,
        intent: activeTopic?.intent ?? classifierPreview.intent ?? "unknown",
        missing_fields:
          activeTopic?.intent === "compare_car"
            ? ["vehicles"]
            : activeTopic?.intent === "calculate_tco"
              ? ["vehicle"]
              : ["vehicle"],
        context_snapshot: {
          market_id,
          market_name: turnBaseContext.market_name ?? persistedConversationState?.active_entities?.market_name ?? null,
          country: turnBaseContext.country ?? persistedConversationState?.active_entities?.country ?? null,
          focus_variant_id,
          focus_variant_label,
          compare_variant_ids:
            turnBaseContext.compare_variant_ids ??
            persistedConversationState?.active_entities?.compare_variant_ids ??
            [],
          advisor_profile,
        },
        source: "ambiguous_turn",
      });
    const ambiguousConversationState = buildConversationState({
      previousState: persistedConversationState,
      turn,
      intent: ambiguousPendingFlow.intent,
      market_id,
      market_name: turnBaseContext.market_name ?? persistedConversationState?.active_entities?.market_name ?? null,
      country: turnBaseContext.country ?? persistedConversationState?.active_entities?.country ?? null,
      focus_variant_id,
      focus_variant_label,
      compare_variant_ids:
        turnBaseContext.compare_variant_ids ??
        persistedConversationState?.active_entities?.compare_variant_ids ??
        [],
      pending_flow: ambiguousPendingFlow,
      pending_question_key: pending_question_key ?? ambiguousPendingFlow.missing_fields?.[0] ?? null,
      structured_result: null,
      needs_clarification: true,
      flow_id: activeFlowId,
    });

    return finalizeTurn({
      session,
      AiChatMessages,
      updatedContext: {
        ...(turnBaseContext || {}),
        ...(context || {}),
        market_id,
        focus_variant_id,
        focus_variant_label,
        advisor_profile,
        pending_question_key: pending_question_key ?? ambiguousPendingFlow.missing_fields?.[0] ?? null,
        pending_flow: ambiguousPendingFlow,
        active_topic: ambiguousConversationState.active_topic,
        conversation_state: ambiguousConversationState,
      },
      responsePayload: buildAmbiguousTurnPayload({
        session_id: session.session_id,
        flow_id: activeFlowId,
        advisor_profile,
        market_id,
        pendingFlow: ambiguousPendingFlow,
        activeTopic,
        turn,
      }),
    });
  }

  if (legacyIntent === "sell_guidance") {
    const sellConversationState = buildConversationState({
      previousState: persistedConversationState,
      turn,
      intent: "sell_guidance",
      market_id,
      focus_variant_id,
      focus_variant_label,
      compare_variant_ids: [],
      pending_flow: null,
      pending_question_key: null,
      structured_result: null,
      needs_clarification: false,
      flow_id: activeFlowId,
    });
    return finalizeTurn({
      session,
      AiChatMessages,
      updatedContext: {
        ...(turnBaseContext || {}),
        ...(context || {}),
        market_id,
        focus_variant_id,
        focus_variant_label,
        advisor_profile,
        pending_question_key: null,
        pending_flow: null,
        active_topic: sellConversationState.active_topic,
        conversation_state: sellConversationState,
      },
      responsePayload: {
        session_id: session.session_id,
        flow_id: activeFlowId,
        intent: "sell_guidance",
        answer:
          "To sell your car, open Sell, choose the correct variant, add price, mileage, location, and description, then publish the listing. Buyers can then send viewing requests and contact you outside the platform.",
        cards: [],
        advisor_profile,
        suggested_actions: [{ type: "open_sell", payload: {} }],
        follow_up_questions: ["If you want, I can also help price the car or compare it against similar vehicles."],
        facts_used: [],
        market_id,
        sources: [],
        caveats: [],
        confidence: buildConfidence(0.88, ["This guidance is grounded to the current CarVista selling workflow."]),
        evidence: buildEvidence({
          verified: ["Sell guidance is mapped to the current product workflow."],
          inferred: [],
          estimated: [],
        }),
        freshness_note: null,
        needs_clarification: false,
        structured_result: null,
        meta: {
          services_used: ["ConversationPolicyService"],
          sources_used: [],
          fallback_used: false,
          latency_ms: 0,
          route_service: "SellGuidance",
          missing_fields: [],
          turn_type: turn.turn_type,
        },
      },
    });
  }

  const allowDirectionalShortlist =
    forced_intent == null &&
    classifierPreview.intent === "recommend_car" &&
    wantsTemporaryShortlist(message) &&
    hasDirectionalShortlistProfile(advisor_profile);

  if (forced_intent == null && classifierPreview.intent === "recommend_car") {
    const nextRequiredQuestions = nextAdvisorQuestions(advisor_profile, "required", 3);
    const nextRequiredQuestion = nextRequiredQuestions[0] ?? null;
    const nextOptionalQuestion = nextAdvisorQuestion(advisor_profile, "optional");

    if (pendingQuestion && !recognizedPendingQuestion && Object.keys(profilePatch).length === 0) {
      const pendingQuestions = [
        pendingQuestion,
        ...nextRequiredQuestions.filter((question) => question.key !== pendingQuestion.key),
      ].slice(0, 3);
      const pendingQuestionKeys = pendingQuestions.map((question) => question.key);
      const recommendationPendingFlow = buildPendingFlow({
        id: activeFlowId,
        intent: "recommend_car",
        missing_fields: pendingQuestionKeys,
        context_snapshot: {
          market_id,
          focus_variant_id,
          focus_variant_label,
          advisor_profile,
        },
        source: "recommendation_profile",
      });
      const recommendationConversationState = buildConversationState({
        previousState: persistedConversationState,
        turn,
        intent: "recommend_car",
        market_id,
        focus_variant_id,
        focus_variant_label,
        compare_variant_ids:
          turnBaseContext.compare_variant_ids ??
          persistedConversationState?.active_entities?.compare_variant_ids ??
          [],
        pending_flow: recommendationPendingFlow,
        pending_question_key: pendingQuestion.key,
        structured_result: null,
        needs_clarification: true,
        flow_id: activeFlowId,
      });
      return finalizeTurn({
        session,
        AiChatMessages,
        updatedContext: {
          ...(turnBaseContext || {}),
          ...(context || {}),
          market_id,
          focus_variant_id,
          focus_variant_label,
          advisor_profile,
          pending_question_key: pendingQuestion.key,
          pending_flow: recommendationPendingFlow,
          active_topic: recommendationConversationState.active_topic,
          conversation_state: recommendationConversationState,
        },
        responsePayload: {
          session_id: session.session_id,
          flow_id: activeFlowId,
          intent: "recommend_car",
          answer: buildClarificationAnswer(pendingQuestions, advisor_profile),
          cards: buildProfileProgressCards(advisor_profile, pendingQuestions),
          advisor_profile,
          suggested_actions: [{ type: "continue_profile", payload: { question_key: pendingQuestion.key } }],
          follow_up_questions: pendingQuestions.map((question) => question.question),
          facts_used: [],
          market_id,
          sources: [],
          caveats: [],
          confidence: buildConfidence(0.58, ["The assistant is clarifying a missing buyer-profile field."]),
          evidence: buildEvidence({
            verified: ["Profile collection is handled deterministically from the conversation state."],
            inferred: [],
            estimated: [],
          }),
          freshness_note: null,
          needs_clarification: true,
          structured_result: null,
          meta: {
            services_used: ["IntentClassifier", "ClarificationPolicy"],
            sources_used: [],
            fallback_used: false,
            latency_ms: 0,
            route_service: "RecommendationClarification",
            missing_fields: pendingQuestionKeys,
            turn_type: turn.turn_type,
          },
        },
      });
    }

    if (nextRequiredQuestion && !allowDirectionalShortlist) {
      const nextRequiredQuestionKeys = nextRequiredQuestions.map((question) => question.key);
      const recommendationPendingFlow = buildPendingFlow({
        id: activeFlowId,
        intent: "recommend_car",
        missing_fields: nextRequiredQuestionKeys,
        context_snapshot: {
          market_id,
          focus_variant_id,
          focus_variant_label,
          advisor_profile,
        },
        source: "recommendation_profile",
      });
      const recommendationConversationState = buildConversationState({
        previousState: persistedConversationState,
        turn,
        intent: "recommend_car",
        market_id,
        focus_variant_id,
        focus_variant_label,
        compare_variant_ids:
          turnBaseContext.compare_variant_ids ??
          persistedConversationState?.active_entities?.compare_variant_ids ??
          [],
        pending_flow: recommendationPendingFlow,
        pending_question_key: nextRequiredQuestion.key,
        structured_result: null,
        needs_clarification: true,
        flow_id: activeFlowId,
      });
      return finalizeTurn({
        session,
        AiChatMessages,
        updatedContext: {
          ...(turnBaseContext || {}),
          ...(context || {}),
          market_id,
          focus_variant_id,
          focus_variant_label,
          advisor_profile,
          pending_question_key: nextRequiredQuestion.key,
          pending_flow: recommendationPendingFlow,
          active_topic: recommendationConversationState.active_topic,
          conversation_state: recommendationConversationState,
        },
        responsePayload: {
          session_id: session.session_id,
          flow_id: activeFlowId,
          intent: "recommend_car",
          answer: buildProgressAnswer(advisor_profile, nextRequiredQuestions),
          cards: buildProfileProgressCards(advisor_profile, nextRequiredQuestions),
          advisor_profile,
          suggested_actions: [{ type: "continue_profile", payload: { question_key: nextRequiredQuestion.key } }],
          follow_up_questions: nextRequiredQuestions.map((question) => question.question),
          facts_used: [],
          market_id,
          sources: [],
          caveats: [],
          confidence: buildConfidence(
            clamp(0.44 + countAnsweredQuestions(advisor_profile) * 0.08, 0.44, 0.76),
            ["Recommendation quality improves as more buyer-profile fields are collected."]
          ),
          evidence: buildEvidence({
            verified: ["Profile collection is grounded to deterministic question handling."],
            inferred: ["The user is still in the recommendation intake flow."],
            estimated: [],
          }),
          freshness_note: null,
          needs_clarification: true,
          structured_result: null,
          meta: {
            services_used: ["IntentClassifier", "ClarificationPolicy"],
            sources_used: [],
            fallback_used: false,
            latency_ms: 0,
            route_service: "RecommendationClarification",
            missing_fields: nextRequiredQuestionKeys,
            turn_type: turn.turn_type,
          },
        },
      });
    }
  }

  try {
    const envelope = await orchestrateChatRequest(ctx, {
      message,
      context: {
        ...baseFlowContext,
        ...(context || {}),
        market_id: market_id ?? baseFlowContext.market_id ?? null,
        focus_variant_id: focus_variant_id ?? baseFlowContext.focus_variant_id ?? null,
        focus_variant_label: focus_variant_label ?? baseFlowContext.focus_variant_label ?? null,
        compare_variant_ids: baseFlowContext.compare_variant_ids ?? persistedContext.compare_variant_ids ?? [],
        advisor_profile,
        budget: advisor_profile.budget_max ?? null,
        country: baseFlowContext.country ?? persistedContext.country ?? null,
        comparison_focus: turn.follow_up_dimension ?? null,
      },
      advisor_profile,
      forced_intent,
      flow_id: activeFlowId,
      turn_context: {
        turn_type: turn.turn_type,
        follow_up_dimension: turn.follow_up_dimension ?? null,
        active_intent: activeTopic?.intent ?? null,
        directional_shortlist: allowDirectionalShortlist,
      },
    });

    const recommendationFocus =
      envelope.intent === "recommend_car" && !envelope.needs_clarification
        ? extractRecommendationFocus(envelope.structured_result)
        : { focus_variant_id: null, focus_variant_label: null };
    const resolvedMarketId = envelope.context_updates?.market_id ?? market_id ?? baseFlowContext.market_id ?? 1;
    const resolvedFocusVariantId =
      envelope.context_updates?.focus_variant_id ??
      focus_variant_id ??
      baseFlowContext.focus_variant_id ??
      recommendationFocus.focus_variant_id ??
      null;
    const resolvedFocusVariantLabel =
      envelope.context_updates?.focus_variant_label ??
      focus_variant_label ??
      baseFlowContext.focus_variant_label ??
      recommendationFocus.focus_variant_label ??
      null;
    const resolvedCompareVariantIds = collectCompareVariantIds(
      envelope.intent,
      envelope.structured_result,
      envelope.context_updates,
      baseFlowContext.compare_variant_ids ?? turnBaseContext.compare_variant_ids ?? []
    );

    const nextOptionalQuestion =
      envelope.intent === "recommend_car" && !envelope.needs_clarification
        ? nextAdvisorQuestion(advisor_profile, "optional")
        : null;
    const next_pending_question_key =
      envelope.intent === "recommend_car" && nextOptionalQuestion ? nextOptionalQuestion.key : null;
    const pending_flow = envelope.needs_clarification
      ? buildPendingFlow({
          id: activeFlowId,
          intent: envelope.intent,
          missing_fields: envelope.meta?.missing_fields ?? [],
          context_snapshot: {
            market_id: resolvedMarketId,
            market_name: envelope.context_updates?.market_name ?? persistedContext.market_name ?? null,
            country: envelope.context_updates?.country ?? persistedContext.country ?? null,
            focus_variant_id: resolvedFocusVariantId,
            focus_variant_label: resolvedFocusVariantLabel,
            compare_variant_ids: resolvedCompareVariantIds,
            advisor_profile,
          },
        })
      : next_pending_question_key
        ? buildPendingFlow({
            id: activeFlowId,
            intent: "recommend_car",
            missing_fields: [next_pending_question_key],
            context_snapshot: {
              market_id: resolvedMarketId,
              focus_variant_id: resolvedFocusVariantId,
              focus_variant_label: resolvedFocusVariantLabel,
              advisor_profile,
            },
            source: "recommendation_profile",
          })
        : null;
    const nextConversationState = buildConversationState({
      previousState: persistedConversationState,
      turn,
      intent: envelope.intent,
      market_id: resolvedMarketId,
      market_name: envelope.context_updates?.market_name ?? persistedContext.market_name ?? null,
      country: envelope.context_updates?.country ?? persistedContext.country ?? null,
      focus_variant_id: resolvedFocusVariantId,
      focus_variant_label: resolvedFocusVariantLabel,
      compare_variant_ids: resolvedCompareVariantIds,
      pending_flow,
      pending_question_key: next_pending_question_key,
      structured_result: envelope.structured_result,
      needs_clarification: envelope.needs_clarification,
      flow_id: activeFlowId,
    });

    return finalizeTurn({
      session,
      AiChatMessages,
      updatedContext: {
        ...(turnBaseContext || {}),
        ...baseFlowContext,
        ...(context || {}),
        ...(envelope.context_updates ?? {}),
        market_id: resolvedMarketId,
        focus_variant_id: resolvedFocusVariantId,
        focus_variant_label: resolvedFocusVariantLabel,
        compare_variant_ids: resolvedCompareVariantIds,
        advisor_profile,
        pending_question_key: next_pending_question_key,
        pending_flow,
        active_topic: nextConversationState.active_topic,
        conversation_state: nextConversationState,
      },
      responsePayload: {
        session_id: session.session_id,
        flow_id: activeFlowId,
        intent: envelope.intent,
        answer: envelope.final_answer,
        cards: buildCardsFromStructuredResult(envelope.intent, envelope.structured_result, advisor_profile, nextOptionalQuestion),
        advisor_profile,
        suggested_actions: buildSuggestedActions(envelope.intent, envelope.structured_result, {
          market_id: resolvedMarketId,
          focus_variant_id: resolvedFocusVariantId,
          nextOptionalQuestion,
          needs_clarification: envelope.needs_clarification,
        }),
        follow_up_questions: buildFollowUpQuestions(envelope.intent, envelope.structured_result, {
          focus_variant_id: resolvedFocusVariantId,
          nextOptionalQuestion,
          needs_clarification: envelope.needs_clarification,
          missing_fields: envelope.meta?.missing_fields ?? [],
        }),
        facts_used: buildFactsUsed(envelope.intent, envelope.structured_result, resolvedMarketId),
        market_id: resolvedMarketId,
        sources: envelope.sources ?? [],
        caveats: envelope.caveats ?? [],
        confidence: envelope.result_confidence ?? null,
        evidence: envelope.evidence ?? null,
        freshness_note: envelope.freshness_note ?? null,
        needs_clarification: envelope.needs_clarification,
        structured_result: envelope.structured_result,
        meta: {
          ...envelope.meta,
          flow_id: activeFlowId,
          turn_type: turn.turn_type,
          context_transition: {
            preserve_topic: turn.should_preserve_topic,
            replace_task: turn.should_replace_active_task,
            clear_stale_result: turn.should_clear_stale_result,
          },
        },
      },
      tool_name: envelope.intent,
      tool_payload: envelope,
    });
  } catch (error) {
    const fallbackIntent = forced_intent ?? classifierPreview.intent ?? freshClassifierPreview.intent ?? "unknown";
    const fallbackPendingFlow = buildPendingFlow({
      id: activeFlowId,
      intent: fallbackIntent,
      missing_fields: [],
      context_snapshot: {
        market_id: market_id ?? baseFlowContext.market_id ?? 1,
        focus_variant_id: focus_variant_id ?? baseFlowContext.focus_variant_id ?? null,
        focus_variant_label: focus_variant_label ?? baseFlowContext.focus_variant_label ?? null,
        compare_variant_ids: baseFlowContext.compare_variant_ids ?? turnBaseContext.compare_variant_ids ?? [],
        advisor_profile,
      },
      source: "error_recovery",
    });
    const fallbackConversationState = buildConversationState({
      previousState: persistedConversationState,
      turn,
      intent: fallbackIntent,
      market_id: market_id ?? baseFlowContext.market_id ?? 1,
      focus_variant_id: focus_variant_id ?? baseFlowContext.focus_variant_id ?? null,
      focus_variant_label: focus_variant_label ?? baseFlowContext.focus_variant_label ?? null,
      compare_variant_ids: baseFlowContext.compare_variant_ids ?? turnBaseContext.compare_variant_ids ?? [],
      pending_flow: fallbackPendingFlow,
      pending_question_key: pending_question_key ?? null,
      structured_result: null,
      needs_clarification: true,
      flow_id: activeFlowId,
    });
    return finalizeTurn({
      session,
      AiChatMessages,
      updatedContext: {
        ...(turnBaseContext || {}),
        ...baseFlowContext,
        ...(context || {}),
        market_id: market_id ?? baseFlowContext.market_id ?? 1,
        focus_variant_id: focus_variant_id ?? baseFlowContext.focus_variant_id ?? null,
        focus_variant_label: focus_variant_label ?? baseFlowContext.focus_variant_label ?? null,
        advisor_profile,
        pending_question_key: pending_question_key ?? null,
        pending_flow: fallbackPendingFlow,
        active_topic: fallbackConversationState.active_topic,
        conversation_state: fallbackConversationState,
      },
      responsePayload: {
        ...mapAiChatErrorToResponse({
          error,
          intent: fallbackIntent,
          session_id: session.session_id,
          advisor_profile,
          market_id: market_id ?? baseFlowContext.market_id ?? 1,
          flow_id: activeFlowId,
        }),
        meta: {
          services_used: ["ConversationStateService", "ErrorMapper"],
          sources_used: [],
          fallback_used: true,
          latency_ms: 0,
          route_service: "ErrorRecovery",
          missing_fields: [],
          turn_type: turn.turn_type,
        },
      },
    });
  }
}

export const __advisorInternals = {
  normalizeText,
  extractBudget,
  extractEnvironment,
  extractLongTripHabit,
  extractPassengerCount,
  extractBodyTypePreference,
  extractFuelPreference,
  extractAdvisorProfilePatch,
  nextAdvisorQuestion,
  buildProfileSnapshot,
  buildQuestionPrompt,
};
