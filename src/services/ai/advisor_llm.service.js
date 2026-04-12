import { readFile } from "node:fs/promises";
import { defaultOllamaService } from "./ollama.service.js";
import { extractAdvisorProfilePatch, mergePreferenceProfiles } from "./advisor_profile.service.js";

const EXTRACTION_SYSTEM_PROMPT = [
  "You are a dealership AI Advisor extraction helper.",
  "Return strict JSON only. Do not include markdown, explanations, or vehicle recommendations.",
  "Never invent vehicles, prices, specs, or availability.",
  "Extract only what the customer actually said or strongly implied.",
  "Use English normalized values.",
].join(" ");

const FORMAT_SYSTEM_PROMPT = [
  "You are a dealership AI Advisor copy helper.",
  "Use only the candidate vehicles supplied by backend JSON.",
  "Do not invent vehicles, prices, specs, trim equipment, availability, or links.",
  "Write concise English sales-advisor copy.",
  "Return strict JSON only.",
].join(" ");

const POLICY_SYSTEM_PROMPT = [
  "You are a warm dealership AI concierge.",
  "Stay within the dealership and vehicle-buying context.",
  "For small talk, reply naturally and lightly, then invite the customer back to vehicle help.",
  "For off-topic requests, do not answer the unrelated task in detail. Give a brief friendly pivot back to cars.",
  "Use English only and keep it to one or two short sentences.",
  "Return strict JSON only.",
].join(" ");

const ADVISOR_QUESTION_SYSTEM_PROMPT = [
  "You are a dealership AI Advisor conversation helper.",
  "Use the provided CarVista advisor skill as your operating rules.",
  "Write only the next customer-facing chat message.",
  "English only. Ask one focused question. No numbered lists, no progress reports, no multi-question forms.",
  "Return strict JSON only.",
].join(" ");

const COMPARE_FORMAT_SYSTEM_PROMPT = [
  "You are a dealership AI comparison copy helper.",
  "Rewrite grounded comparison summaries so they feel natural, concise, polished, and useful to a real buyer.",
  "Use only the vehicle names and grounded facts supplied by backend JSON.",
  "Do not invent vehicles, prices, specs, trims, features, or conclusions outside the supplied data.",
  "Do not mention raw scores, point totals, confidence labels, backend logic, or AI internals.",
  "Avoid repetitive sentence structure, duplicated points, and robotic phrasing.",
  "Focus on overall value, driving feel, daily usability, design appeal, and ownership considerations.",
  "Do not force weak or inaccurate claims such as family practicality for exotic supercars.",
  "If one car is the better all-round choice, say so clearly.",
  "If the other car is more emotional, dramatic, or exotic, describe it that way.",
  "Mention recall or reliability carefully and neutrally, and only when it adds decision value.",
  "Return strict JSON only.",
].join(" ");

const ADVISOR_SKILL_FALLBACK = [
  "# CarVista Advisor Concierge Skill",
  "Use English only. Ask one focused question at a time.",
  "Do not use numbered lists, checklists, progress reports, or still-needed language.",
  "Acknowledge useful customer input briefly, then ask the single next question in your own natural phrasing.",
  "Do not recommend vehicles until backend-ranked catalog candidates are supplied.",
].join("\n");

const ADVISOR_SKILL_URL = new URL("./advisor_concierge.skill.md", import.meta.url);
let advisorSkillCache = null;

