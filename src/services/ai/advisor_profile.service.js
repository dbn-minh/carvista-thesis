const KNOWN_BRANDS = [
  "toyota",
  "honda",
  "hyundai",
  "kia",
  "mazda",
  "ford",
  "chevrolet",
  "bmw",
  "mercedes-benz",
  "mercedes",
  "audi",
  "lexus",
  "nissan",
  "mitsubishi",
  "subaru",
  "volkswagen",
  "volvo",
  "porsche",
  "ferrari",
  "lamborghini",
  "mclaren",
  "aston martin",
  "land rover",
  "mini",
  "peugeot",
  "byd",
  "vinfast",
];

const BODY_TYPE_SYNONYMS = new Map([
  ["crossover", "cuv"],
  ["crossovers", "cuv"],
  ["cuv", "cuv"],
  ["suv", "suv"],
  ["suvs", "suv"],
  ["compact suv", "suv"],
  ["xe gam cao", "suv"],
  ["xe cao", "suv"],
  ["sedan", "sedan"],
  ["sedans", "sedan"],
  ["small sedan", "sedan"],
  ["compact sedan", "sedan"],
  ["hatchback", "hatchback"],
  ["hatchbacks", "hatchback"],
  ["hatch", "hatchback"],
  ["mpv", "mpv"],
  ["mpvs", "mpv"],
  ["minivan", "mpv"],
  ["minivans", "mpv"],
  ["van", "mpv"],
  ["vans", "mpv"],
  ["people carrier", "mpv"],
  ["people carriers", "mpv"],
  ["pickup", "pickup"],
  ["pickups", "pickup"],
  ["pickup truck", "pickup"],
  ["pickup trucks", "pickup"],
  ["ban tai", "pickup"],
  ["truck", "pickup"],
  ["wagon", "wagon"],
  ["wagons", "wagon"],
  ["estate", "wagon"],
  ["estates", "wagon"],
  ["coupe", "coupe"],
  ["coupes", "coupe"],
  ["convertible", "coupe"],
  ["convertibles", "coupe"],
  ["roadster", "coupe"],
  ["roadsters", "coupe"],
  ["sports car", "coupe"],
  ["sport car", "coupe"],
  ["supercar", "coupe"],
  ["super car", "coupe"],
  ["hypercar", "coupe"],
  ["race car", "coupe"],
  ["track car", "coupe"],
]);

const FUEL_TYPE_SYNONYMS = new Map([
  ["ev", "ev"],
  ["electric", "ev"],
  ["xe dien", "ev"],
  ["bev", "ev"],
  ["hybrid", "hybrid"],
  ["plug in hybrid", "phev"],
  ["plug-in hybrid", "phev"],
  ["phev", "phev"],
  ["diesel", "diesel"],
  ["dau", "diesel"],
  ["petrol", "gasoline"],
  ["gasoline", "gasoline"],
  ["gas", "gasoline"],
  ["xang", "gasoline"],
]);

const FEATURE_ALIASES = new Map([
  ["apple carplay", "apple_carplay"],
  ["android auto", "android_auto"],
  ["camera 360", "camera_360"],
  ["360 camera", "camera_360"],
  ["rear camera", "rear_camera"],
  ["reverse camera", "rear_camera"],
  ["blind spot", "blind_spot_monitor"],
  ["blind-spot", "blind_spot_monitor"],
  ["adaptive cruise", "adaptive_cruise_control"],
  ["lane keep", "lane_keep_assist"],
  ["lane assist", "lane_keep_assist"],
  ["automatic emergency braking", "automatic_emergency_braking"],
  ["aeb", "automatic_emergency_braking"],
  ["ventilated seats", "ventilated_seats"],
  ["cooled seats", "ventilated_seats"],
  ["sunroof", "sunroof"],
  ["panoramic roof", "panoramic_roof"],
  ["power tailgate", "power_tailgate"],
  ["electric tailgate", "power_tailgate"],
  ["captain seats", "captain_seats"],
  ["third row", "third_row"],
]);

