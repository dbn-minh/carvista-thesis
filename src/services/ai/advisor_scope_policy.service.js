export const ADVISOR_SCOPE_STATUS = Object.freeze({
  IN_SCOPE: "in_scope",
  OFF_TOPIC: "off_topic",
  AMBIGUOUS_AUTOMOTIVE_BUSINESS: "ambiguous_automotive_business",
  LOW_SIGNAL: "low_signal",
});

export const ADVISOR_DOMAIN_INTENT = Object.freeze({
  IN_DOMAIN_CAR_SHOPPING: "IN_DOMAIN_CAR_SHOPPING",
  AUTOMOTIVE_ADJACENT: "AUTOMOTIVE_ADJACENT",
  OFF_TOPIC_BRIDGEABLE: "OFF_TOPIC_BRIDGEABLE",
  OFF_TOPIC_UNRELATED: "OFF_TOPIC_UNRELATED",
  LOW_SIGNAL_OR_NONSENSE: "LOW_SIGNAL_OR_NONSENSE",
});

export const ADVISOR_TOPIC_CATEGORY = Object.freeze({
  CODING_DEV: "coding/dev",
  PHONE_CONSUMER_ELECTRONICS: "phone/consumer_electronics",
  SAAS_SOFTWARE_BUSINESS_TOOLS: "saas/software/business_tools",
  DEALERSHIP_FLEET_AUTOMOTIVE_BUSINESS: "dealership/fleet/automotive_business",
  NONSENSE_LOW_SIGNAL: "nonsense/low_signal",
  GENERIC_OFF_TOPIC: "generic_off_topic",
  CAR_RECOMMENDATION: "car_recommendation",
  CAR_COMPARISON: "car_comparison",
  PRICING_PAYMENT: "pricing/payment",
  OWNERSHIP_COST: "ownership_cost",
  EV_HYBRID_FUEL: "ev_hybrid_fuel",
  VEHICLE_DOCUMENT_DATA_EXTRACTION: "vehicle_document_data_extraction",
});

export const EMERGENCY_POLICY_FALLBACK =
  "The AI model is unavailable right now, so I can't generate the flexible answer for this message yet.";

const PRIMARY_MISSION = "Help users choose, compare, price, and evaluate vehicles.";

const VEHICLE_SCOPE_PATTERNS = [
  /\b(car|cars|vehicle|vehicles|auto|automobile|suv|cuv|sedan|hatchback|coupe|wagon|mpv|minivan|van|pickup|truck)\b/i,
  /\b(ev|electric|hybrid|phev|bev|ice|gas|gasoline|diesel|petrol|fuel|mpg|range|charging)\b/i,
  /\b(trim|model|variant|body type|drivetrain|horsepower|engine|transmission|mileage|odometer)\b/i,
  /\b(buy|lease|loan|payment|down payment|price|pricing|budget|resale|depreciation|trade[-\s]?in)\b/i,
  /\b(ownership|tco|insurance|maintenance|repair|warranty|fuel economy|running cost|cost to own)\b/i,
  /\b(commute|family use|road trip|fleet vehicle|business vehicle|taxi|ride[-\s]?hailing|cargo)\b/i,
  /\b(performance|sporty|sports car|supercar|race car|racing|track car|drift|drifting|off[-\s]?road)\b/i,
  /\b(xe|oto|o to|mau xe|dong xe|gia xe|bao duong|tiet kiem xang|lan banh)\b/i,
];

const VEHICLE_NAME_PATTERNS = [
  /\b(toyota|honda|mazda|ford|bmw|mercedes|benz|audi|vinfast|hyundai|kia|lexus|nissan|tesla|porsche|mitsubishi|suzuki|subaru|volvo|peugeot|byd|isuzu|chevrolet|chevy|land rover|range rover|volkswagen|lamborghini)\b/i,
  /\b(camry|civic|mazda3|corolla|cx-5|cr-v|accord|model 3|model y|mustang|fortuner|everest|corolla cross|tucson|santa fe|seltos|carnival|x5|320i|c300|glc|q5|a4|nx|es|vf 6|vf 8|seal|atto 3|xpander|terra|forester)\b/i,
];

const AUTO_BUSINESS_PATTERNS = [
  /\b(dealership|dealer|auto dealer|car dealer|car lot|showroom|automotive business|auto business)\b/i,
  /\b(fleet|rental fleet|service center|repair shop|body shop|auto sales|vehicle sales)\b/i,
];