async function loadAdvisorSkillMarkdown() {
  if (advisorSkillCache) return advisorSkillCache;
  try {
    advisorSkillCache = await readFile(ADVISOR_SKILL_URL, "utf8");
  } catch {
    advisorSkillCache = ADVISOR_SKILL_FALLBACK;
  }
  return advisorSkillCache;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function compactVehicleForPrompt(item) {
  return {
    variant_id: item.variant_id ?? null,
    title: item.name,
    fit_label: item.fit_label ?? null,
    body_type: item.body_type ?? null,
    fuel_type: item.fuel_type ?? null,
    seats: item.seats ?? null,
    price: item.latest_price ?? null,
    reasons: (item.reasons ?? []).slice(0, 2),
    caveats: (item.caveats ?? []).slice(0, 1),
    best_for: (item.best_for ?? []).slice(0, 2),
    image: item.thumbnail_url ?? null,
    detail_url: item.links?.detail_page_url ?? null,
  };
}

function compactCompareItemForPrompt(item) {
  return {
    variant_id: item?.variant_id ?? null,
    title: [item?.year, item?.make, item?.model, item?.trim].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
    body_type: item?.body_type ?? null,
    fuel_type: item?.fuel_type ?? null,
    seats: item?.seats ?? null,
    price: item?.latest_price ?? item?.msrp_base ?? null,
    top_pros: (item?.pros ?? []).slice(0, 2),
    watch_outs: (item?.cons ?? []).slice(0, 2),
  };
}

function shouldUseOllama(ollama) {
  if (!ollama?.generate) return false;
  return !(ollama === defaultOllamaService && process.env.NODE_ENV === "test");
}

function stripThinking(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

export function parseModelJson(text) {
  const cleaned = stripThinking(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      return null;
    }
  }
}

function normalizeUseCase(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(taxi|ride-hailing|ride hailing|rideshare|ride-share|uber|grab|service|commercial)\b/.test(normalized)) return "commercial_service";
  if (/\b(family|kids|children|parents|school runs?|school drop-offs?|school drop offs?)\b/.test(normalized)) return "family";
  if (/\b(commute|commuting|office commute|work and back|daily|everyday|day-to-day|day to day|get around town|around town)\b/.test(normalized)) return "daily_commute";
  if (/\b(business|client|clients|company|meeting|meetings|site visits?)\b/.test(normalized)) return "business";
  if (/\b(long|trip|travel|road|touring|holiday|highway|between cities|long-distance|long distance)\b/.test(normalized)) return "road_trip";
  if (/\b(cargo|goods|utility|load)\b/.test(normalized)) return "cargo";
  if (/\b(fun|sport|sporty|performance|drift|drifting|track|track day|race|racing|race car|supercar|super car|hypercar|autocross|spirited|driving enjoyment|driving experience|weekend fun|exciting to drive)\b/.test(normalized)) return "lifestyle";
  return normalized.replace(/\s+/g, "_");
}

function normalizeBodyType(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(i'?m not sure|not sure|unsure|open|any|no preference)\b/.test(normalized)) return "any";
  if (/\b(crossover|crossovers|cuv)\b/.test(normalized)) return "cuv";
  if (/\b(compact suv|suvs?|sport utility)\b/.test(normalized)) return "suv";
  if (/\b(mpv|mpvs|minivan|minivans|van|vans|people carrier|people carriers)\b/.test(normalized)) return "mpv";
  if (/\b(pickup|pickups|pickup truck|pickup trucks|truck)\b/.test(normalized)) return "pickup";
  if (/\bsedan\b/.test(normalized)) return "sedan";
  if (/\b(hatchback|hatch|hatchbacks)\b/.test(normalized)) return "hatchback";
  if (/\b(wagon|wagons|estate|estates)\b/.test(normalized)) return "wagon";
  if (/\b(coupe|coupes|convertible|convertibles|roadster|roadsters|sports car|supercar|super car|hypercar|race car|track car)\b/.test(normalized)) return "coupe";
  return normalized;
}

function normalizeFuelType(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(ev|electric|bev)\b/.test(normalized)) return "ev";
  if (/\b(hybrid)\b/.test(normalized)) return "hybrid";
  if (/\b(plug in hybrid|plug-in hybrid|phev)\b/.test(normalized)) return "phev";
  if (/\b(diesel)\b/.test(normalized)) return "diesel";
  if (/\b(gasoline|petrol|gas)\b/.test(normalized)) return "gasoline";
  return normalized;
}

function normalizeFeature(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(360 camera|camera 360)\b/.test(normalized)) return "camera_360";
  if (/\b(apple carplay)\b/.test(normalized)) return "apple_carplay";
  if (/\b(android auto)\b/.test(normalized)) return "android_auto";
  if (/\b(blind spot|blind-spot)\b/.test(normalized)) return "blind_spot_monitor";
  if (/\b(adaptive cruise)\b/.test(normalized)) return "adaptive_cruise_control";
  if (/\b(lane keep|lane assist)\b/.test(normalized)) return "lane_keep_assist";
  if (/\b(aeb|automatic emergency braking)\b/.test(normalized)) return "automatic_emergency_braking";
  if (/\b(ventilated seats|cooled seats)\b/.test(normalized)) return "ventilated_seats";
  if (/\b(sunroof)\b/.test(normalized)) return "sunroof";
  if (/\b(panoramic roof)\b/.test(normalized)) return "panoramic_roof";
  if (/\b(power tailgate|electric tailgate)\b/.test(normalized)) return "power_tailgate";
  if (/\b(captain seats)\b/.test(normalized)) return "captain_seats";
  if (/\b(third row)\b/.test(normalized)) return "third_row";
  return normalized.replace(/\s+/g, "_");
}

function normalizeDealBreaker(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(no ev|avoid ev|ev|electric)\b/.test(normalized)) return "ev_powertrain";
  if (/\b(no manual|avoid manual|manual)\b/.test(normalized)) return "manual_transmission";
  if (/\b(big suv|too big|oversized|large footprint)\b/.test(normalized)) return "oversized_vehicle";
  if (/\b(chinese brands?|avoid chinese)\b/.test(normalized)) return "avoid_chinese_brands";
  return normalized;
}