export const ADVISOR_DISCOVERY_QUESTIONS = [
  {
    key: "primary_use_cases",
    question: "What will you mainly use the vehicle for?",
    examples: ["taxi or ride-hailing", "daily commute", "family use", "business", "long trips", "fun or performance driving"],
    required: true,
  },
  {
    key: "passenger_setup",
    question: "What type of vehicle do you prefer?",
    examples: ["sedan", "SUV", "MPV", "pickup", "5-seater", "7-seater", "I'm not sure"],
    required: true,
  },
  {
    key: "budget_range",
    question: "What is your budget range?",
    examples: ["under 800m", "around 1 billion", "700 to 900 million", "mid-range"],
    required: true,
  },
  {
    key: "tradeoff_preferences",
    question: "Do you prefer durability and low maintenance, or stronger performance and a sportier feel?",
    examples: ["durability and low maintenance", "stronger performance", "sportier feel", "balanced"],
    required: true,
  },
  {
    key: "top_priorities",
    question: "What matters most after budget and fit?",
    examples: ["fuel savings", "safety", "comfort", "technology", "easy ownership"],
    required: false,
  },
  {
    key: "driving_conditions",
    question: "Where will you drive most often?",
    examples: ["mostly city", "mixed city and highway", "long trips", "rough roads"],
    required: false,
  },
  {
    key: "preferred_body_types",
    question: "Any body style you want to prioritize?",
    examples: ["compact SUV", "sedan is fine", "no strong preference"],
    required: false,
  },
  {
    key: "preferred_fuel_types",
    question: "Any fuel type preference?",
    examples: ["hybrid if possible", "gasoline is fine", "EV only if charging is practical"],
    required: false,
  },
  {
    key: "brand_preferences",
    question: "Any brands you prefer or want to avoid?",
    examples: ["prefer Japanese brands", "avoid European cars", "Toyota or Honda"],
    required: false,
  },
  {
    key: "must_have_features",
    question: "Any must-have feature?",
    examples: ["360 camera", "no manual transmission", "good rear-seat space"],
    required: false,
  },
  {
    key: "buying_timeline",
    question: "Are you browsing or planning to buy soon?",
    examples: ["just browsing", "comparing now", "buying soon"],
    required: false,
  },
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function toInteger(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function toMoney(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeBodyType(value) {
  const normalized = normalizeText(value);
  return BODY_TYPE_SYNONYMS.get(normalized) ?? (normalized || null);
}

function normalizeFuelType(value) {
  const normalized = normalizeText(value);
  return FUEL_TYPE_SYNONYMS.get(normalized) ?? (normalized || null);
}

function normalizeFeature(value) {
  const normalized = normalizeText(value);
  return FEATURE_ALIASES.get(normalized) ?? normalized ?? null;
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

function normalizeRequirement(value, allowed = ["hard", "soft", "open"]) {
  const normalized = normalizeText(value);
  return allowed.includes(normalized) ? normalized : null;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPhrasePattern(value) {
  return escapeRegExp(normalizeText(value)).replace(/\s+/g, "\\s+");
}

function phraseMatches(normalized, phrase) {
  if (!normalized || !phrase) return false;
  return new RegExp(`\\b${buildPhrasePattern(phrase)}\\b`, "i").test(normalized);
}

function detectMentionSignal(normalized, phrase, { allowImplicit = true } = {}) {
  if (!normalized || !phrase) return null;
  const pattern = buildPhrasePattern(phrase);
  const prefixedArticle = `(?:an?\\s+)?${pattern}`;
  const exclusionPatterns = [
    `\\b(?:anything|any car|any vehicle|whatever)\\s+(?:except|but not|other than)\\s+${prefixedArticle}\\b`,
    `\\b(?:anything|any car|any vehicle|whatever)\\s+but\\s+${prefixedArticle}\\b`,
    `\\b(?:except|but not|other than)\\s+${prefixedArticle}\\b`,
    `\\b(?:no|not|without|avoid|skip|dont want|do not want|never)\\s+${prefixedArticle}\\b`,
  ];
  if (exclusionPatterns.some((entry) => new RegExp(entry, "i").test(normalized))) return "exclude";

  const hardPatterns = [
    `\\b(?:must be|must have|have to be|needs to be|need|require|only|strictly|looking for|searching for|show me|find me)\\s+${prefixedArticle}\\b`,
    `\\b${pattern}\\s+only\\b`,
  ];
  if (hardPatterns.some((entry) => new RegExp(entry, "i").test(normalized))) return "hard";

  const softPatterns = [
    `\\b(?:prefer|lean(?:ing)? toward|ideally|would like|something like|open to|happy with)\\s+${prefixedArticle}\\b`,
    `\\b${pattern}\\s+(?:is fine|would work|works too|sounds good)\\b`,
  ];
  if (softPatterns.some((entry) => new RegExp(entry, "i").test(normalized))) return "soft";

  return allowImplicit && phraseMatches(normalized, phrase) ? "soft" : null;
}

function detectCategoricalSignals(normalized, values = [], mapper = (value) => normalizeText(value), { allowImplicit = true } = {}) {
  const hard = [];
  const soft = [];
  const rejected = [];
  const orderedValues = [...values].sort((left, right) => {
    const leftIndex = normalized.indexOf(normalizeText(left));
    const rightIndex = normalized.indexOf(normalizeText(right));
    const normalizedLeft = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
    const normalizedRight = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;
    if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
    return String(right).length - String(left).length;
  });

  for (const value of orderedValues) {
    const signal = detectMentionSignal(normalized, value, { allowImplicit });
    const normalizedValue = mapper(value);
    if (!normalizedValue) continue;
    if (signal === "exclude") rejected.push(normalizedValue);
    else if (signal === "hard") hard.push(normalizedValue);
    else if (signal === "soft") soft.push(normalizedValue);
  }

  const rejectedValues = unique(rejected);
  const preferredValues = unique([...hard, ...soft].filter((value) => !rejectedValues.includes(value)));
  const requirement = hard.length > 0 ? "hard" : preferredValues.length > 0 ? "soft" : rejectedValues.length > 0 ? "open" : null;

  return {
    preferred: preferredValues,
    rejected: rejectedValues,
    requirement,
  };
}

function detectFeatureSignals(normalized) {
  const mustHave = [];
  const niceToHave = [];

  for (const key of [...FEATURE_ALIASES.keys()].sort((left, right) => right.length - left.length)) {
    const pattern = buildPhrasePattern(key);
    const mustHavePatterns = [
      `\\b(?:must have|need|require|have to have|deal breaker without)\\s+(?:a\\s+)?${pattern}\\b`,
      `\\b${pattern}\\s+is a must\\b`,
    ];
    const niceToHavePatterns = [
      `\\b(?:nice to have|would be nice|bonus|if possible|ideally|prefer)\\s+(?:a\\s+)?${pattern}\\b`,
      `\\b${pattern}\\s+would be nice\\b`,
    ];
    const normalizedFeature = normalizeFeature(key);
    if (!normalizedFeature) continue;
    if (mustHavePatterns.some((entry) => new RegExp(entry, "i").test(normalized))) {
      mustHave.push(normalizedFeature);
    } else if (niceToHavePatterns.some((entry) => new RegExp(entry, "i").test(normalized))) {
      niceToHave.push(normalizedFeature);
    }
  }

  return {
    mustHave: unique(mustHave),
    niceToHave: unique(niceToHave.filter((feature) => !mustHave.includes(feature))),
  };
}

function normalizeArray(values, mapper = (value) => normalizeText(value)) {
  if (values == null) return [];
  const items = Array.isArray(values) ? values : String(values).split(/[;,/]/);
  return unique(items.map((item) => mapper(item)).filter(Boolean));
}

function parseFlexibleNumber(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) return Number(value.replace(/,/g, ""));
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) return Number(value.replace(/\./g, "").replace(",", "."));
  const numeric = Number(value.replace(/,/g, "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function budgetUnitMultiplier(unit) {
  const normalized = String(unit || "").toLowerCase();
  if (["billion", "bn", "bil", "ty", "ti"].includes(normalized)) return 1_000_000_000;
  if (["million", "m", "trieu"].includes(normalized)) return 1_000_000;
  if (["thousand", "k", "grand"].includes(normalized)) return 1_000;
  if (normalized === "usd" || normalized === "$") return 25_000;
  return 1;
}

function parseBudgetAmount(rawAmount, rawUnit = "") {
  let amount = parseFlexibleNumber(rawAmount);
  if (!Number.isFinite(amount)) return null;
  amount *= budgetUnitMultiplier(rawUnit);
  return amount >= 10_000 ? amount : null;
}

function collectSharedUnitBudgetValues(normalized) {
  const rangePatterns = [
    /(?:between|around|about|roughly|somewhere(?: in)?|near)?\s*(\d+(?:[.,]\d+)?)\s*(?:to|-|and)\s*(\d+(?:[.,]\d+)?)\s*(billion|bn|bil|million|m|thousand|k|grand|ty|ti|trieu|usd|vnd|\$)\b/g,
    /(?:from)\s*(\d+(?:[.,]\d+)?)\s*(?:to)\s*(\d+(?:[.,]\d+)?)\s*(billion|bn|bil|million|m|thousand|k|grand|ty|ti|trieu|usd|vnd|\$)\b/g,
  ];
  const values = [];
  for (const pattern of rangePatterns) {
    for (const match of normalized.matchAll(pattern)) {
      const first = parseBudgetAmount(match[1], match[3]);
      const second = parseBudgetAmount(match[2], match[3]);
      if (Number.isFinite(first)) values.push(first);
      if (Number.isFinite(second)) values.push(second);
    }
  }
  return values;
}

function collectTextBudgetHints(normalized) {
  const values = [];
  if (/\bhalf a billion\b/.test(normalized)) values.push(500_000_000);
  if (/\ba billion\b/.test(normalized)) values.push(1_000_000_000);
  if (/\ba million\b/.test(normalized)) values.push(1_000_000);
  return values;
}

function detectBudgetRange(message) {
  const normalized = normalizeText(message);
  const matches = [...normalized.matchAll(/(\d+(?:[.,]\d+)?)\s*(billion|bn|bil|million|m|thousand|k|grand|ty|ti|trieu|usd|vnd|\$)?/g)];
  const budgetOpen = /\b(unlimited|no budget|open budget|budget is open|money no object|price is not a concern|price doesnt matter|price doesn't matter|sky is the limit|any price is fine)\b/.test(normalized);
  const flagship = /\b(most expensive|top tier|top-tier|flagship|top of the line|top-of-the-line|highest spec|highest trim|fully loaded|halo car|best available)\b/.test(normalized);
  const premium = /\b(premium|luxury|high end|high-end|upscale)\b/.test(normalized);
  const value = /\b(best value|value for money|bang for buck|worth it|smart buy)\b/.test(normalized);
  const budgetFocused = /\b(cheapest|lowest price|lowest cost|entry level|entry-level|budget pick)\b/.test(normalized);
  const flexibleBudget = /\b(flexible|open budget|not fixed|depends|can stretch|stretch a bit|stretch for the right car|open if its worth it|open if it's worth it|not super strict|worth paying more)\b/.test(normalized);

  if (!matches.length) {
    const textBudgetValues = collectTextBudgetHints(normalized);
    if (budgetOpen || flagship) {
      return {
        budget_mode: "open",
        budget_flexibility: "open",
        price_positioning: flagship ? "flagship" : null,
        style_intent: flagship ? "halo" : premium ? "premium" : null,
      };
    }
    if (premium) return { budget_mode: "flexible", budget_flexibility: "flexible", price_positioning: "premium", style_intent: "premium" };
    if (value) return { budget_mode: "flexible", budget_flexibility: "flexible", price_positioning: "value", style_intent: "practical" };
    if (budgetFocused) return { budget_mode: "capped", budget_flexibility: "low", price_positioning: "budget", style_intent: "practical" };
    if (/\b(cheap|affordable|budget|entry level|not too expensive|low cost)\b/.test(normalized)) return { budget_flexibility: "low" };
    if (/\b(mid range|mid-range|middle range|reasonable|moderate)\b/.test(normalized)) return { budget_flexibility: "medium" };
    if (flexibleBudget) return { budget_mode: "flexible", budget_flexibility: "flexible" };
    if (textBudgetValues.length) {
      const min = Math.min(...textBudgetValues);
      const max = Math.max(...textBudgetValues);
      return {
        budget_target: textBudgetValues.length === 1 ? min : Math.round((min + max) / 2),
        budget_ceiling: textBudgetValues.length > 1 ? max : null,
        budget_mode: "target",
      };
    }
    return {};
  }

  let values = matches
    .map((match) => {
      return parseBudgetAmount(match[1], match[2]);
    })
    .filter((value) => Number.isFinite(value));

  const sharedUnitValues = collectSharedUnitBudgetValues(normalized);
  if (sharedUnitValues.length > values.length) {
    values = sharedUnitValues;
  } else if (!values.length) {
    values = collectTextBudgetHints(normalized);
  }

  if (!values.length) return {};
  const min = Math.min(...values);
  const max = Math.max(...values);
  const hasCeilingLanguage = /\b(ceiling|max|under|below|duoi|toi da|tran|khong qua|up to|at most|no more than|keep it below|spend more than)\b/.test(normalized);
  const budgetMode =
    budgetOpen
      ? "open"
      : flexibleBudget
        ? "flexible"
        : hasCeilingLanguage
          ? "capped"
          : "target";
  const pricePositioning = flagship ? "flagship" : premium ? "premium" : value ? "value" : budgetFocused ? "budget" : null;

  return {
    budget_target: values.length === 1 ? values[0] : Math.round((min + max) / 2),
    budget_ceiling:
      hasCeilingLanguage
        ? max
        : values.length > 1
          ? max
          : null,
    budget_mode: budgetMode,
    budget_flexibility: budgetMode === "open" ? "open" : budgetMode === "flexible" ? "flexible" : null,
    price_positioning: pricePositioning,
    style_intent: flagship ? "halo" : premium ? "premium" : value || budgetFocused ? "practical" : null,
  };
}

function detectPassengerSignals(message) {
  const normalized = normalizeText(message);
  const familyMatch = normalized.match(/(?:family of|gia dinh|nha minh|nha toi)\s*(\d+)/);
  const passengerMatch = normalized.match(/(\d+)\s*(people|person|passengers|seats?|adults|kids|children|nguoi|cho|ghe|con|tre em)/);
  const count = familyMatch ? Number(familyMatch[1]) : passengerMatch ? Number(passengerMatch[1]) : null;
  const needsSevenSeats =
    normalized.includes("7 seats") ||
    normalized.includes("seven seats") ||
    normalized.includes("7 cho") ||
    normalized.includes("bay cho") ||
    normalized.includes("third row") ||
    (Number.isFinite(count) && count >= 6);
  const seatRequirement =
    /\b(occasionally|backup|just in case|would be nice|nice to have|if possible|thinh thoang|du phong)\b/.test(normalized)
      ? "soft"
      : needsSevenSeats
        ? "hard"
        : null;

  return {
    regular_passenger_count: Number.isFinite(count) ? count : null,
    family_size: Number.isFinite(count) ? count : null,
    needs_7_seats: needsSevenSeats ? true : null,
    child_present: /\b(kid|kids|child|children|baby|babies|tre em|em be|con nho|con)\b/.test(normalized) ? true : null,
    elderly_present: /\b(elderly|older parents|grandparents|senior|nguoi lon tuoi|ong ba|bo me)\b/.test(normalized) ? true : null,
    seat_need:
      /\b(at least|min(?:imum)?|or more|backup|occasionally|just in case|du phong|thinh thoang)\b/.test(normalized)
        ? "minimum"
        : Number.isFinite(count)
          ? "exact"
          : /\b(any seats|flexible seating|open on seats)\b/.test(normalized)
            ? "flexible"
            : null,
    seat_requirement: seatRequirement,
    cargo_needs: /\b(luggage|cargo|stroller|gear|golf|carry a lot|boot space|hanh ly|do dac|xe day|do tre em)\b/.test(normalized)
      ? "high"
      : /\b(a few bags|light cargo|it hanh ly)\b/.test(normalized)
        ? "medium"
        : null,
  };
}

function detectDrivingConditions(message) {
  const normalized = normalizeText(message);
  let cityVsHighway = null;
  const cityPattern = /\b(city|urban|traffic|commute|downtown|hcm|hanoi|ha noi|sai gon|saigon|tphcm|thanh pho|noi do|duong pho|di pho|ket xe|di lam)\b/;
  const highwayPattern = /\b(highway|long trip|road trip|interstate|cao toc|duong dai|di xa|di tinh|duong truong)\b/;
  const roughRoadPattern = /\b(bad road|rough road|pothole|rural|country road|mountain|slope|hill|duong xau|duong de|duong nui|deo|doc|nong thon|duong que)\b/;
  if (cityPattern.test(normalized) && highwayPattern.test(normalized)) {
    cityVsHighway = "mixed";
  } else if (cityPattern.test(normalized)) {
    cityVsHighway = "mostly_city";
  } else if (highwayPattern.test(normalized)) {
    cityVsHighway = "mostly_highway";
  }

  const roadConditions = unique([
    cityPattern.test(normalized) ? "city_traffic" : null,
    /\b(highway|road trip|expressway|motorway|cao toc|duong dai|di xa|duong truong)\b/.test(normalized) ? "highway" : null,
    roughRoadPattern.test(normalized) ? "rough_roads" : null,
    /\b(flood|flooded|ngap)\b/.test(normalized) ? "flood_risk" : null,
  ]);

  return {
    city_vs_highway_ratio: cityVsHighway,
    road_conditions: roadConditions,
    flood_risk: roadConditions.includes("flood_risk") ? true : null,
    parking_constraints: /\b(tight parking|small garage|basement|narrow alley|tight space|easy to park|bai dau chat|ham|ham xe|ngo hep|hem nho)\b/.test(normalized)
      ? "tight"
      : /\b(easy parking|large parking|wide parking|dau xe rong|bai dau rong|de dau xe)\b/.test(normalized)
        ? "relaxed"
        : null,
  };
}

function detectUseCases(message) {
  const normalized = normalizeText(message);
  const useCaseDefinitions = [
    {
      key: "daily_commute",
      pattern: /\b(commute|commuting|go to work|work and back|daily drive|daily driving|daily commute|day-to-day|day to day|everyday use|everyday driving|get around town|getting around town|office commute|errands|day-to-day use|nothing too special|di lam|di hang ngay|di moi ngay)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,45}\b(commute|commuting|daily driving|day-to-day|getting around town|office commute|work and back|city driving for work)\b|\b(commute|commuting|daily driving|day-to-day|office commute)\b[\w\s'-]{0,20}\b(?:mostly|mainly|primarily)\b/,
    },
    {
      key: "city_driving",
      pattern: /\b(city|urban|traffic|around town|thanh pho|noi do|di pho|ket xe)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,35}\b(city driving|around town|urban driving)\b/,
    },
    {
      key: "family",
      pattern: /\b(family|kids|children|parents|wife|school run|school runs|school drop-off|school drop-offs|school drop off|school drop offs|family outing|family outings|family errand|family errands|drive the kids around|gia dinh|con nho|tre em|bo me|ong ba)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,45}\b(family|family use|school runs?|school drop-offs?|drive the kids around|family outings?)\b|\bfamily car, mostly\b/,
    },
    {
      key: "business",
      pattern: /\b(client|clients|business|office|meeting|meetings|company use|company|site visit|site visits|work purposes|work-related travel|cong viec|khach hang|di gap khach|doanh nhan)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,45}\b(business|meeting clients?|company use|site visits?|work purposes?|work-related travel|for work)\b/,
    },
    {
      key: "road_trip",
      pattern: /\b(travel|trip|trips|weekend|getaway|touring|holiday|road trip|road trips|long-distance|long distance|long journeys?|long drives?|highway driving|highway cruising|out-of-town travel|between cities|comfortable for long trips|du lich|di xa|duong dai|cuoi tuan|di tinh)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,45}\b(long-distance travel|highway driving|road trips?|long journeys?|long drives?|between cities|out-of-town travel)\b/,
    },
    {
      key: "commercial_service",
      pattern: /\b(service|grab|uber|taxi|ride hailing|ride-hailing|rideshare|ride-share|ride share|passengers around full-time|ride-share business|commercial|chay dich vu|kinh doanh|taxi cong nghe)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,45}\b(ride-hailing|rideshare|ride-share|taxi work|taxi|uber|grab)\b/,
    },
    {
      key: "cargo",
      pattern: /\b(cargo|load|goods|carry equipment|cho hang|hang hoa|do nghe|cho do)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,35}\b(cargo|goods|carry equipment)\b/,
    },
    {
      key: "offroad",
      pattern: /\b(offroad|off-road|mountain|trail|di duong xau|duong nui|leo deo)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,35}\b(off-road|offroad|mountain|trail)\b/,
    },
    {
      key: "lifestyle",
      pattern: /\b(style|image|look good|fun|fun to drive|driving enjoyment|driving experience|passion|weekend toy|weekend fun|dream car|speed and handling|exciting to drive|drift|drifting|track day|track use|race car|racing|supercar|super car|hypercar|autocross|spirited driving|performance driving|kieu dang|phong cach|dep|the thao)\b/,
      dominant: /\b(?:mostly|mainly|primarily)\b[\w\s'-]{0,45}\b(fun driving|performance driving|driving enjoyment|driving experience|weekend fun|spirited driving|speed and handling)\b/,
    },
  ];

  const baseRecognized = unique(useCaseDefinitions.map((entry) => (entry.pattern.test(normalized) ? entry.key : null)));
  const dominantRecognized = unique(useCaseDefinitions.map((entry) => (entry.dominant.test(normalized) ? entry.key : null)));
  const primary = unique([...dominantRecognized, ...baseRecognized]);

  return {
    primary_use_cases: primary.slice(0, 3),
    secondary_use_cases: primary.slice(3, 5),
    usage_frequency: /\b(daily|every day|hang ngay|moi ngay)\b/.test(normalized) ? "daily" : /\b(weekend|occasionally|sometimes|cuoi tuan|thinh thoang)\b/.test(normalized) ? "occasional" : null,
    daily_distance_km: (() => {
      const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*km/);
      return match ? Math.round(parseFlexibleNumber(match[1])) : null;
    })(),
  };
}