const SOFTWARE_OR_PRODUCT_PATTERNS = [
  /\b(software|saas|crm|erp|platform|tool|tools|app|system|product|solution|solutions|subscription|automation|tech stack)\b/i,
  /\b(startup|b2b|sales pipeline|marketing automation|payroll|hr system|project management|help desk|ticketing)\b/i,
];

const PHONE_PATTERNS = [
  /\b(phone|smartphone|iphone|android|ios|apple phone|samsung galaxy|pixel phone|tablet|ipad)\b/i,
];

const CODING_PATTERNS = [
  /\b(code|coding|program|programming|developer|script|python|javascript|typescript|java|c\+\+|api|ocr|machine learning|ml model)\b/i,
  /\b(viet code|lap trinh|doan code|ma nguon)\b/i,
];

const OCR_DOCUMENT_PATTERNS = [
  /\b(ocr|vin|license plate|plate|window sticker|invoice|service record|service records|receipt|registration|vehicle document|document extraction)\b/i,
  /\b(bien so|hoa don|dang ky|giay to xe|bao hanh|bao duong)\b/i,
];

const CLEAR_OFF_TOPIC_PATTERNS = [
  /\b(weather|football|world cup|movie|crypto|politics|homework|recipe|dinner|cook|cooking|restaurant|song|music)\b/i,
  /\b(thoi tiet|bong da|phim|chinh tri|mon an)\b/i,
];

const FINANCE_BRIDGE_PATTERNS = [
  /\b(finance|loan|interest|monthly payment|lease|budget|depreciation|tax)\b/i,
];

const TRAVEL_BRIDGE_PATTERNS = [
  /\b(travel|road trip|trip|vacation|luggage|cargo|charging stops)\b/i,
];

const COMPARISON_PATTERNS = [/\b(compare|versus| vs |better than|which is better|so sanh)\b/i];
const PRICE_PATTERNS = [/\b(price|pricing|payment|loan|lease|budget|finance|monthly|down payment)\b/i];
const OWNERSHIP_PATTERNS = [/\b(ownership|tco|insurance|maintenance|repair|depreciation|cost to own)\b/i];
const EV_FUEL_PATTERNS = [/\b(ev|electric|hybrid|phev|fuel|gas|diesel|mpg|range|charging)\b/i];

const REQUEST_OR_QUESTION_PATTERN =
  /\b(recommend|suggest|find|give|need|want|looking|buy|compare|choose|what|why|how|which|can|could|should|tell|explain|dua|cho|toi)\b/i;

function normalizeScopeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function compactString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function hasAutomotiveScopeSignal(message) {
  const normalized = normalizeScopeText(message);
  return matchesAny(normalized, VEHICLE_SCOPE_PATTERNS) || matchesAny(normalized, VEHICLE_NAME_PATTERNS);
}

function hasAutomotiveBusinessSignal(message) {
  return matchesAny(normalizeScopeText(message), AUTO_BUSINESS_PATTERNS);
}

function hasSoftwareOrProductSignal(message) {
  const normalized = normalizeScopeText(message);
  return matchesAny(normalized, SOFTWARE_OR_PRODUCT_PATTERNS);
}

function hasPhoneSignal(message) {
  return matchesAny(normalizeScopeText(message), PHONE_PATTERNS);
}

function hasCodingSignal(message) {
  return matchesAny(normalizeScopeText(message), CODING_PATTERNS);
}

function hasDocumentExtractionSignal(message) {
  return matchesAny(normalizeScopeText(message), OCR_DOCUMENT_PATTERNS);
}

function isLowSignalMessage(message) {
  const normalized = normalizeScopeText(message);
  if (!normalized) return true;
  if (REQUEST_OR_QUESTION_PATTERN.test(normalized)) return false;
  if (matchesAny(normalized, CLEAR_OFF_TOPIC_PATTERNS)) return false;
  if (
    hasAutomotiveScopeSignal(normalized) ||
    hasAutomotiveBusinessSignal(normalized) ||
    hasSoftwareOrProductSignal(normalized) ||
    hasPhoneSignal(normalized) ||
    hasCodingSignal(normalized)
  ) {
    return false;
  }

  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  if (tokens.length === 0) return true;
  return tokens.length <= 4;
}