function normalizeRequirementStrength(value, allowed = ["hard", "soft", "open"]) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (allowed.includes(normalized)) return normalized;
  if (/\b(must|only|strict|required|requiredly|hard)\b/.test(normalized) && allowed.includes("hard")) return "hard";
  if (/\b(prefer|ideally|nice|soft|flexible)\b/.test(normalized) && allowed.includes("soft")) return "soft";
  if (/\b(open|anything except|avoid|not this)\b/.test(normalized) && allowed.includes("open")) return "open";
  return null;
}

function normalizeOwnershipPreference(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(durable|durability|reliable|low maintenance|cheap maintenance|easy ownership|practical)\b/.test(normalized)) return "durability";
  if (/\b(performance|sporty|sportier|fast|faster|quick|quicker|quickest|speed|power|acceleration|fun|drift|drifting|track|race|racing|supercar|super car|hypercar|autocross|spirited)\b/.test(normalized)) return "performance";
  if (/\b(balanced|either|not sure|no preference|open)\b/.test(normalized)) return "balanced";
  return null;
}

function normalizeBudgetMode(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(open|unlimited|no budget|money no object|not a concern)\b/.test(normalized)) return "open";
  if (/\b(flexible|depends|not fixed|can stretch|stretch a bit|worth it|not super strict)\b/.test(normalized)) return "flexible";
  if (/\b(capped|ceiling|max|under|limit)\b/.test(normalized)) return "capped";
  if (/\b(target|around|about|roughly)\b/.test(normalized)) return "target";
  return null;
}

function normalizePricePositioning(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(flagship|top tier|top-tier|top of the line|highest spec|fully loaded|most expensive|best available|halo)\b/.test(normalized)) return "flagship";
  if (/\b(premium|luxury|high end|high-end|upscale)\b/.test(normalized)) return "premium";
  if (/\b(best value|bang for buck|value for money|worth it|smart buy)\b/.test(normalized)) return "value";
  if (/\b(budget|cheapest|lowest price|entry level|entry-level|affordable)\b/.test(normalized)) return "budget";
  if (/\b(mid|mid range|mid-range|middle)\b/.test(normalized)) return "mid";
  return null;
}

function normalizeStyleIntent(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(halo|flagship|most expensive|top of the line|fully loaded)\b/.test(normalized)) return "halo";
  if (/\b(premium|luxury|high end|high-end|prestige)\b/.test(normalized)) return "premium";
  if (/\b(sporty|sport|performance|fun|track|race|drift|exciting)\b/.test(normalized)) return "sporty";
  if (/\b(practical|value|sensible|easy ownership)\b/.test(normalized)) return "practical";
  return null;
}

function normalizeSeatNeed(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(exact|exactly|only|just)\b/.test(normalized)) return "exact";
  if (/\b(minimum|at least|or more|backup|occasionally|just in case)\b/.test(normalized)) return "minimum";
  if (/\b(flexible|open|not sure|any)\b/.test(normalized)) return "flexible";
  return null;
}

function normalizeStringArray(values, mapper = (value) => normalizeText(value)) {
  if (values == null) return [];
  const items = Array.isArray(values) ? values : [values];
  return [...new Set(items.map((item) => mapper(item)).filter(Boolean))];
}