function detectPreferences(message) {
  const normalized = normalizeText(message);
  const bodySignals = detectCategoricalSignals(normalized, BODY_TYPE_SYNONYMS.keys(), normalizeBodyType);
  const fuelSignals = detectCategoricalSignals(normalized, FUEL_TYPE_SYNONYMS.keys(), normalizeFuelType);
  const brands = KNOWN_BRANDS.filter((brand) => phraseMatches(normalized, brand));
  const preferredBrands = /\b(prefer|like|love|want|lean toward|thich|muon|uu tien|nghieng ve)\b/.test(normalized) ? brands : [];
  const rejectedBrands = /\b(avoid|hate|don't want|do not want|no|tranh|khong thich|khong muon|khong chon)\b/.test(normalized) ? brands : [];
  const styleIntent =
    /\b(flagship|halo car|top of the line|top-tier|most expensive|highest spec|highest trim|fully loaded)\b/.test(normalized)
      ? "halo"
      : /\b(premium|luxury|high end|high-end|prestige)\b/.test(normalized)
        ? "premium"
        : /\b(sporty|fun|exciting|performance|track|race|drift|weekend toy)\b/.test(normalized)
          ? "sporty"
          : /\b(practical|value|easy ownership|sensible|family friendly)\b/.test(normalized)
            ? "practical"
            : null;

  return {
    preferred_body_types: bodySignals.preferred,
    rejected_body_types: bodySignals.rejected,
    body_type_requirement: bodySignals.requirement,
    preferred_fuel_types: fuelSignals.preferred,
    rejected_fuel_types: fuelSignals.rejected,
    fuel_type_requirement: fuelSignals.requirement,
    transmission_preference: /\b(manual|stick)\b/.test(normalized) ? "manual" : /\b(automatic|auto|cvt|dct)\b/.test(normalized) ? "automatic" : null,
    awd_need: /\b(awd|4wd|4x4|all wheel drive|snow|offroad)\b/.test(normalized) ? true : null,
    brand_preferences: unique(preferredBrands),
    brand_rejections: unique(rejectedBrands),
    emotional_motivators: unique([
      /\b(luxury|premium|prestige)\b/.test(normalized) ? "premium_image" : null,
      /\b(sporty|fun|exciting|performance|drift|drifting|track day|track use|race car|racing|supercar|super car|hypercar|autocross|spirited driving|boc|the thao)\b/.test(normalized) ? "sporty_identity" : null,
      /\b(family|safe|peace of mind|gia dinh|an toan)\b/.test(normalized) ? "family_security" : null,
      /\b(style|design|look|kieu dang|thiet ke|dep)\b/.test(normalized) ? "design_affinity" : null,
    ]),
    style_intent: styleIntent,
  };
}

function detectOwnershipSignals(message) {
  const normalized = normalizeText(message);
  const financeOrMonthly = /\b(finance|financing|installment|loan|monthly payment|financing terms|monthly payment is manageable|monthly payment matters more than sticker price|depends on the financing terms|ownership cost)\b/.test(normalized);
  return {
    payment_method: financeOrMonthly ? "finance" : /\b(cash|pay upfront|pay in full)\b/.test(normalized) ? "cash" : null,
    monthly_payment_limit: (() => {
      const match = normalized.match(/monthly(?: payment)?(?: around| under| max| below)?\s*(\d+(?:[.,]\d+)?)\s*(billion|bn|bil|million|m|thousand|k|grand|trieu|usd|vnd)?/);
      if (!match) return null;
      return parseBudgetAmount(match[1], match[2]);
    })(),
    down_payment: (() => {
      const match = normalized.match(/down payment(?: around| about| under)?\s*(\d+(?:[.,]\d+)?)\s*(million|m|trieu|usd|vnd)?/);
      if (!match) return null;
      let amount = parseFlexibleNumber(match[1]);
      const unit = String(match[2] || "").toLowerCase();
      if (["million", "m", "trieu"].includes(unit)) amount *= 1_000_000;
      else if (unit === "usd") amount *= 25_000;
      return Number.isFinite(amount) ? amount : null;
    })(),
    charging_availability: /\b(home charger|charge at home|have charging|sac tai nha|co cho sac)\b/.test(normalized)
      ? "home"
      : /\b(public charging|public charger|tram sac cong cong)\b/.test(normalized)
        ? "public"
        : /\b(no charger|cannot charge|no charging|khong co cho sac|khong sac duoc)\b/.test(normalized)
          ? "none"
          : null,
    buying_timeline: /\b(this month|soon|immediately|right away|thang nay|mua som|mua ngay)\b/.test(normalized)
      ? "buying_soon"
      : /\b(this quarter|next few months|vai thang toi)\b/.test(normalized)
        ? "near_term"
        : /\b(research|just looking|exploring|dang tim hieu|tham khao)\b/.test(normalized)
          ? "researching"
          : null,
    consideration_stage: /\b(compare|shortlist|deciding|so sanh|chot|lua chon)\b/.test(normalized)
      ? "comparing"
      : /\b(buy soon|book|deposit|dat coc|mua som)\b/.test(normalized)
        ? "ready_to_buy"
        : /\b(research|exploring|tim hieu|tham khao)\b/.test(normalized)
          ? "researching"
          : null,
  };
}

function detectPrioritySignals(message) {
  const normalized = normalizeText(message);
  const featureSignals = detectFeatureSignals(normalized);
  return {
    performance_priority: /\b(performance|fast|faster|quick|quicker|quickest|speed|power|sporty|fun to drive|drift|drifting|track day|track use|race car|racing|supercar|super car|hypercar|autocross|spirited driving|van hanh|cam giac lai|boc|manh|the thao|hieu nang|tang toc)\b/.test(normalized) ? 0.95 : null,
    fuel_saving_priority: /\b(fuel economy|efficient|save fuel|economy|cheap to run|tiet kiem xang|tiet kiem nhien lieu|it hao xang|chi phi xang)\b/.test(normalized) ? 0.95 : null,
    comfort_priority: /\b(comfort|smooth|quiet|refined|rear seat|tien nghi|em ai|yen tinh|rong rai|hang ghe sau)\b/.test(normalized) ? 0.9 : null,
    tech_priority: /\b(technology|tech|apple carplay|android auto|360 camera|screen|features|cong nghe|man hinh|camera 360|tinh nang)\b/.test(normalized) ? 0.9 : null,
    safety_priority: /\b(safe|safety|adas|blind spot|lane keep|family safety|an toan|ho tro lai|diem mu)\b/.test(normalized) ? 0.95 : null,
    maintenance_cost_priority: /\b(low maintenance|easy to maintain|cheap to maintain|simple ownership|it bao duong|de bao duong|de nuoi|chi phi bao duong|de sua|it ton bao duong)\b/.test(normalized) ? 0.95 : null,
    resale_value_priority: /\b(resale|sell later|keep value|hold value|giu gia|ban lai|thanh khoan)\b/.test(normalized) ? 0.92 : null,
    style_priority: /\b(style|design|look good|premium image|impressive|kieu dang|thiet ke|dep|sang|hinh anh)\b/.test(normalized) ? 0.88 : null,
    reliability_priority: /\b(reliable|durability|durable|dependable|ben|ben bi|lanh|it hong|khoe|noi dong coi da)\b/.test(normalized) ? 0.95 : null,
    must_have_features: featureSignals.mustHave,
    nice_to_have_features: featureSignals.niceToHave,
    deal_breakers: unique([
      /\b(no manual|avoid manual)\b/.test(normalized) ? "manual_transmission" : null,
      /\b(no ev|avoid ev|no electric)\b/.test(normalized) ? "ev_powertrain" : null,
      /\b(no big suv|too big)\b/.test(normalized) ? "oversized_vehicle" : null,
      /\b(no chinese brands|avoid chinese brands)\b/.test(normalized) ? "avoid_chinese_brands" : null,
    ]),
    tradeoff_preferences: unique([
      /\b(space over performance|space matters more|rong rai hon van hanh|khong gian hon suc manh)\b/.test(normalized) ? "space_over_performance" : null,
      /\b(brand over features|badge over equipment|thuong hieu hon option|thuong hieu hon tinh nang)\b/.test(normalized) ? "brand_over_features" : null,
      /\b(efficiency over power|fuel economy over performance|tiet kiem hon suc manh|tiet kiem xang hon van hanh)\b/.test(normalized) ? "efficiency_over_performance" : null,
      /\b(comfort over sporty|comfort over handling|tien nghi hon the thao|em ai hon cam giac lai)\b/.test(normalized) ? "comfort_over_performance" : null,
      /\b(easy ownership over fancy tech|reliability over tech|de nuoi hon cong nghe|ben hon option)\b/.test(normalized) ? "reliability_over_tech" : null,
      /\b(durability|durable|reliable|low maintenance|lower maintenance|easy ownership|practical ownership|ben hon hieu nang|ben hon boc|de nuoi hon boc|de nuoi hon hieu nang|ben de nuoi)\b/.test(normalized) ? "reliability_over_performance" : null,
      /\b(performance|sportier feel|sporty feel|sportier|stronger performance|better acceleration|driving excitement|fast|faster|faster is better|quick|quicker|quickest|speed|more speed|power over reliability|drift|drifting|track day|track use|race car|racing|supercar|super car|hypercar|autocross|hieu nang hon do ben|boc hon ben|manh hon ben)\b/.test(normalized) ||
      /\b(uu tien|thich|muon)\s+(xe\s+)?(boc|hieu nang|manh|the thao)\b/.test(normalized) ||
      /\b(chap nhan bao duong|khong ngai bao duong).*(boc|hieu nang|manh|the thao)\b/.test(normalized)
        ? "performance_over_reliability"
        : null,
      /\b(balanced|balance|either is fine|not sure|i am not sure|i'm not sure|no preference|open)\b/.test(normalized) ? "balanced" : null,
    ]),
  };
}

function deriveConfidenceLevel(profile) {
  const answered = [
    profile.primary_use_cases?.length,
    profile.budget_target || profile.budget_ceiling || profile.budget_mode || profile.price_positioning,
    profile.regular_passenger_count || profile.family_size || profile.needs_7_seats != null,
    profile.city_vs_highway_ratio || profile.road_conditions?.length || profile.parking_constraints,
    profile.performance_priority || profile.fuel_saving_priority || profile.comfort_priority || profile.tech_priority || profile.safety_priority || profile.style_priority,
  ].filter(Boolean).length;
  if (answered >= 5) return "high";
  if (answered >= 3) return "medium";
  return "low";
}

export function derivePriorityWeights(profile = {}) {
  const weights = {
    budget_fit: 1.1,
    use_case_fit: 1.25,
    size_space_fit: 1.0,
    driving_condition_fit: 0.95,
    operating_cost_fit: 0.95,
    performance_fit: 0.8,
    comfort_fit: 0.85,
    technology_fit: 0.7,
    safety_fit: 0.9,
    brand_emotional_fit: 0.65,
    tradeoff_fit: 0.75,
  };

  weights.performance_fit += clamp01(profile.performance_priority) * 0.9;
  weights.operating_cost_fit += Math.max(clamp01(profile.fuel_saving_priority), clamp01(profile.maintenance_cost_priority), clamp01(profile.reliability_priority), clamp01(profile.resale_value_priority)) * 0.9;
  weights.comfort_fit += clamp01(profile.comfort_priority) * 0.75;
  weights.technology_fit += clamp01(profile.tech_priority) * 0.85;
  weights.safety_fit += clamp01(profile.safety_priority) * 0.85;
  weights.brand_emotional_fit += Math.max(clamp01(profile.style_priority), profile.brand_preferences?.length ? 0.45 : 0, profile.emotional_motivators?.length ? 0.35 : 0);
  if (profile.primary_use_cases?.includes("family")) {
    weights.size_space_fit += 0.6;
    weights.safety_fit += 0.4;
    weights.comfort_fit += 0.35;
  }
  if (profile.primary_use_cases?.includes("daily_commute") || profile.primary_use_cases?.includes("city_driving")) {
    weights.driving_condition_fit += 0.45;
    weights.operating_cost_fit += 0.3;
  }
  if (profile.primary_use_cases?.includes("road_trip")) {
    weights.comfort_fit += 0.3;
    weights.performance_fit += 0.25;
  }
  if (profile.price_positioning === "flagship") {
    weights.brand_emotional_fit += 0.28;
    weights.performance_fit += 0.16;
  } else if (profile.price_positioning === "premium") {
    weights.brand_emotional_fit += 0.18;
    weights.comfort_fit += 0.12;
  } else if (profile.price_positioning === "value" || profile.price_positioning === "budget") {
    weights.budget_fit += 0.24;
    weights.operating_cost_fit += 0.18;
  }
  if (profile.tradeoff_preferences?.length) weights.tradeoff_fit += 0.35;

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number((value / total).toFixed(4))]));
}