function topicForAutomotiveMessage(normalized) {
  if (matchesAny(normalized, COMPARISON_PATTERNS)) return ADVISOR_TOPIC_CATEGORY.CAR_COMPARISON;
  if (matchesAny(normalized, PRICE_PATTERNS)) return ADVISOR_TOPIC_CATEGORY.PRICING_PAYMENT;
  if (matchesAny(normalized, OWNERSHIP_PATTERNS)) return ADVISOR_TOPIC_CATEGORY.OWNERSHIP_COST;
  if (matchesAny(normalized, EV_FUEL_PATTERNS)) return ADVISOR_TOPIC_CATEGORY.EV_HYBRID_FUEL;
  return ADVISOR_TOPIC_CATEGORY.CAR_RECOMMENDATION;
}

function statusForDomainIntent(intent) {
  switch (intent) {
    case ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING:
      return ADVISOR_SCOPE_STATUS.IN_SCOPE;
    case ADVISOR_DOMAIN_INTENT.AUTOMOTIVE_ADJACENT:
      return ADVISOR_SCOPE_STATUS.AMBIGUOUS_AUTOMOTIVE_BUSINESS;
    case ADVISOR_DOMAIN_INTENT.LOW_SIGNAL_OR_NONSENSE:
      return ADVISOR_SCOPE_STATUS.LOW_SIGNAL;
    default:
      return ADVISOR_SCOPE_STATUS.OFF_TOPIC;
  }
}

function routeForStatus(status) {
  switch (status) {
    case ADVISOR_SCOPE_STATUS.IN_SCOPE:
      return "in_scope";
    case ADVISOR_SCOPE_STATUS.AMBIGUOUS_AUTOMOTIVE_BUSINESS:
      return "ambiguous_automotive_business";
    case ADVISOR_SCOPE_STATUS.LOW_SIGNAL:
      return "low_signal";
    default:
      return "off_topic";
  }
}

function domainStatusForIntent(intent) {
  switch (intent) {
    case ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING:
      return "inside_primary_scope";
    case ADVISOR_DOMAIN_INTENT.AUTOMOTIVE_ADJACENT:
      return "automotive_adjacent_needs_clarification";
    case ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE:
      return "outside_primary_scope_but_bridgeable";
    case ADVISOR_DOMAIN_INTENT.LOW_SIGNAL_OR_NONSENSE:
      return "too_little_signal";
    default:
      return "outside_primary_scope";
  }
}

function statusLabelForIntent(intent) {
  if (intent === ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING) return null;
  if (intent === ADVISOR_DOMAIN_INTENT.OFF_TOPIC_UNRELATED) return "Out of scope";
  return "Needs clarification";
}

function bridgeHintsForTopic(topicCategory) {
  switch (topicCategory) {
    case ADVISOR_TOPIC_CATEGORY.PHONE_CONSUMER_ELECTRONICS:
      return ["Apple CarPlay", "Android Auto", "infotainment", "wireless charging", "phone integration", "connected cabin features"];
    case ADVISOR_TOPIC_CATEGORY.CODING_DEV:
      return ["VIN decoding", "payment estimates", "fuel-cost scripts", "vehicle data cleanup", "dealership workflow automation"];
    case ADVISOR_TOPIC_CATEGORY.VEHICLE_DOCUMENT_DATA_EXTRACTION:
      return ["VINs", "license plates", "window stickers", "invoices", "service records", "vehicle documents"];
    case ADVISOR_TOPIC_CATEGORY.SAAS_SOFTWARE_BUSINESS_TOOLS:
      return ["dealership software", "fleet management", "vehicle inventory", "auto-sales CRM", "service workflow tools"];
    case ADVISOR_TOPIC_CATEGORY.DEALERSHIP_FLEET_AUTOMOTIVE_BUSINESS:
      return ["dealership tools", "fleet needs", "inventory planning", "auto-sales CRM", "business vehicle selection"];
    case ADVISOR_TOPIC_CATEGORY.PRICING_PAYMENT:
      return ["auto loans", "monthly payments", "lease-vs-buy", "depreciation", "total cost of ownership"];
    case ADVISOR_TOPIC_CATEGORY.GENERIC_OFF_TOPIC:
      return [];
    default:
      return [];
  }
}

