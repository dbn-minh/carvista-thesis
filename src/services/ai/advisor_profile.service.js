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
  ["cuv", "cuv"],
  ["suv", "suv"],
  ["xe gam cao", "suv"],
  ["sedan", "sedan"],
  ["hatchback", "hatchback"],
  ["mpv", "mpv"],
  ["minivan", "mpv"],
  ["pickup", "pickup"],
  ["ban tai", "pickup"],
  ["truck", "pickup"],
  ["wagon", "wagon"],
  ["coupe", "coupe"],
  ["sports car", "coupe"],
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
    question: "What will this car mainly be used for: daily commute, family trips, work, or something more lifestyle-focused?",
    examples: ["daily city commute", "family of 5 and weekend trips", "business travel with clients"],
    required: true,
  },
  {
    key: "budget_range",
    question: "What price range feels right, and what is the absolute ceiling you do not want to cross?",
    examples: ["ideally under 900 million VND, hard ceiling 1 billion", "around 35,000 USD", "prefer 700 to 800 million"],
    required: true,
  },
  {
    key: "passenger_setup",
    question: "How many people do you usually carry, and do you need 7 seats regularly or just as a backup?",
    examples: ["mostly 2 adults", "family of 5 with kids", "need 7 seats only occasionally"],
    required: true,
  },
  {
    key: "driving_conditions",
    question: "Will you mostly drive in the city, on highways, or on rougher roads, and is parking space tight?",
    examples: ["mostly city traffic with basement parking", "mixed city and highway", "bad roads and occasional flooding"],
    required: true,
  },
  {
    key: "top_priorities",
    question: "What matters most to you: saving fuel, comfort, safety, technology, performance, brand image, or easy ownership?",
    examples: ["fuel economy and reliability", "comfort and safety for family", "performance and style"],
    required: true,
  },
  {
    key: "tradeoff_preferences",
    question: "If you have to trade off, what matters more: lower cost, stronger brand, more features, better performance, or more space?",
    examples: ["space over sporty driving", "brand over extra options", "efficiency over power"],
    required: false,
  },
  {
    key: "preferred_body_types",
    question: "Do you already lean toward a body style like sedan, SUV, MPV, hatchback, pickup, or coupe?",
    examples: ["compact SUV", "sedan is fine", "no strong body-style preference"],
    required: false,
  },
  {
    key: "preferred_fuel_types",
    question: "Do you prefer gasoline, hybrid, diesel, plug-in hybrid, or electric?",
    examples: ["hybrid if possible", "gasoline is fine", "EV only if charging is practical"],
    required: false,
  },
  {
    key: "brand_preferences",
    question: "Are there brands you strongly prefer or definitely want to avoid?",
    examples: ["prefer Japanese brands", "avoid European cars", "BMW or Mercedes would be nice"],
    required: false,
  },
  {
    key: "must_have_features",
    question: "Any must-have features or clear deal-breakers I should respect?",
    examples: ["must have camera 360", "no manual transmission", "need good rear-seat space"],
    required: false,
  },
  {
    key: "buying_timeline",
    question: "Are you just exploring, actively comparing, or planning to buy soon?",
    examples: ["just researching", "deciding this month", "want to buy soon"],
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

function detectBudgetRange(message) {
  const normalized = normalizeText(message);
  const matches = [...normalized.matchAll(/(\d+(?:[.,]\d+)?)\s*(billion|bn|bil|million|m|thousand|k|grand|ty|ti|trieu|usd|vnd|\$)?/g)];
  if (!matches.length) return {};

  const values = matches
    .map((match) => {
      let amount = parseFlexibleNumber(match[1]);
      if (!Number.isFinite(amount)) return null;
      const unit = String(match[2] || "").toLowerCase();
      if (["billion", "bn", "bil", "ty", "ti"].includes(unit)) amount *= 1_000_000_000;
      else if (["million", "m", "trieu"].includes(unit)) amount *= 1_000_000;
      else if (["thousand", "k", "grand"].includes(unit)) amount *= 1_000;
      else if (unit === "usd" || unit === "$") amount *= 25_000;
      return amount >= 10_000 ? amount : null;
    })
    .filter((value) => Number.isFinite(value));

  if (!values.length) return {};
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    budget_target: values.length === 1 ? values[0] : Math.round((min + max) / 2),
    budget_ceiling:
      /\b(ceiling|max|under|duoi|toi da|tran|khong qua)\b/.test(normalized)
        ? max
        : values.length > 1
          ? max
          : null,
  };
}