function mergeField(currentValue, nextValue) {
  if (Array.isArray(currentValue) || Array.isArray(nextValue)) return unique([...(currentValue || []), ...(nextValue || [])]);
  if (nextValue == null || nextValue === "") return currentValue ?? null;
  return nextValue;
}

export function normalizePreferenceProfile(profile = {}) {
  const normalized = {
    primary_use_cases: normalizeArray(profile.primary_use_cases),
    secondary_use_cases: normalizeArray(profile.secondary_use_cases),
    usage_frequency: normalizeText(profile.usage_frequency),
    daily_distance_km: toInteger(profile.daily_distance_km),
    city_vs_highway_ratio: normalizeText(profile.city_vs_highway_ratio ?? profile.environment),
    family_size: toInteger(profile.family_size ?? profile.passenger_count),
    regular_passenger_count: toInteger(profile.regular_passenger_count ?? profile.passenger_count),
    needs_7_seats: typeof profile.needs_7_seats === "boolean" ? profile.needs_7_seats : null,
    child_present: typeof profile.child_present === "boolean" ? profile.child_present : null,
    elderly_present: typeof profile.elderly_present === "boolean" ? profile.elderly_present : null,
    cargo_needs: normalizeText(profile.cargo_needs),
    seat_need: normalizeText(profile.seat_need),
    seat_requirement: normalizeRequirement(profile.seat_requirement, ["hard", "soft"]),
    budget_target: toMoney(profile.budget_target ?? profile.budget_max),
    budget_floor: toMoney(profile.budget_floor ?? profile.budget_min),
    budget_ceiling: toMoney(profile.budget_ceiling ?? profile.budget_max),
    budget_mode: normalizeText(profile.budget_mode),
    budget_flexibility: normalizeText(profile.budget_flexibility),
    price_positioning: normalizeText(profile.price_positioning),
    payment_method: normalizeText(profile.payment_method),
    down_payment: toMoney(profile.down_payment),
    monthly_payment_limit: toMoney(profile.monthly_payment_limit),
    preferred_body_types: normalizeArray(profile.preferred_body_types ?? profile.preferred_body_type, normalizeBodyType),
    rejected_body_types: normalizeArray(profile.rejected_body_types, normalizeBodyType),
    body_type_requirement: normalizeRequirement(profile.body_type_requirement),
    preferred_fuel_types: normalizeArray(profile.preferred_fuel_types ?? profile.preferred_fuel_type, normalizeFuelType),
    rejected_fuel_types: normalizeArray(profile.rejected_fuel_types, normalizeFuelType),
    fuel_type_requirement: normalizeRequirement(profile.fuel_type_requirement),
    transmission_preference: normalizeText(profile.transmission_preference),
    awd_need: typeof profile.awd_need === "boolean" ? profile.awd_need : null,
    performance_priority: clamp01(profile.performance_priority),
    fuel_saving_priority: clamp01(profile.fuel_saving_priority),
    comfort_priority: clamp01(profile.comfort_priority),
    tech_priority: clamp01(profile.tech_priority),
    safety_priority: clamp01(profile.safety_priority),
    maintenance_cost_priority: clamp01(profile.maintenance_cost_priority ?? (profile.maintenance_sensitivity === "high" ? 0.9 : null)),
    resale_value_priority: clamp01(profile.resale_value_priority),
    reliability_priority: clamp01(profile.reliability_priority),
    style_priority: clamp01(profile.style_priority ?? (profile.personality === "premium" ? 0.7 : null)),
    brand_preferences: normalizeArray(profile.brand_preferences),
    brand_rejections: normalizeArray(profile.brand_rejections),
    must_have_features: normalizeArray(profile.must_have_features, normalizeFeature),
    nice_to_have_features: normalizeArray(profile.nice_to_have_features, normalizeFeature),
    deal_breakers: normalizeArray(profile.deal_breakers, normalizeDealBreaker),
    parking_constraints: normalizeText(profile.parking_constraints),
    road_conditions: normalizeArray(profile.road_conditions),
    flood_risk: typeof profile.flood_risk === "boolean" ? profile.flood_risk : null,
    charging_availability: normalizeText(profile.charging_availability),
    buying_timeline: normalizeText(profile.buying_timeline),
    consideration_stage: normalizeText(profile.consideration_stage),
    tradeoff_preferences: normalizeArray(profile.tradeoff_preferences),
    emotional_motivators: normalizeArray(profile.emotional_motivators),
    explicit_competitor_models: normalizeArray(profile.explicit_competitor_models),
    style_intent: normalizeText(profile.style_intent),
  };

  normalized.preferred_body_types = normalized.preferred_body_types.filter((value) => !normalized.rejected_body_types.includes(value));
  normalized.preferred_fuel_types = normalized.preferred_fuel_types.filter((value) => !normalized.rejected_fuel_types.includes(value));
  normalized.brand_preferences = normalized.brand_preferences.filter((value) => !normalized.brand_rejections.includes(value));

  normalized.budget_min = normalized.budget_floor ?? null;
  normalized.budget_max = normalized.budget_ceiling ?? normalized.budget_target ?? null;
  normalized.passenger_count = normalized.regular_passenger_count ?? normalized.family_size ?? null;
  normalized.preferred_body_type = normalized.preferred_body_types[0] ?? normalizeBodyType(profile.preferred_body_type) ?? null;
  normalized.preferred_fuel_type = normalized.preferred_fuel_types[0] ?? normalizeFuelType(profile.preferred_fuel_type) ?? null;
  normalized.environment =
    normalized.city_vs_highway_ratio === "mostly_city"
      ? "city"
      : normalized.city_vs_highway_ratio === "mostly_highway"
        ? "rural"
        : normalized.city_vs_highway_ratio === "mixed"
          ? "mixed"
          : normalizeText(profile.environment);
  normalized.long_trip_habit =
    profile.long_trip_habit ??
    (normalized.primary_use_cases.includes("road_trip") ? "frequent" : normalized.city_vs_highway_ratio === "mostly_city" ? "rare" : null);
  normalized.maintenance_sensitivity =
    profile.maintenance_sensitivity ??
    (normalized.maintenance_cost_priority >= 0.8 || normalized.reliability_priority >= 0.8 ? "high" : null);
  normalized.personality =
    profile.personality ??
    (normalized.style_intent === "sporty" || normalized.performance_priority >= 0.8
      ? "sporty"
      : normalized.style_intent === "premium" || normalized.style_intent === "halo" || normalized.style_priority >= 0.75
        ? "premium"
        : normalized.primary_use_cases.includes("family")
          ? "family"
          : null);
  if (!normalized.budget_mode) {
    normalized.budget_mode =
      normalized.budget_ceiling != null
        ? "capped"
        : normalized.budget_target != null
          ? "target"
          : normalized.budget_flexibility === "open"
            ? "open"
            : normalized.budget_flexibility === "flexible"
              ? "flexible"
              : normalized.price_positioning
                ? "flexible"
              : null;
  }
  normalized.brand_openness = profile.brand_openness ?? (normalized.brand_preferences.length || normalized.brand_rejections.length ? "shortlist" : "open");
  normalized.new_vs_used = normalizeText(profile.new_vs_used);
  normalized.inferred_priority_weights = derivePriorityWeights(normalized);
  normalized.data_confidence_level = profile.data_confidence_level ?? deriveConfidenceLevel(normalized);
  return normalized;
}

