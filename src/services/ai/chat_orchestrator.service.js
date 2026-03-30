import { formatFinalAnswer } from "./ai_formatter.service.js";
import { compareVariants } from "./compare_variants.service.js";
import { handleConversationPolicy } from "./conversation_policy.service.js";
import {
  chatEnvelopeSchema,
  compareResultSchema,
  forecastResultSchema,
  knowledgeResultSchema,
  tcoResultSchema,
  valuationResultSchema,
} from "./dtos.js";
import { classifyIntent } from "./intent_classifier.service.js";
import { answerVehicleQuestion } from "./knowledge_engine.service.js";
import { logAiEvent } from "./logger.service.js";
import { analyzeMarketTrend } from "./market_data.service.js";
import { predictPrice } from "./predict_price.service.js";
import { recommendCars } from "./recommendation.service.js";
import { validateAndResolveRequest } from "./request_validation.service.js";
import { routeIntent } from "./request_router.service.js";
import { searchVariantsByText } from "./source_retrieval.service.js";
import { calculateTco } from "./tco.service.js";

function extractVariantIds(message) {
  const match = String(message || "").match(/\[(\s*\d+\s*(,\s*\d+\s*)+)\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

function buildClarificationMessage(intentResult) {
  const missing = intentResult.missing_fields;
  if (intentResult.intent === "recommend_car" && missing.includes("budget")) {
    return "I can recommend the right cars once I know your target budget. A quick answer like 'around 1 billion VND' is enough.";
  }
  if (intentResult.intent === "compare_car") {
    return "I can compare cars, but I need two grounded vehicles first. Open one vehicle detail page and tell me the second car, or send two variant ids like [101,102].";
  }
  if (intentResult.intent === "calculate_tco") {
    return "To estimate ownership cost properly, I still need a country/market and either a vehicle or a base price.";
  }
  if (intentResult.intent === "predict_vehicle_value" || intentResult.intent === "market_trend_analysis") {
    return "I can do that once I know exactly which vehicle you mean. Open a vehicle detail page or tell me the make, model, and year.";
  }
  return "I need a bit more detail before I can route this request confidently.";
}

async function resolveVehicleId(ctx, message, context, index = 0) {
  const vehicles = classifyIntent(message, context).entities.vehicles;
  if (index === 0 && Number.isInteger(context.focus_variant_id)) return context.focus_variant_id;
  const mention = vehicles[index] ?? null;
  if (!mention) return null;
  const matches = await searchVariantsByText(ctx, mention, 3);
  return matches[0]?.variant_id ?? null;
}

function extractSharedEnvelopeFields(rawPayload, structuredResult) {
  return {
    result_confidence: rawPayload?.confidence ?? structuredResult?.confidence ?? null,
    evidence: rawPayload?.evidence ?? null,
    sources: Array.isArray(rawPayload?.sources)
      ? rawPayload.sources
      : Array.isArray(structuredResult?.sources)
        ? structuredResult.sources
        : [],
    caveats: Array.isArray(rawPayload?.caveats)
      ? rawPayload.caveats
      : Array.isArray(structuredResult?.assumptions)
        ? structuredResult.assumptions.map((note) => note.label)
        : [],
    freshness_note: rawPayload?.freshness_note ?? null,
  };
}

function toCompareResult(payload) {
  return compareResultSchema.parse({
    intent: "compare_car",
    summary: {
      best_overall: payload.items.find((item) => item.variant_id === payload.recommended_variant_id)?.trim
        ? payload.items
            .filter((item) => item.variant_id === payload.recommended_variant_id)
            .map((item) => [item.year, item.make, item.model, item.trim].filter(Boolean).join(" "))[0] ?? null
        : null,
      best_for: {
        value: payload.items.slice().sort((a, b) => a.scores.price_score - b.scores.price_score)[0]?.trim
          ? [payload.items.slice().sort((a, b) => a.scores.price_score - b.scores.price_score)[0].year, payload.items.slice().sort((a, b) => a.scores.price_score - b.scores.price_score)[0].make, payload.items.slice().sort((a, b) => a.scores.price_score - b.scores.price_score)[0].model, payload.items.slice().sort((a, b) => a.scores.price_score - b.scores.price_score)[0].trim].filter(Boolean).join(" ")
          : "",
      },
    },
    vehicles: payload.items.map((item) => ({
      variant_id: item.variant_id ?? null,
      name: [item.year, item.make, item.model, item.trim].filter(Boolean).join(" "),
      pros: item.pros,
      cons: item.cons,
      scores: item.scores,
    })),
    recommendation: {
      winner:
        payload.items.find((item) => item.variant_id === payload.recommended_variant_id)?.variant_id != null
          ? [payload.items.find((item) => item.variant_id === payload.recommended_variant_id)?.year, payload.items.find((item) => item.variant_id === payload.recommended_variant_id)?.make, payload.items.find((item) => item.variant_id === payload.recommended_variant_id)?.model, payload.items.find((item) => item.variant_id === payload.recommended_variant_id)?.trim].filter(Boolean).join(" ")
          : null,
      reason: payload.recommendation_reason,
    },
    confidence: payload.confidence,
    assumptions: (payload.caveats ?? []).map((note) => ({ label: note, type: "estimated" })),
    sources: payload.sources ?? [],
  });
}

function toValuationResult(payload) {
  return valuationResultSchema.parse({
    intent: "predict_vehicle_value",
    variant_id: payload.variant_id ?? null,
    vehicle: payload.variant_id ? String(payload.variant_id) : null,
    current_fair_value_range: {
      min: payload.fair_value_min ?? null,
      midpoint: payload.fair_value_estimate ?? null,
      max: payload.fair_value_max ?? null,
      currency: payload.currency,
    },
    confidence: payload.confidence,
    factors: payload.key_factors ?? [],
    assumptions: (payload.caveats ?? []).map((note) => ({ label: note, type: "estimated" })),
    sources: payload.sources ?? [],
  });
}

function toForecastResult(payload) {
  return forecastResultSchema.parse({
    intent: "market_trend_analysis",
    variant_id: payload.variant_id ?? null,
    vehicle: payload.variant_id ? String(payload.variant_id) : null,
    horizon_months: payload.horizon_months,
    forecast_range: {
      min: payload.predicted_min ?? null,
      midpoint: payload.predicted_price ?? null,
      max: payload.predicted_max ?? null,
      currency: payload.currency,
    },
    scarcity_signal: payload.scarcity_signal ?? null,
    confidence: payload.confidence,
    factors: payload.key_factors ?? [],
    assumptions: Array.isArray(payload.assumptions)
      ? payload.assumptions
      : (payload.caveats ?? []).map((note) => ({ label: note, type: "estimated" })),
    sources: payload.sources ?? [],
  });
}

function toTcoResult(payload) {
  const costs = payload?.costs ?? {};
  return tcoResultSchema.parse({
    intent: "calculate_tco",
    vehicle: payload.profile_name ?? null,
    country: payload.market_name ?? null,
    one_time_costs: {
      base_price: payload.base_price ?? null,
      registration_tax: costs.registration_tax ?? null,
      excise_tax: costs.excise_tax ?? null,
      vat: costs.vat ?? null,
      import_duty: costs.import_duty ?? null,
      other: costs.other ?? null,
    },
    recurring_costs: {
      insurance_total: costs.insurance_total ?? null,
      maintenance_total: costs.maintenance_total ?? null,
      energy_total: costs.energy_total ?? null,
      depreciation_total: costs.depreciation_total ?? null,
    },
    totals: {
      ownership_years: payload.ownership_years,
      total: payload.total_cost ?? null,
      yearly_average: payload.yearly_cost_avg ?? null,
      monthly_average: payload.monthly_cost_avg ?? null,
      currency: payload.currency,
    },
    confidence: payload.confidence,
    assumptions: (payload.assumptions ?? []).map((note) => ({ label: note, type: "estimated" })),
    sources: payload.sources ?? [],
  });
}

function toKnowledgeResult(payload) {
  return knowledgeResultSchema.parse({
    intent: "vehicle_general_qa",
    variant_id: payload.variant_id ?? null,
    topic: payload.title ?? "vehicle_question",
    direct_answer: payload.assistant_message,
    highlights: payload.highlights ?? [],
    confidence: payload.confidence,
    assumptions: (payload.caveats ?? []).map((note) => ({ label: note, type: "estimated" })),
    sources: payload.sources ?? [],
  });
}

export async function orchestrateChatRequest(
  ctx,
  { message, context = {}, advisor_profile = {}, forced_intent = null, flow_id = null, turn_context = {} }
) {
  const startedAt = Date.now();
  const classifiedIntent = classifyIntent(message, {
    ...context,
    market_id: context.market_id ?? null,
    focus_variant_id: context.focus_variant_id ?? null,
  });
  const intentResult =
    forced_intent != null
      ? {
          ...classifiedIntent,
          intent: forced_intent,
          confidence: Math.max(classifiedIntent.confidence, 0.72),
          needs_clarification: false,
          missing_fields: [],
        }
      : classifiedIntent;
  const route = routeIntent(intentResult);

  logAiEvent("info", "intent_classified", {
    flow_id,
    detected_intent: classifiedIntent.intent,
    effective_intent: intentResult.intent,
    forced_intent,
    confidence: intentResult.confidence,
    needs_clarification: intentResult.needs_clarification,
  });

  if (intentResult.needs_clarification && intentResult.intent !== "vehicle_general_qa" && forced_intent == null) {
    return chatEnvelopeSchema.parse({
      flow_id,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      needs_clarification: true,
      structured_result: null,
      final_answer: buildClarificationMessage(intentResult),
      context_updates: {},
      result_confidence: null,
      evidence: null,
      sources: [],
      caveats: [],
      freshness_note: null,
      meta: {
        services_used: ["IntentClassifier", "RequestRouter"],
        sources_used: [],
        fallback_used: false,
        latency_ms: Date.now() - startedAt,
        route_service: route.service,
        missing_fields: intentResult.missing_fields,
        validation_status: "classifier_clarification",
      },
    });
  }

  if (route.service === "ConversationPolicyService") {
    const policyResponse = handleConversationPolicy(intentResult.intent, message);
    const formatted = formatFinalAnswer({
      intent: intentResult.intent,
      structured_result: null,
      policy_response: policyResponse,
    });
    return chatEnvelopeSchema.parse({
      flow_id,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      needs_clarification: false,
      structured_result: {
        policy: policyResponse.policy,
      },
      final_answer: formatted.final_answer,
      context_updates: {},
      result_confidence: null,
      evidence: null,
      sources: [],
      caveats: [],
      freshness_note: null,
      meta: {
        services_used: ["IntentClassifier", "ConversationPolicyService", "AiFormatter"],
        sources_used: [],
        fallback_used: false,
        latency_ms: Date.now() - startedAt,
        route_service: route.service,
        missing_fields: [],
        validation_status: "skipped",
      },
    });
  }

  const validation = await validateAndResolveRequest(ctx, intentResult, {
    ...context,
    advisor_profile,
    message,
  });

  logAiEvent("info", "request_validated", {
    flow_id,
    intent: intentResult.intent,
    ok: validation.ok,
    missing_fields: validation.clarification?.missing_fields ?? [],
  });

  if (!validation.ok) {
    return chatEnvelopeSchema.parse({
      flow_id,
      intent: validation.clarification.intent,
      confidence: intentResult.confidence,
      needs_clarification: true,
      structured_result: null,
      final_answer: validation.clarification.message,
      context_updates: validation.clarification.context_updates ?? {},
      result_confidence: null,
      evidence: null,
      sources: [],
      caveats: [],
      freshness_note: null,
      meta: {
        services_used: ["IntentClassifier", "RequestRouter", "ValidationGate"],
        sources_used: [],
        fallback_used: false,
        latency_ms: Date.now() - startedAt,
        route_service: route.service,
        missing_fields: validation.clarification.missing_fields ?? [],
        validation_status: "clarification_required",
      },
    });
  }

  let structuredResult = null;
  let rawPayload = null;
  const servicesUsed = ["IntentClassifier", "ValidationGate", route.service];

  if (intentResult.intent === "compare_car") {
    rawPayload = await compareVariants(ctx, {
      variant_ids: validation.payload.variant_ids,
      market_id: validation.payload.market_id,
      buyer_profile: advisor_profile,
    });
    structuredResult = toCompareResult(rawPayload);
  } else if (intentResult.intent === "predict_vehicle_value") {
    rawPayload = await predictPrice(ctx, {
      variant_id: validation.payload.variant_id,
      market_id: validation.payload.market_id,
      horizon_months: validation.payload.horizon_months ?? 6,
    });
    structuredResult = toValuationResult(rawPayload);
  } else if (intentResult.intent === "market_trend_analysis") {
    rawPayload = await analyzeMarketTrend(ctx, {
      variant_id: validation.payload.variant_id,
      market_id: validation.payload.market_id,
      horizon_months: validation.payload.horizon_months ?? 6,
    });
    structuredResult = toForecastResult(rawPayload);
  } else if (intentResult.intent === "calculate_tco") {
    rawPayload = await calculateTco(ctx, {
      market_id: validation.payload.market_id,
      variant_id: validation.payload.variant_id,
      base_price: validation.payload.base_price,
      ownership_years: validation.payload.ownership_years,
      km_per_year: validation.payload.km_per_year,
    });
    structuredResult = toTcoResult(rawPayload);
  } else if (intentResult.intent === "vehicle_general_qa") {
    rawPayload = await answerVehicleQuestion(ctx, {
      message,
      market_id: context.market_id ?? 1,
      focus_variant_id: context.focus_variant_id ?? null,
    });
    structuredResult = toKnowledgeResult(rawPayload);
  } else if (intentResult.intent === "recommend_car") {
    structuredResult = await recommendCars(ctx, {
      profile: {
        ...advisor_profile,
        budget_max: intentResult.entities.budget ?? advisor_profile.budget_max ?? null,
      },
      market_id: context.market_id ?? 1,
    });
    rawPayload = structuredResult;
  }

  const formatted = formatFinalAnswer({
    intent: intentResult.intent,
    structured_result: structuredResult,
    turn_context,
  });
  const shared = extractSharedEnvelopeFields(rawPayload, structuredResult);
  servicesUsed.push("AiFormatter");
  logAiEvent("info", "structured_result_ready", {
    flow_id,
    intent: intentResult.intent,
    services_used: servicesUsed,
    source_count: shared.sources.length,
    turn_type: turn_context?.turn_type ?? null,
  });

  return chatEnvelopeSchema.parse({
    flow_id,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    needs_clarification: false,
    structured_result: structuredResult,
    final_answer: formatted.final_answer,
    context_updates: validation.context_updates ?? {},
    result_confidence: shared.result_confidence,
    evidence: shared.evidence,
    sources: shared.sources,
    caveats: shared.caveats,
    freshness_note: shared.freshness_note,
    meta: {
      services_used: servicesUsed,
      sources_used: [...new Set(shared.sources.map((source) => source.provider))],
      fallback_used:
        rawPayload?.prediction_mode === "limited_history_fallback" ||
        shared.sources.some((source) => source.type !== "internal_db"),
      latency_ms: Date.now() - startedAt,
      route_service: route.service,
      missing_fields: intentResult.missing_fields,
      validation_status: "passed",
    },
  });
}