export function advisorExtractionToProfilePatch(extraction = {}, expectedQuestionKey = null) {
  const useCase = normalizeUseCase(extraction.use_case);
  const bodyType = normalizeBodyType(extraction.vehicle_type);
  const bodyTypeRequirement = normalizeRequirementStrength(extraction.vehicle_type_requirement);
  const bodyTypeExclusions = normalizeStringArray(extraction.body_type_exclusions, normalizeBodyType);
  const fuelType = normalizeFuelType(extraction.fuel_type);
  const fuelTypeRequirement = normalizeRequirementStrength(extraction.fuel_type_requirement);
  const fuelTypeExclusions = normalizeStringArray(extraction.fuel_type_exclusions, normalizeFuelType);
  const seatCount = toNumberOrNull(extraction.seat_count);
  const seatNeed = normalizeSeatNeed(extraction.seat_need);
  const seatRequirement = normalizeRequirementStrength(extraction.seat_requirement, ["hard", "soft"]);
  const budgetMin = toNumberOrNull(extraction.budget_min);
  const budgetMax = toNumberOrNull(extraction.budget_max);
  const budgetMode = normalizeBudgetMode(extraction.budget_mode);
  const pricePositioning = normalizePricePositioning(extraction.price_positioning);
  const styleIntent = normalizeStyleIntent(extraction.style_intent);
  const mustHaveFeatures = normalizeStringArray(extraction.must_have_features, normalizeFeature);
  const niceToHaveFeatures = normalizeStringArray(extraction.nice_to_have_features, normalizeFeature);
  const dealBreakers = normalizeStringArray(extraction.deal_breakers, normalizeDealBreaker);
  const ownershipPreference = normalizeOwnershipPreference(extraction.ownership_preference);
  const isUnsure = Boolean(extraction.is_unsure);

  const patch = {};
  if (useCase) patch.primary_use_cases = [useCase];
  if (bodyType) patch.preferred_body_types = [bodyType];
  if (bodyTypeRequirement) patch.body_type_requirement = bodyTypeRequirement;
  if (bodyTypeExclusions.length) patch.rejected_body_types = bodyTypeExclusions;
  if (fuelType) patch.preferred_fuel_types = [fuelType];
  if (fuelTypeRequirement) patch.fuel_type_requirement = fuelTypeRequirement;
  if (fuelTypeExclusions.length) patch.rejected_fuel_types = fuelTypeExclusions;
  if (seatCount != null) {
    patch.regular_passenger_count = seatCount;
    patch.family_size = seatCount;
    if (seatCount >= 6) patch.needs_7_seats = true;
  }
  if (seatNeed) patch.seat_need = seatNeed;
  if (seatRequirement) patch.seat_requirement = seatRequirement;
  if (budgetMin != null) patch.budget_floor = budgetMin;
  if (budgetMax != null) {
    patch.budget_target = budgetMax;
    patch.budget_ceiling = budgetMax;
  }
  if (budgetMode) patch.budget_mode = budgetMode;
  if (budgetMode === "open") patch.budget_flexibility = "open";
  else if (budgetMode === "flexible" && budgetMax == null) patch.budget_flexibility = "flexible";
  if (pricePositioning) patch.price_positioning = pricePositioning;
  if (styleIntent || pricePositioning === "flagship" || pricePositioning === "premium" || pricePositioning === "value" || pricePositioning === "budget") {
    patch.style_intent =
      styleIntent ??
      (pricePositioning === "flagship"
        ? "halo"
        : pricePositioning === "premium"
          ? "premium"
          : "practical");
  }

  if (mustHaveFeatures.length) patch.must_have_features = mustHaveFeatures;
  if (niceToHaveFeatures.length) patch.nice_to_have_features = niceToHaveFeatures.filter((feature) => !mustHaveFeatures.includes(feature));
  if (dealBreakers.length) patch.deal_breakers = dealBreakers;

  if (patch.rejected_body_types?.length) {
    patch.preferred_body_types = (patch.preferred_body_types ?? []).filter((value) => !patch.rejected_body_types.includes(value));
  }
  if (patch.rejected_fuel_types?.length) {
    patch.preferred_fuel_types = (patch.preferred_fuel_types ?? []).filter((value) => !patch.rejected_fuel_types.includes(value));
  }
  if (expectedQuestionKey === "must_have_features" && !patch.must_have_features?.length && patch.nice_to_have_features?.length) {
    patch.must_have_features = [...patch.nice_to_have_features];
    patch.nice_to_have_features = [];
  }

  if (ownershipPreference === "durability") {
    patch.tradeoff_preferences = ["reliability_over_performance"];
    patch.reliability_priority = 0.95;
    patch.maintenance_cost_priority = 0.95;
  } else if (ownershipPreference === "performance") {
    patch.tradeoff_preferences = ["performance_over_reliability"];
    patch.performance_priority = 0.95;
  } else if (ownershipPreference === "balanced") {
    patch.tradeoff_preferences = ["balanced"];
  }

  if (patch.style_intent === "premium" || patch.style_intent === "halo") {
    patch.style_priority = Math.max(Number(patch.style_priority || 0), patch.style_intent === "halo" ? 0.95 : 0.88);
    patch.emotional_motivators = ["premium_image"];
  } else if (patch.style_intent === "sporty") {
    patch.style_priority = Math.max(Number(patch.style_priority || 0), 0.82);
    patch.performance_priority = Math.max(Number(patch.performance_priority || 0), 0.82);
    patch.emotional_motivators = ["sporty_identity"];
  } else if (patch.style_intent === "practical") {
    patch.maintenance_cost_priority = Math.max(Number(patch.maintenance_cost_priority || 0), 0.72);
  }

  if (isUnsure) {
    if (expectedQuestionKey === "passenger_setup" && !bodyType) patch.preferred_body_types = ["any"];
    if (expectedQuestionKey === "budget_range" && budgetMax == null && !budgetMode) patch.budget_flexibility = "flexible";
    if (expectedQuestionKey === "tradeoff_preferences" && !ownershipPreference) patch.tradeoff_preferences = ["balanced"];
  }

  return patch;
}