export function mergePreferenceProfiles(currentProfile = {}, patch = {}) {
  const merged = {};
  const current = normalizePreferenceProfile(currentProfile);
  const next = normalizePreferenceProfile(patch);
  for (const key of new Set([...Object.keys(current), ...Object.keys(next)])) {
    merged[key] = mergeField(current[key], next[key]);
  }
  return normalizePreferenceProfile(merged);
}

function isQuestionAnswered(profile, key) {
  switch (key) {
    case "primary_use_cases": return (profile.primary_use_cases?.length ?? 0) > 0;
    case "budget_range":
      return (
        profile.budget_target != null ||
        profile.budget_ceiling != null ||
        Boolean(profile.budget_flexibility) ||
        Boolean(profile.budget_mode) ||
        Boolean(profile.price_positioning)
      );
    case "passenger_setup":
      return (
        profile.regular_passenger_count != null ||
        profile.family_size != null ||
        profile.needs_7_seats != null ||
        (profile.preferred_body_types?.length ?? 0) > 0 ||
        (profile.rejected_body_types?.length ?? 0) > 0
      );
    case "driving_conditions": return Boolean(profile.city_vs_highway_ratio) || (profile.road_conditions?.length ?? 0) > 0 || Boolean(profile.parking_constraints);
    case "top_priorities": return Object.keys(profile.inferred_priority_weights || {}).length > 0 && (profile.performance_priority || profile.fuel_saving_priority || profile.comfort_priority || profile.tech_priority || profile.safety_priority || profile.reliability_priority || profile.style_priority);
    case "tradeoff_preferences":
      return (
        (profile.tradeoff_preferences?.length ?? 0) > 0 ||
        profile.performance_priority >= 0.7 ||
        profile.reliability_priority >= 0.7 ||
        profile.maintenance_cost_priority >= 0.7
      );
    case "preferred_body_types": return (profile.preferred_body_types?.length ?? 0) > 0 || profile.preferred_body_type === "any";
    case "preferred_fuel_types": return (profile.preferred_fuel_types?.length ?? 0) > 0 || (profile.rejected_fuel_types?.length ?? 0) > 0 || profile.preferred_fuel_type === "any";
    case "brand_preferences": return (profile.brand_preferences?.length ?? 0) > 0 || (profile.brand_rejections?.length ?? 0) > 0 || profile.brand_openness === "open";
    case "must_have_features": return (profile.must_have_features?.length ?? 0) > 0 || (profile.nice_to_have_features?.length ?? 0) > 0 || (profile.deal_breakers?.length ?? 0) > 0;
    case "buying_timeline": return Boolean(profile.buying_timeline) || Boolean(profile.consideration_stage);
    default: return profile?.[key] != null && profile?.[key] !== "";
  }
}