function forbiddenBehaviorForTopic(topicCategory) {
  const common = [
    "Do not use fixed refusal copy.",
    "Do not omit the final natural bridge back to CarVista Advisor's vehicle recommendation, comparison, pricing, or ownership mission.",
  ];

  if (topicCategory === ADVISOR_TOPIC_CATEGORY.PHONE_CONSUMER_ELECTRONICS) {
    return [
      ...common,
      "If relevant, the final bridge can connect phone features to in-car tech such as CarPlay, Android Auto, infotainment, charging, or connectivity.",
    ];
  }
  if (topicCategory === ADVISOR_TOPIC_CATEGORY.CODING_DEV) {
    return [
      ...common,
      "If relevant, the final bridge can connect the code task to vehicle data, vehicle documents, recommendations, pricing, or ownership analysis.",
    ];
  }
  if (topicCategory === ADVISOR_TOPIC_CATEGORY.VEHICLE_DOCUMENT_DATA_EXTRACTION) {
    return [
      ...common,
      "If relevant, the final bridge can connect OCR to VINs, license plates, window stickers, invoices, service records, or vehicle evaluation.",
    ];
  }
  if (topicCategory === ADVISOR_TOPIC_CATEGORY.SAAS_SOFTWARE_BUSINESS_TOOLS) {
    return [
      ...common,
      "If relevant, the final bridge can connect software or SaaS advice to dealership, fleet, auto-sales, or vehicle-shopping workflows.",
    ];
  }
  return common;
}

function allowedBehaviorForIntent(intent) {
  return {
    answerDepth:
      intent === ADVISOR_DOMAIN_INTENT.LOW_SIGNAL_OR_NONSENSE
        ? "natural_clarification"
        : intent === ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING
            ? "normal_vehicle_advice"
            : "unrestricted_general_answer_then_vehicle_bridge",
    canAnswerOffTopicNormally:
      intent === ADVISOR_DOMAIN_INTENT.AUTOMOTIVE_ADJACENT ||
      intent === ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE ||
      intent === ADVISOR_DOMAIN_INTENT.OFF_TOPIC_UNRELATED,
    canProvideShortCodeExamples:
      intent === ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE ||
      intent === ADVISOR_DOMAIN_INTENT.OFF_TOPIC_UNRELATED,
    canBridgeToAutomotive:
      intent === ADVISOR_DOMAIN_INTENT.AUTOMOTIVE_ADJACENT ||
      intent === ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE ||
      intent === ADVISOR_DOMAIN_INTENT.OFF_TOPIC_UNRELATED,
    mustCloseWithAutomotiveBridge: intent !== ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING,
    mustRedirectToVehicleGoal: false,
    mustAskVehicleRelatedFollowUp: false,
  };
}

function classifyScopeMetadata(message) {
  const normalized = normalizeScopeText(message);
  const automotiveSignal = hasAutomotiveScopeSignal(normalized);
  const automotiveBusinessSignal = hasAutomotiveBusinessSignal(normalized);
  const softwareOrProductSignal = hasSoftwareOrProductSignal(normalized);
  const phoneSignal = hasPhoneSignal(normalized);
  const codingSignal = hasCodingSignal(normalized);
  const documentExtractionSignal = hasDocumentExtractionSignal(normalized);

  if (automotiveSignal && !softwareOrProductSignal && !phoneSignal && !codingSignal) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING,
      topicCategory: topicForAutomotiveMessage(normalized),
    };
  }

  if (softwareOrProductSignal && automotiveBusinessSignal) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.AUTOMOTIVE_ADJACENT,
      topicCategory: ADVISOR_TOPIC_CATEGORY.DEALERSHIP_FLEET_AUTOMOTIVE_BUSINESS,
    };
  }

  if (automotiveBusinessSignal) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.AUTOMOTIVE_ADJACENT,
      topicCategory: ADVISOR_TOPIC_CATEGORY.DEALERSHIP_FLEET_AUTOMOTIVE_BUSINESS,
    };
  }

  if (codingSignal) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE,
      topicCategory: documentExtractionSignal
        ? ADVISOR_TOPIC_CATEGORY.VEHICLE_DOCUMENT_DATA_EXTRACTION
        : ADVISOR_TOPIC_CATEGORY.CODING_DEV,
    };
  }

  if (phoneSignal) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE,
      topicCategory: ADVISOR_TOPIC_CATEGORY.PHONE_CONSUMER_ELECTRONICS,
    };
  }

  if (softwareOrProductSignal) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE,
      topicCategory: ADVISOR_TOPIC_CATEGORY.SAAS_SOFTWARE_BUSINESS_TOOLS,
    };
  }

  if (matchesAny(normalized, FINANCE_BRIDGE_PATTERNS)) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE,
      topicCategory: ADVISOR_TOPIC_CATEGORY.PRICING_PAYMENT,
    };
  }

  if (matchesAny(normalized, TRAVEL_BRIDGE_PATTERNS)) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.OFF_TOPIC_BRIDGEABLE,
      topicCategory: ADVISOR_TOPIC_CATEGORY.CAR_RECOMMENDATION,
    };
  }

  if (matchesAny(normalized, CLEAR_OFF_TOPIC_PATTERNS)) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.OFF_TOPIC_UNRELATED,
      topicCategory: ADVISOR_TOPIC_CATEGORY.GENERIC_OFF_TOPIC,
    };
  }

  if (isLowSignalMessage(normalized)) {
    return {
      intent: ADVISOR_DOMAIN_INTENT.LOW_SIGNAL_OR_NONSENSE,
      topicCategory: ADVISOR_TOPIC_CATEGORY.NONSENSE_LOW_SIGNAL,
    };
  }

  return {
    intent: ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING,
    topicCategory: ADVISOR_TOPIC_CATEGORY.CAR_RECOMMENDATION,
  };
}

