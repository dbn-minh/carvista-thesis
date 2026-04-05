import { buildConfidence, buildEvidence } from "./contracts.js";
import { logAiEvent } from "./logger.service.js";

function rawMessage(error) {
  return String(error?.message ?? error ?? "").trim();
}

function userMessageForIntent(intent, error) {
  const message = rawMessage(error).toLowerCase();

  if (intent === "calculate_tco") {
    if (message.includes("profile_not_found") || message.includes("tax") || message.includes("registration_tax")) {
      return "I’m missing tax data for that market right now. Tell me the country and vehicle, and I’ll estimate the ownership cost with the best available data.";
    }
    if (message.includes("base_price") || message.includes("variant_id")) {
      return "I still need the vehicle details before I can estimate ownership cost properly.";
    }
    return "I hit a problem while building the ownership-cost estimate. Tell me the country and vehicle, and I’ll guide you with the safest estimate I can make.";
  }

  if (intent === "compare_car") {
    return "I could not complete the comparison cleanly just now. Tell me the two cars again and I’ll rerun it with the latest data.";
  }

  if (intent === "predict_vehicle_value" || intent === "market_trend_analysis") {
    return "I couldn’t complete the price outlook cleanly just now. Tell me the vehicle again and I’ll try a safer valuation path.";
  }

  if (intent === "vehicle_general_qa") {
    return "I ran into an issue while looking up that vehicle. Ask again with the make, model, and year and I’ll answer with the best grounded data I have.";
  }

  return "I hit an internal issue while working on that request. Try rephrasing it, and I’ll keep the answer grounded to vehicle data.";
}

function followUpForIntent(intent) {
  if (intent === "calculate_tco") {
    return ["Tell me the country and the vehicle you want to estimate ownership cost for."];
  }
  if (intent === "compare_car") {
    return ["Tell me the two cars you want to compare."];
  }
  if (intent === "predict_vehicle_value" || intent === "market_trend_analysis") {
    return ["Tell me the exact vehicle you want me to value or forecast."];
  }
  return ["Tell me the vehicle question you want help with, and I’ll keep it focused."];
}

export function mapAiChatErrorToResponse({
  error,
  intent,
  session_id,
  advisor_profile = {},
  market_id = 1,
  flow_id = null,
}) {
  logAiEvent("error", "chat_error_mapped", {
    intent,
    flow_id,
    status: error?.status ?? null,
    message: rawMessage(error),
  });

  return {
    session_id,
    flow_id,
    intent,
    answer: userMessageForIntent(intent, error),
    cards: [],
    advisor_profile,
    suggested_actions: [],
    follow_up_questions: followUpForIntent(intent),
    facts_used: [],
    market_id,
    sources: [],
    caveats: ["The previous attempt failed internally, so this reply is a safe fallback rather than a completed domain result."],
    confidence: buildConfidence(0.24, ["A backend failure occurred, so the assistant is returning a guarded fallback response."]),
    evidence: buildEvidence({
      verified: [],
      inferred: [],
      estimated: ["The user-facing fallback was generated from error-handling policy, not a completed domain calculation."],
    }),
    freshness_note: null,
    needs_clarification: true,
    structured_result: null,
    meta: {
      services_used: ["ErrorMapper"],
      sources_used: [],
      fallback_used: true,
      latency_ms: 0,
      route_service: "ErrorMapper",
      missing_fields: [],
    },
  };
}

export function mapAiHttpError(error, intent = "ai_request") {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  const safeMessage = error?.safe && rawMessage(error) ? rawMessage(error) : null;
  const message = safeMessage || userMessageForIntent(intent, error);

  logAiEvent(status >= 500 ? "error" : "warn", "http_error_mapped", {
    intent,
    status,
    raw_message: rawMessage(error),
  });

  return {
    status,
    safe: true,
    message,
    details: undefined,
  };
}