export function countAnsweredProfileQuestions(profile = {}) {
  const normalized = normalizePreferenceProfile(profile);
  return ADVISOR_DISCOVERY_QUESTIONS.filter((question) => isQuestionAnswered(normalized, question.key)).length;
}

export function getQuestionByKey(key) {
  return ADVISOR_DISCOVERY_QUESTIONS.find((question) => question.key === key) ?? null;
}

function discoveryQuestionPriority(question, normalized) {
  if (question.key === "tradeoff_preferences") return question.required ? 100 : 90;
  if (question.key === "preferred_fuel_types" && normalized.charging_availability === "none") return 35;
  if (question.key === "must_have_features" && normalized.tech_priority >= 0.7) return 70;
  if (question.key === "brand_preferences" && normalized.style_priority >= 0.7) return 65;
  return question.required ? 100 : 40;
}

export function pickNextDiscoveryQuestions(profile = {}, questions = ADVISOR_DISCOVERY_QUESTIONS, mode = "required", limit = 1) {
  const normalized = normalizePreferenceProfile(profile);
  const candidates = questions
    .filter((question) => (mode === "required" ? question.required : !question.required))
    .filter((question) => !isQuestionAnswered(normalized, question.key));
  if (!candidates.length) return [];

  const normalizedLimit = Math.max(1, Math.min(4, Number(limit) || 1));
  return candidates
    .map((question) => ({
      question,
      priority: discoveryQuestionPriority(question, normalized),
    }))
    .sort((left, right) => right.priority - left.priority)
    .slice(0, normalizedLimit)
    .map((item) => item.question);
}