function buildExtractionPrompt({ message, expectedQuestionKey, currentProfile }) {
  return [
    "/no_think",
    "Convert the latest customer reply into structured JSON for a vehicle dealership advisor.",
    "Return exactly these keys:",
    '{"use_case": string|null, "vehicle_type": string|null, "vehicle_type_requirement": "hard"|"soft"|"open"|null, "body_type_exclusions": string[]|null, "fuel_type": string|null, "fuel_type_requirement": "hard"|"soft"|"open"|null, "fuel_type_exclusions": string[]|null, "seat_count": number|null, "seat_need": "exact"|"minimum"|"flexible"|null, "seat_requirement": "hard"|"soft"|null, "budget_min": number|null, "budget_max": number|null, "budget_mode": "capped"|"target"|"flexible"|"open"|null, "price_positioning": "budget"|"value"|"mid"|"premium"|"flagship"|null, "style_intent": "practical"|"premium"|"sporty"|"halo"|null, "must_have_features": string[]|null, "nice_to_have_features": string[]|null, "deal_breakers": string[]|null, "ownership_preference": "durability"|"performance"|"balanced"|null, "is_unsure": boolean}',
    "Budget numbers must be in VND-like absolute units when shorthand is clear: 900m = 900000000, 1 billion = 1000000000.",
    "For vague budget words: cheap/not too expensive -> budget_max null and is_unsure false; mid-range -> budget_max null and is_unsure false.",
    'For replies like "unlimited", "no budget", or "money is no object", set budget_mode to "open".',
    'For replies like "the most expensive one", "flagship", "top-tier", or "fully loaded", set price_positioning to "flagship" and budget_mode to "open" if no numeric budget is given.',
    'For replies like "best value", "bang for buck", or "worth it", set price_positioning to "value".',
    'For replies like "Mostly for commuting to work", "mainly for my family", "meeting clients", "ride-share business", or "highway driving", map use_case to the closest existing backend category rather than copying the sentence.',
    'For replies like "anything except SUV", keep vehicle_type null, set body_type_exclusions to ["suv"], and set vehicle_type_requirement to "open".',
    'For replies like "anything but an SUV" or "rather avoid coupes", use exclusions and do not force a positive body type unless the customer also named one.',
    'For replies like "SUV only" or "must be an SUV", set vehicle_type to "suv" and vehicle_type_requirement to "hard".',
    'For replies like "prefer SUV", set vehicle_type to "suv" and vehicle_type_requirement to "soft".',
    'For replies like "maybe a hatchback or sedan", use the first explicit preference as vehicle_type and keep the rest only if the schema allows it.',
    'Map "estate" to wagon, "people carrier" to mpv, and "roadster" or "convertible" to coupe if no dedicated convertible enum exists.',
    'For replies like "7 seats would be nice" or "7 seats occasionally", set seat_count to 7 and seat_requirement to "soft".',
    'For replies like "must have 7 seats", set seat_count to 7 and seat_requirement to "hard".',
    'For replies like "must have 360 camera" or "need blind-spot monitoring", put those items in must_have_features.',
    'For replies like "nice to have a sunroof" or "bonus if it has Apple CarPlay", put those items in nice_to_have_features.',
    'For replies like "no EV", "avoid manual", or "not too big", put the backend-safe labels into deal_breakers.',
    'For replies like "around 30 to 35 thousand" or "1 to 1.2 billion", return numeric budget_min and budget_max using the shared trailing unit.',
    'For replies like "I can stretch a bit for the right car" or "I do not have a fixed budget", set budget_mode to "flexible" when no numeric budget is provided.',
    'If the customer only talks about financing or monthly payments and gives no reliable budget number, do not invent budget numbers.',
    "For drifting, track, supercar, race car, spirited, or fun driving replies, treat the use case as lifestyle and infer performance preference when the customer implies performance-first ownership.",
    'For replies like "faster is better", "more speed", "quick acceleration", or "sporty feel", set ownership_preference to "performance".',
    `Current question key: ${expectedQuestionKey || "none"}.`,
    `Current profile snapshot JSON: ${JSON.stringify(currentProfile || {})}`,
    `Customer reply: ${JSON.stringify(String(message || ""))}`,
  ].join("\n");
}

function describeAdvisorDataGoal(question) {
  switch (question?.key) {
    case "primary_use_cases":
      return "Learn the customer's main use case or purpose for buying the vehicle.";
    case "passenger_setup":
      return "Learn the preferred vehicle category, body style, or seating need.";
    case "budget_range":
      return "Learn the customer's comfortable budget range or price ceiling.";
    case "tradeoff_preferences":
      return "Learn whether to lean toward easy long-term ownership or faster, sportier performance. If the profile already clearly implies one side, do not sound repetitive.";
    case "top_priorities":
      return "Learn the customer's most important priority after fit and budget.";
    case "driving_conditions":
      return "Learn the customer's normal driving environment.";
    default:
      return question?.question || "Learn the next useful buying criterion.";
  }
}