function detectPassengerSignals(message) {
  const normalized = normalizeText(message);
  const familyMatch = normalized.match(/(?:family of|gia dinh|nha minh|nha toi)\s*(\d+)/);
  const passengerMatch = normalized.match(/(\d+)\s*(people|person|passengers|seats?|adults|kids|children|nguoi|cho|ghe|con|tre em)/);
  const count = familyMatch ? Number(familyMatch[1]) : passengerMatch ? Number(passengerMatch[1]) : null;

  return {
    regular_passenger_count: Number.isFinite(count) ? count : null,
    family_size: Number.isFinite(count) ? count : null,
    needs_7_seats:
      normalized.includes("7 seats") ||
      normalized.includes("seven seats") ||
      normalized.includes("7 cho") ||
      normalized.includes("bay cho") ||
      normalized.includes("third row") ||
      (Number.isFinite(count) && count >= 6)
        ? true
        : null,
    child_present: /\b(kid|kids|child|children|baby|babies|tre em|em be|con nho|con)\b/.test(normalized) ? true : null,
    elderly_present: /\b(elderly|older parents|grandparents|senior|nguoi lon tuoi|ong ba|bo me)\b/.test(normalized) ? true : null,
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
  const primary = unique([
    /\b(commute|go to work|daily drive|daily commute|di lam|di hang ngay|di moi ngay)\b/.test(normalized) ? "daily_commute" : null,
    /\b(city|urban|traffic|thanh pho|noi do|di pho|ket xe)\b/.test(normalized) ? "city_driving" : null,
    /\b(family|kids|children|parents|gia dinh|con nho|tre em|bo me|ong ba)\b/.test(normalized) ? "family" : null,
    /\b(client|business|office|meeting|company|cong viec|khach hang|di gap khach|doanh nhan)\b/.test(normalized) ? "business" : null,
    /\b(travel|trip|weekend|getaway|touring|holiday|du lich|di xa|duong dai|cuoi tuan|di tinh)\b/.test(normalized) ? "road_trip" : null,
    /\b(service|grab|taxi|ride hailing|commercial|chay dich vu|kinh doanh|taxi cong nghe)\b/.test(normalized) ? "commercial_service" : null,
    /\b(cargo|load|goods|carry equipment|cho hang|hang hoa|do nghe|cho do)\b/.test(normalized) ? "cargo" : null,
    /\b(offroad|off-road|mountain|trail|di duong xau|duong nui|leo deo)\b/.test(normalized) ? "offroad" : null,
    /\b(style|image|look good|fun|passion|weekend toy|dream car|kieu dang|phong cach|dep|the thao)\b/.test(normalized) ? "lifestyle" : null,
  ]);

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
  const brands = KNOWN_BRANDS.filter((brand) => normalized.includes(brand));
  const preferredBrands = /\b(prefer|like|love|want|lean toward|thich|muon|uu tien|nghieng ve)\b/.test(normalized) ? brands : [];
  const rejectedBrands = /\b(avoid|hate|don't want|do not want|no|tranh|khong thich|khong muon|khong chon)\b/.test(normalized) ? brands : [];

  return {
    preferred_body_types: normalizeArray([...BODY_TYPE_SYNONYMS.keys()].filter((key) => normalized.includes(key)), normalizeBodyType),
    preferred_fuel_types: normalizeArray([...FUEL_TYPE_SYNONYMS.keys()].filter((key) => normalized.includes(key)), normalizeFuelType),
    transmission_preference: /\b(manual|stick)\b/.test(normalized) ? "manual" : /\b(automatic|auto|cvt|dct)\b/.test(normalized) ? "automatic" : null,
    awd_need: /\b(awd|4wd|4x4|all wheel drive|snow|offroad)\b/.test(normalized) ? true : null,
    brand_preferences: unique(preferredBrands),
    brand_rejections: unique(rejectedBrands),
    emotional_motivators: unique([
      /\b(luxury|premium|prestige)\b/.test(normalized) ? "premium_image" : null,
      /\b(sporty|fun|exciting|performance)\b/.test(normalized) ? "sporty_identity" : null,
      /\b(family|safe|peace of mind)\b/.test(normalized) ? "family_security" : null,
      /\b(style|design|look)\b/.test(normalized) ? "design_affinity" : null,
    ]),
  };
}

function detectOwnershipSignals(message) {
  const normalized = normalizeText(message);
  return {
    payment_method: /\b(finance|installment|loan|monthly)\b/.test(normalized) ? "finance" : /\b(cash|pay upfront|pay in full)\b/.test(normalized) ? "cash" : null,
    monthly_payment_limit: (() => {
      const match = normalized.match(/monthly(?: payment)?(?: around| under| max)?\s*(\d+(?:[.,]\d+)?)\s*(million|m|trieu|usd|vnd)?/);
      if (!match) return null;
      let amount = parseFlexibleNumber(match[1]);
      const unit = String(match[2] || "").toLowerCase();
      if (["million", "m", "trieu"].includes(unit)) amount *= 1_000_000;
      else if (unit === "usd") amount *= 25_000;
      return Number.isFinite(amount) ? amount : null;
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
  return {
    performance_priority: /\b(performance|fast|quick|power|sporty|fun to drive|van hanh|cam giac lai|boc|manh|the thao)\b/.test(normalized) ? 0.95 : null,
    fuel_saving_priority: /\b(fuel economy|efficient|save fuel|economy|cheap to run|tiet kiem xang|tiet kiem nhien lieu|it hao xang|chi phi xang)\b/.test(normalized) ? 0.95 : null,
    comfort_priority: /\b(comfort|smooth|quiet|refined|rear seat|tien nghi|em ai|yen tinh|rong rai|hang ghe sau)\b/.test(normalized) ? 0.9 : null,
    tech_priority: /\b(technology|tech|apple carplay|android auto|360 camera|screen|features|cong nghe|man hinh|camera 360|tinh nang)\b/.test(normalized) ? 0.9 : null,
    safety_priority: /\b(safe|safety|adas|blind spot|lane keep|family safety|an toan|ho tro lai|diem mu)\b/.test(normalized) ? 0.95 : null,
    maintenance_cost_priority: /\b(low maintenance|easy to maintain|cheap to maintain|simple ownership|it bao duong|de bao duong|de nuoi|chi phi bao duong)\b/.test(normalized) ? 0.95 : null,
    resale_value_priority: /\b(resale|sell later|keep value|hold value|giu gia|ban lai|thanh khoan)\b/.test(normalized) ? 0.92 : null,
    style_priority: /\b(style|design|look good|premium image|impressive|kieu dang|thiet ke|dep|sang|hinh anh)\b/.test(normalized) ? 0.88 : null,
    reliability_priority: /\b(reliable|durable|dependable|ben|ben bi|lanh|it hong)\b/.test(normalized) ? 0.95 : null,
    must_have_features: normalizeArray([...FEATURE_ALIASES.keys()].filter((key) => normalized.includes(key)), normalizeFeature),
    deal_breakers: unique([
      /\b(no manual|avoid manual)\b/.test(normalized) ? "manual_transmission" : null,
      /\b(no ev|avoid ev|no electric)\b/.test(normalized) ? "ev_powertrain" : null,
      /\b(no big suv|too big)\b/.test(normalized) ? "oversized_vehicle" : null,
    ]),
    tradeoff_preferences: unique([
      /\b(space over performance|space matters more|rong rai hon van hanh|khong gian hon suc manh)\b/.test(normalized) ? "space_over_performance" : null,
      /\b(brand over features|badge over equipment|thuong hieu hon option|thuong hieu hon tinh nang)\b/.test(normalized) ? "brand_over_features" : null,
      /\b(efficiency over power|fuel economy over performance|tiet kiem hon suc manh|tiet kiem xang hon van hanh)\b/.test(normalized) ? "efficiency_over_performance" : null,
      /\b(comfort over sporty|comfort over handling|tien nghi hon the thao|em ai hon cam giac lai)\b/.test(normalized) ? "comfort_over_performance" : null,
      /\b(easy ownership over fancy tech|reliability over tech|de nuoi hon cong nghe|ben hon option)\b/.test(normalized) ? "reliability_over_tech" : null,
    ]),
  };
}

function deriveConfidenceLevel(profile) {
  const answered = [
    profile.primary_use_cases?.length,
    profile.budget_target || profile.budget_ceiling,
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
    budget_target: toMoney(profile.budget_target ?? profile.budget_max),
    budget_ceiling: toMoney(profile.budget_ceiling ?? profile.budget_max),
    budget_flexibility: normalizeText(profile.budget_flexibility),
    payment_method: normalizeText(profile.payment_method),
    down_payment: toMoney(profile.down_payment),
    monthly_payment_limit: toMoney(profile.monthly_payment_limit),
    preferred_body_types: normalizeArray(profile.preferred_body_types ?? profile.preferred_body_type, normalizeBodyType),
    rejected_body_types: normalizeArray(profile.rejected_body_types, normalizeBodyType),
    preferred_fuel_types: normalizeArray(profile.preferred_fuel_types ?? profile.preferred_fuel_type, normalizeFuelType),
    rejected_fuel_types: normalizeArray(profile.rejected_fuel_types, normalizeFuelType),
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
    deal_breakers: normalizeArray(profile.deal_breakers),
    parking_constraints: normalizeText(profile.parking_constraints),
    road_conditions: normalizeArray(profile.road_conditions),
    flood_risk: typeof profile.flood_risk === "boolean" ? profile.flood_risk : null,
    charging_availability: normalizeText(profile.charging_availability),
    buying_timeline: normalizeText(profile.buying_timeline),
    consideration_stage: normalizeText(profile.consideration_stage),
    tradeoff_preferences: normalizeArray(profile.tradeoff_preferences),
    emotional_motivators: normalizeArray(profile.emotional_motivators),
    explicit_competitor_models: normalizeArray(profile.explicit_competitor_models),
  };

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
    (normalized.performance_priority >= 0.8 ? "sporty" : normalized.style_priority >= 0.75 ? "premium" : normalized.primary_use_cases.includes("family") ? "family" : null);
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
    case "budget_range": return profile.budget_target != null || profile.budget_ceiling != null;
    case "passenger_setup": return profile.regular_passenger_count != null || profile.family_size != null || profile.needs_7_seats != null;
    case "driving_conditions": return Boolean(profile.city_vs_highway_ratio) || (profile.road_conditions?.length ?? 0) > 0 || Boolean(profile.parking_constraints);
    case "top_priorities": return Object.keys(profile.inferred_priority_weights || {}).length > 0 && (profile.performance_priority || profile.fuel_saving_priority || profile.comfort_priority || profile.tech_priority || profile.safety_priority || profile.reliability_priority || profile.style_priority);
    case "tradeoff_preferences": return (profile.tradeoff_preferences?.length ?? 0) > 0;
    case "preferred_body_types": return (profile.preferred_body_types?.length ?? 0) > 0 || profile.preferred_body_type === "any";
    case "preferred_fuel_types": return (profile.preferred_fuel_types?.length ?? 0) > 0 || profile.preferred_fuel_type === "any";
    case "brand_preferences": return (profile.brand_preferences?.length ?? 0) > 0 || (profile.brand_rejections?.length ?? 0) > 0 || profile.brand_openness === "open";
    case "must_have_features": return (profile.must_have_features?.length ?? 0) > 0 || (profile.deal_breakers?.length ?? 0) > 0;
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
  if (question.key === "tradeoff_preferences" && countAnsweredProfileQuestions(normalized) < 4) return 5;
  if (question.key === "preferred_fuel_types" && normalized.charging_availability === "none") return 35;
  if (question.key === "must_have_features" && normalized.tech_priority >= 0.7) return 70;
  if (question.key === "brand_preferences" && normalized.style_priority >= 0.7) return 65;
  return question.required ? 100 : 40;
}

export function pickNextDiscoveryQuestions(profile = {}, questions = ADVISOR_DISCOVERY_QUESTIONS, mode = "required", limit = 3) {
  const normalized = normalizePreferenceProfile(profile);
  const candidates = questions
    .filter((question) => (mode === "required" ? question.required : !question.required))
    .filter((question) => !isQuestionAnswered(normalized, question.key));
  if (!candidates.length) return [];

  const normalizedLimit = Math.max(1, Math.min(4, Number(limit) || 3));
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
    normalized.passenger_count ? `usually ${normalized.passenger_count} passengers` : null,
    normalized.needs_7_seats ? "7-seat flexibility matters" : null,
    normalized.city_vs_highway_ratio ? `${normalized.city_vs_highway_ratio.replaceAll("_", " ")} use` : null,
    normalized.preferred_body_type && normalized.preferred_body_type !== "any" ? `${normalized.preferred_body_type} leaning` : null,
    normalized.preferred_fuel_type && normalized.preferred_fuel_type !== "any" ? `${normalized.preferred_fuel_type} leaning` : null,
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
    budget_ceiling: query.budget_ceiling ?? query.budgetCeiling ?? query.budget_max ?? query.budgetMax,
    primary_use_cases: query.primary_use_cases ?? query.primaryUseCases,
    family_size: query.family_size ?? query.familySize,
    regular_passenger_count: query.regular_passenger_count ?? query.regularPassengerCount ?? query.passenger_count ?? query.passengerCount,
    preferred_body_types: query.preferred_body_types ?? query.preferredBodyTypes ?? query.preferred_body_type ?? query.preferredBodyType,
    preferred_fuel_types: query.preferred_fuel_types ?? query.preferredFuelTypes ?? query.preferred_fuel_type ?? query.preferredFuelType,
    city_vs_highway_ratio: query.city_vs_highway_ratio ?? query.cityVsHighwayRatio ?? query.environment,
    tradeoff_preferences: query.tradeoff_preferences ?? query.tradeoffPreferences,
    brand_preferences: query.brand_preferences ?? query.brandPreferences,
    brand_rejections: query.brand_rejections ?? query.brandRejections,
  });
}

export function extractAdvisorProfilePatch(message, expectedQuestionKey = null, currentProfile = {}) {
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

  if (expectedQuestionKey === "preferred_body_types" && patch.preferred_body_types.length === 0) patch.preferred_body_types = ["any"];
  if (expectedQuestionKey === "preferred_fuel_types" && patch.preferred_fuel_types.length === 0) patch.preferred_fuel_types = ["any"];
  if (expectedQuestionKey === "brand_preferences" && !patch.brand_preferences.length && !patch.brand_rejections.length) patch.brand_openness = "open";

  return mergePreferenceProfiles(currentProfile, patch);
}