export function pickNextDiscoveryQuestion(profile = {}, questions = ADVISOR_DISCOVERY_QUESTIONS, mode = "required") {
  return pickNextDiscoveryQuestions(profile, questions, mode, 1)[0] ?? null;
}

export function buildProfileSnapshot(profile = {}) {
  const normalized = normalizePreferenceProfile(profile);
  return [
    normalized.primary_use_cases?.length ? `mainly for ${normalized.primary_use_cases.slice(0, 2).join(" and ").replaceAll("_", " ")}` : null,
    normalized.budget_target ? `budget around ${normalized.budget_target.toLocaleString("en-US")}` : null,
    normalized.budget_ceiling && normalized.budget_ceiling !== normalized.budget_target ? `hard ceiling ${normalized.budget_ceiling.toLocaleString("en-US")}` : null,
    normalized.budget_mode === "open" ? "budget is open" : null,
    normalized.price_positioning ? `${normalized.price_positioning} leaning` : null,
    normalized.passenger_count ? `usually ${normalized.passenger_count} passengers` : null,
    normalized.needs_7_seats ? "7-seat flexibility matters" : null,
    normalized.city_vs_highway_ratio ? `${normalized.city_vs_highway_ratio.replaceAll("_", " ")} use` : null,
    normalized.preferred_body_type && normalized.preferred_body_type !== "any" ? `${normalized.preferred_body_type} leaning` : null,
    normalized.rejected_body_types?.length ? `avoid ${normalized.rejected_body_types.slice(0, 2).join(" and ")}` : null,
    normalized.preferred_fuel_type && normalized.preferred_fuel_type !== "any" ? `${normalized.preferred_fuel_type} leaning` : null,
    normalized.rejected_fuel_types?.length ? `avoid ${normalized.rejected_fuel_types.slice(0, 2).join(" and ")}` : null,
    normalized.must_have_features?.length ? `must-have ${normalized.must_have_features.slice(0, 2).join(" and ").replaceAll("_", " ")}` : null,
    normalized.deal_breakers?.length ? `avoid ${normalized.deal_breakers.slice(0, 2).join(" and ").replaceAll("_", " ")}` : null,
  ].filter(Boolean).join(", ") || "I still need your core buying priorities";
}