function normalizeGeneratedSentence(value, fallback, maxLength = 170) {
  const text = stripThinking(value)
    .replace(/\s+/g, " ")
    .replace(/["`]+/g, "")
    .trim();
  if (!text) return fallback;
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function sanitizeCompareAssistantMessage(value, fallback) {
  const text = normalizeGeneratedSentence(value, fallback, 320)
    .replace(/\s+/g, " ")
    .replace(/\s+([?.!,])/g, "$1")
    .trim();
  if (!text) return fallback;
  if (/\b(score|points?|confidence|backend|json|model|ai)\b/i.test(text)) return fallback;
  return text;
}

function sanitizeCompareHighlights(value, fallback = []) {
  const fallbackList = Array.isArray(fallback) ? fallback.slice(0, 3) : [];
  if (!Array.isArray(value)) return fallbackList;

  const items = value
    .slice(0, 3)
    .map((entry) => normalizeGeneratedSentence(entry, "", 60))
    .filter(Boolean)
    .filter((entry) => !/\b(score|points?|confidence|backend|json|model|ai)\b/i.test(entry));

  return items.length ? items : fallbackList;
}

function sanitizeSingleAdvisorQuestion(value, fallback) {
  const text = normalizeGeneratedSentence(value, fallback, 190)
    .replace(/\s+/g, " ")
    .replace(/\s+([?.!,])/g, "$1")
    .trim();
  if (!text) return fallback;

  const normalized = normalizeText(text);
  const questionCount = (text.match(/\?/g) ?? []).length;
  const hasBadChecklistLanguage =
    /\b(still needed|moderate confidence|answer all|few details|core buying priorities|before recommending|responsibly)\b/i.test(text) ||
    /(^|\s)[1-9][.)]\s/.test(text) ||
    /(^|\s)(first|second|third|finally):/i.test(text);
  if (hasBadChecklistLanguage) return fallback;
  if (questionCount > 1) return fallback;
  if (questionCount === 0 || !normalized.includes("?")) return fallback;
  return text;
}

function buildAdvisorQuestionPrompt({ profile, nextQuestion, latestMessage, fallback }) {
  return [
    "/no_think",
    "Use the CarVista advisor skill to write the next chat message like a real dealership consultant.",
    "Return JSON exactly as {\"answer\": string}.",
    "The backend provides a data goal, not a script. Use your own natural phrasing.",
    "Ask one focused question that moves the sale forward. Do not ask for multiple details.",
    "If the customer's latest message already implies a priority, acknowledge it and ask the next useful angle without repeating the same forced choice.",
    "Do not mention confidence, missing fields, state, extraction, backend, JSON, or catalog internals.",
    `next_missing_field: ${nextQuestion?.key || "unknown"}`,
    `data_goal: ${JSON.stringify(describeAdvisorDataGoal(nextQuestion))}`,
    `fallback_question_only_if_needed: ${JSON.stringify(nextQuestion?.question || fallback || "")}`,
    `current_profile_json: ${JSON.stringify(profile || {})}`,
    `latest_customer_message: ${JSON.stringify(String(latestMessage || ""))}`,
  ].join("\n");
}

export async function formatAdvisorNextQuestionWithModel(
  { profile = {}, nextQuestion = null, latestMessage = "", fallback = "" } = {},
  { ollama = defaultOllamaService } = {}
) {
  const safeFallback = sanitizeSingleAdvisorQuestion(fallback, nextQuestion?.question || "What should I help you find?");
  if (!nextQuestion?.question || !shouldUseOllama(ollama)) return safeFallback;

  try {
    const skill = await loadAdvisorSkillMarkdown();
    const result = await ollama.generate({
      system: `${ADVISOR_QUESTION_SYSTEM_PROMPT}\n\n${skill}`,
      prompt: buildAdvisorQuestionPrompt({ profile, nextQuestion, latestMessage, fallback: safeFallback }),
      format: "json",
      options: { temperature: 0.75, num_predict: 130 },
    });
    const parsed = parseModelJson(result.text);
    return sanitizeSingleAdvisorQuestion(parsed?.answer, safeFallback);
  } catch {
    return safeFallback;
  }
}

export async function extractAdvisorProfilePatchWithModel(
  message,
  expectedQuestionKey = null,
  currentProfile = {},
  { ollama = defaultOllamaService } = {}
) {
  const fallbackProfile = extractAdvisorProfilePatch(message, expectedQuestionKey, currentProfile);
  if (!shouldUseOllama(ollama)) return fallbackProfile;

  try {
    const result = await ollama.generate({
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: buildExtractionPrompt({ message, expectedQuestionKey, currentProfile }),
      format: "json",
      options: { temperature: 0, num_predict: 180 },
    });
    const parsed = parseModelJson(result.text);
    if (!parsed || typeof parsed !== "object") return fallbackProfile;
    const modelPatch = advisorExtractionToProfilePatch(parsed, expectedQuestionKey);
    return mergePreferenceProfiles(fallbackProfile, modelPatch);
  } catch {
    return fallbackProfile;
  }
}

function fallbackRecommendationCopy(structuredResult, turnContext = {}) {
  const ranked = (structuredResult?.ranked_vehicles ?? []).slice(0, 3);
  if (!ranked.length) return "I do not have enough grounded catalog matches to recommend a vehicle yet.";
  const profileSummary = structuredResult?.profile_summary;
  const intro = turnContext.directional_shortlist || /partial/i.test(profileSummary || "")
    ? "These are the closest matches currently available in our catalog."
    : "Based on your needs, these are the best matches for you.";
  const lines = ranked.map((item) => {
    const reason = item.reasons?.[0] || item.best_for?.[0] || "A strong fit for your stated needs";
    return `${item.name}: ${reason}.`;
  });
  return [intro, ...lines].join(" ");
}

function buildRecommendationFormattingPrompt(structuredResult, turnContext = {}) {
  const candidates = (structuredResult?.ranked_vehicles ?? []).slice(0, 3).map(compactVehicleForPrompt);
  return [
    "/no_think",
    "Format the backend-ranked recommendation result for a dealership chat.",
    "Use only the vehicles in candidate_vehicles. Do not add or rename vehicles.",
    "Each reason should sound like a smart sales advisor and reflect the customer profile, but it must be based only on fields present in candidate_vehicles.",
    "Good reasons are specific, short, and practical: use case fit, seating, budget, ownership style, fuel type, or body type if present.",
    "Do not mention exact prices or specs unless they are present in candidate_vehicles.",
    "Return JSON with this exact shape:",
    '{"intro": string, "items": [{"variant_id": number|null, "title": string, "reason": string}]}',
    `directional_shortlist: ${Boolean(turnContext.directional_shortlist)}`,
    `profile_summary: ${JSON.stringify(structuredResult?.profile_summary || "")}`,
    `candidate_vehicles: ${JSON.stringify(candidates)}`,
  ].join("\n");
}

function buildCompareFormattingPrompt(result, presentation) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const sorted = [...items].sort(
    (left, right) => (Number(right?.scores?.final_score) || 0) - (Number(left?.scores?.final_score) || 0)
  );

  return [
    "/no_think",
    'Rewrite the grounded comparison verdict into short website copy. Return JSON exactly as {"assistant_message": string, "highlights": string[]}.',
    "Keep it concise and buyer-friendly, with no more than 2 short paragraphs of total copy.",
    "Explain who makes more sense overall, where the other option still makes sense, and mention budget or buyer priorities only if the supplied profile summary makes that relevant.",
    "Do not repeat both full vehicle names in every sentence.",
    "Do not mention raw scoring or confidence.",
    "Avoid duplicated points, avoid robotic wording, and avoid forcing weak claims that do not fit the vehicle character.",
    "If one option is the smarter all-rounder, say that plainly. If the other is more emotional, dramatic, or exotic, position it that way.",
    "Use recall or reliability wording only if it materially matters to the buying decision, and keep it neutral.",
    `comparison_focus: ${JSON.stringify(result?.comparison_focus || "")}`,
    `profile_fit_summary: ${JSON.stringify(result?.profile_fit_summary || "")}`,
    `fallback_assistant_message: ${JSON.stringify(presentation?.assistant_message || "")}`,
    `fallback_highlights: ${JSON.stringify((presentation?.highlights ?? []).slice(0, 3))}`,
    `winner_name: ${JSON.stringify(sorted[0] ? compactCompareItemForPrompt(sorted[0]).title : null)}`,
    `runner_up_name: ${JSON.stringify(sorted[1] ? compactCompareItemForPrompt(sorted[1]).title : null)}`,
    `compared_vehicles: ${JSON.stringify(sorted.slice(0, 2).map(compactCompareItemForPrompt))}`,
  ].join("\n");
}

function sanitizeFormattedRecommendation(parsed, structuredResult, turnContext = {}) {
  const ranked = (structuredResult?.ranked_vehicles ?? []).slice(0, 3);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
    return {
      final_answer: fallbackRecommendationCopy(structuredResult, turnContext),
      structured_result: structuredResult,
    };
  }

  const allowedById = new Map(ranked.map((item) => [Number(item.variant_id), item]));
  const allowedByTitle = new Map(ranked.map((item) => [String(item.name || "").toLowerCase(), item]));
  const lines = [];
  const enhancedReasons = new Map();

  for (const formattedItem of parsed.items.slice(0, 3)) {
    const byId = allowedById.get(Number(formattedItem.variant_id));
    const byTitle = allowedByTitle.get(String(formattedItem.title || "").toLowerCase());
    const source = byId ?? byTitle;
    if (!source) continue;
    const fallbackReason = source.reasons?.[0] || "A strong fit for your stated needs";
    const reason = normalizeGeneratedSentence(formattedItem.reason, fallbackReason, 145);
    enhancedReasons.set(Number(source.variant_id), reason);
    lines.push(`${source.name}: ${reason.replace(/[.]+$/g, "")}.`);
  }

  if (!lines.length) {
    return {
      final_answer: fallbackRecommendationCopy(structuredResult, turnContext),
      structured_result: structuredResult,
    };
  }
  const intro = String(parsed.intro || "").replace(/\s+/g, " ").trim() || (
    turnContext.directional_shortlist
      ? "These are the closest matches currently available in our catalog."
      : "Based on your needs, these are the best matches for you."
  );
  const enhancedResult = {
    ...structuredResult,
    ranked_vehicles: (structuredResult?.ranked_vehicles ?? []).map((item) => {
      const enhancedReason = enhancedReasons.get(Number(item.variant_id));
      if (!enhancedReason) return item;
      const existingReasons = (item.reasons ?? []).filter((reason) => reason !== enhancedReason);
      return {
        ...item,
        reasons: [enhancedReason, ...existingReasons].slice(0, 4),
        llm_reason: enhancedReason,
      };
    }),
  };
  return {
    final_answer: [intro.replace(/[.]+$/g, "."), ...lines].join(" "),
    structured_result: enhancedResult,
  };
}