export function classifyAdvisorMessageScope(message) {
  const metadata = classifyScopeMetadata(message);
  const status = statusForDomainIntent(metadata.intent);
  const statusLabel = statusLabelForIntent(metadata.intent);
  const automotiveBridgeHints = bridgeHintsForTopic(metadata.topicCategory);

  return {
    ...metadata,
    status,
    route: routeForStatus(status),
    domainStatus: domainStatusForIntent(metadata.intent),
    statusLabel,
    status_label: statusLabel,
    automotiveBridgeHints,
    allowedBehavior: allowedBehaviorForIntent(metadata.intent),
    forbiddenBehavior: forbiddenBehaviorForTopic(metadata.topicCategory),
  };
}

export function buildAdvisorScopeInsightPayload(message, options = {}) {
  const classification = options.classification ?? classifyAdvisorMessageScope(message);
  return {
    task: "generate_ai_insight",
    assistantName: "CarVista Advisor",
    primaryMission: PRIMARY_MISSION,
    userMessage: compactString(message),
    conversationHistorySummary: compactString(options.conversationHistorySummary),
    intent: classification.intent,
    topicCategory: classification.topicCategory,
    domainStatus: classification.domainStatus,
    statusLabel: classification.statusLabel,
    structuredResult: options.structuredResult ?? null,
    deterministicCalculations: options.deterministicCalculations ?? null,
    allowedBehavior: classification.allowedBehavior,
    automotiveBridgeHints: classification.automotiveBridgeHints,
    forbiddenBehavior: classification.forbiddenBehavior,
    responseStyle: {
      language: "English",
      tone: "natural, helpful, conversational",
      lengthGuidance:
        classification.intent === ADVISOR_DOMAIN_INTENT.LOW_SIGNAL_OR_NONSENSE
          ? "natural clarification"
          : "answer freely with enough useful detail for chat, then an automotive bridge",
      avoid: [
        "repeating the same fallback text",
        "sounding like a fixed FAQ bot",
        "overusing 'I am only...'",
        "being condescending",
      ],
    },
    responseRequirements: {
      language: "English",
      lengthGuidance:
        classification.intent === ADVISOR_DOMAIN_INTENT.LOW_SIGNAL_OR_NONSENSE
          ? "clarify naturally without pretending to understand"
          : "complete the user's request naturally before returning to the CarVista Advisor mission",
      mustMentionPrimaryMission: classification.intent !== ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING,
      mustAskFollowUp: false,
      mustCloseWithAutomotiveBridge: classification.intent !== ADVISOR_DOMAIN_INTENT.IN_DOMAIN_CAR_SHOPPING,
      avoidFixedFallback: true,
    },
  };
}

export function buildAdvisorScopeReply() {
  return EMERGENCY_POLICY_FALLBACK;
}

export function buildAdvisorScopePolicy(message, options = {}) {
  const classification = classifyAdvisorMessageScope(message);
  const status =
    classification.status === ADVISOR_SCOPE_STATUS.IN_SCOPE
      ? ADVISOR_SCOPE_STATUS.OFF_TOPIC
      : classification.status;
  const statusLabel =
    classification.statusLabel ??
    (status === ADVISOR_SCOPE_STATUS.OFF_TOPIC ? "Out of scope" : "Needs clarification");

  return {
    policy: status === ADVISOR_SCOPE_STATUS.LOW_SIGNAL ? "low_signal_clarification" : "scope_redirect",
    final_answer: EMERGENCY_POLICY_FALLBACK,
    fallback_answer: EMERGENCY_POLICY_FALLBACK,
    follow_up: null,
    status,
    status_label: statusLabel,
    deterministic: false,
    classification,
    insight_payload: buildAdvisorScopeInsightPayload(message, {
      ...options,
      classification,
    }),
  };
}