export function summarizePreferenceProfile(profile = {}) {
  return buildProfileSnapshot(profile);
}

export function getRecommendationReadiness(profile = {}) {
  const normalized = normalizePreferenceProfile(profile);
  const missing = ADVISOR_DISCOVERY_QUESTIONS.filter((item) => item.required && !isQuestionAnswered(normalized, item.key)).map((item) => item.key);
  return {
    ready: missing.length === 0,
    missing_fields: missing,
    confidence_level: normalized.data_confidence_level,
  };
}

export function parsePreferenceProfileQuery(query = {}) {
  return normalizePreferenceProfile({
    budget_target: query.budget_target ?? query.budgetTarget,
    budget_floor: query.budget_floor ?? query.budgetFloor ?? query.budget_min ?? query.budgetMin,
    budget_ceiling: query.budget_ceiling ?? query.budgetCeiling ?? query.budget_max ?? query.budgetMax,
    budget_mode: query.budget_mode ?? query.budgetMode,
    price_positioning: query.price_positioning ?? query.pricePositioning,
    primary_use_cases: query.primary_use_cases ?? query.primaryUseCases,
    family_size: query.family_size ?? query.familySize,
    regular_passenger_count: query.regular_passenger_count ?? query.regularPassengerCount ?? query.passenger_count ?? query.passengerCount,
    seat_need: query.seat_need ?? query.seatNeed,
    preferred_body_types: query.preferred_body_types ?? query.preferredBodyTypes ?? query.preferred_body_type ?? query.preferredBodyType,
    preferred_fuel_types: query.preferred_fuel_types ?? query.preferredFuelTypes ?? query.preferred_fuel_type ?? query.preferredFuelType,
    city_vs_highway_ratio: query.city_vs_highway_ratio ?? query.cityVsHighwayRatio ?? query.environment,
    tradeoff_preferences: query.tradeoff_preferences ?? query.tradeoffPreferences,
    brand_preferences: query.brand_preferences ?? query.brandPreferences,
    brand_rejections: query.brand_rejections ?? query.brandRejections,
    style_intent: query.style_intent ?? query.styleIntent,
  });
}

export function extractAdvisorProfilePatch(message, expectedQuestionKey = null, currentProfile = {}) {
  const normalized = normalizeText(message);
  const targetedPatch = detectBudgetRange(message);
  const patch = {
    ...targetedPatch,
    ...detectUseCases(message),
    ...detectPassengerSignals(message),
    ...detectDrivingConditions(message),
    ...detectPreferences(message),
    ...detectOwnershipSignals(message),
    ...detectPrioritySignals(message),
  };

  if (patch.rejected_body_types?.length) {
    patch.preferred_body_types = (patch.preferred_body_types ?? []).filter((value) => !patch.rejected_body_types.includes(value));
  }
  if (patch.rejected_fuel_types?.length) {
    patch.preferred_fuel_types = (patch.preferred_fuel_types ?? []).filter((value) => !patch.rejected_fuel_types.includes(value));
  }

  const unsure = /\b(not sure|i am not sure|i'm not sure|unsure|no preference|open|anything is fine|any is fine|no idea)\b/.test(normalized);
  if (expectedQuestionKey === "passenger_setup" && unsure && patch.preferred_body_types.length === 0) patch.preferred_body_types = ["any"];
  if (expectedQuestionKey === "budget_range" && unsure && !patch.budget_target && !patch.budget_ceiling) patch.budget_flexibility = "flexible";
  if (expectedQuestionKey === "tradeoff_preferences" && unsure && patch.tradeoff_preferences.length === 0) patch.tradeoff_preferences = ["balanced"];
  if (expectedQuestionKey === "preferred_body_types" && patch.preferred_body_types.length === 0) patch.preferred_body_types = ["any"];
  if (expectedQuestionKey === "preferred_fuel_types" && patch.preferred_fuel_types.length === 0) patch.preferred_fuel_types = ["any"];
  if (expectedQuestionKey === "brand_preferences" && !patch.brand_preferences.length && !patch.brand_rejections.length) patch.brand_openness = "open";
  if (expectedQuestionKey === "must_have_features" && patch.must_have_features.length === 0 && patch.nice_to_have_features.length === 0) {
    patch.must_have_features = normalizeArray([...FEATURE_ALIASES.keys()].filter((key) => normalized.includes(key)), normalizeFeature);
  }
  if (
    expectedQuestionKey === "must_have_features" &&
    patch.must_have_features.length === 0 &&
    patch.nice_to_have_features.length > 0 &&
    patch.deal_breakers.length === 0
  ) {
    patch.must_have_features = [...patch.nice_to_have_features];
    patch.nice_to_have_features = [];
  }

  return mergePreferenceProfiles(currentProfile, patch);
}