export async function formatConversationPolicyWithModel(
  intent,
  message,
  policyResponse,
  { ollama = defaultOllamaService } = {}
) {
  const fallback = policyResponse?.final_answer || "I can help with cars, pricing, comparisons, and ownership costs.";
  if (!shouldUseOllama(ollama)) return fallback;

  try {
    const result = await ollama.generate({
      system: POLICY_SYSTEM_PROMPT,
      prompt: [
        "/no_think",
        "Rewrite the policy response so it feels natural but still redirects to dealership help.",
        `intent: ${intent}`,
        `customer_message: ${JSON.stringify(String(message || ""))}`,
        `fallback_policy_response: ${JSON.stringify(fallback)}`,
        'Return JSON as {"answer": string}.',
      ].join("\n"),
      format: "json",
      options: { temperature: 0.4, num_predict: 120 },
    });
    const parsed = parseModelJson(result.text);
    return normalizeGeneratedSentence(parsed?.answer, fallback, 240);
  } catch {
    return fallback;
  }
}

export async function enhanceAdvisorRecommendationWithModel(
  structuredResult,
  turnContext = {},
  { ollama = defaultOllamaService } = {}
) {
  const fallback = {
    final_answer: fallbackRecommendationCopy(structuredResult, turnContext),
    structured_result: structuredResult,
  };
  if (!shouldUseOllama(ollama)) return fallback;

  try {
    const result = await ollama.generate({
      system: FORMAT_SYSTEM_PROMPT,
      prompt: buildRecommendationFormattingPrompt(structuredResult, turnContext),
      format: "json",
      options: { temperature: 0.35, num_predict: 260 },
    });
    return sanitizeFormattedRecommendation(parseModelJson(result.text), structuredResult, turnContext);
  } catch {
    return fallback;
  }
}

export async function formatAdvisorRecommendationWithModel(
  structuredResult,
  turnContext = {},
  { ollama = defaultOllamaService } = {}
) {
  const enhanced = await enhanceAdvisorRecommendationWithModel(structuredResult, turnContext, { ollama });
  return enhanced.final_answer;
}

export async function enhanceComparePresentationWithModel(
  result,
  presentation,
  { ollama = defaultOllamaService } = {}
) {
  const fallback = presentation ?? {};
  if (!shouldUseOllama(ollama) || !fallback.assistant_message) return fallback;

  try {
    const response = await ollama.generate({
      system: COMPARE_FORMAT_SYSTEM_PROMPT,
      prompt: buildCompareFormattingPrompt(result, fallback),
      format: "json",
      options: { temperature: 0.3, num_predict: 190 },
    });
    const parsed = parseModelJson(response.text);
    if (!parsed || typeof parsed !== "object") return fallback;

    return {
      ...fallback,
      assistant_message: sanitizeCompareAssistantMessage(parsed.assistant_message, fallback.assistant_message),
      highlights: sanitizeCompareHighlights(parsed.highlights, fallback.highlights),
    };
  } catch {
    return fallback;
  }
}
