import { normalizeConversationText } from "./conversation_orchestrator.service.js";

const REFERENTIAL_FOCUS_PATTERNS = [
  /\b(this car|this vehicle|this one|that car|that vehicle|that one|current car|current vehicle)\b/i,
  /\b(xe nay|xe do|mau nay|mau do)\b/i,
];

const EXPLICIT_INTENT_PATTERNS = [
  ["compare_car", /\b(compare|versus| vs |so sanh)\b/i],
  ["predict_vehicle_value", /\b(predict|forecast|future value|resale|depreciation|gia tuong lai|du doan)\b/i],
  ["market_trend_analysis", /\b(market trend|trend analysis|xu huong|market outlook)\b/i],
  ["calculate_tco", /\b(tco|ownership cost|tax|insurance|maintenance cost|lan banh)\b/i],
  ["vehicle_general_qa", /\b(what is|what's|difference between|explain|how does|why does|should i buy|reliable|safe|maintenance|hybrid|plug-in hybrid|phev)\b/i],
  ["recommend_car", /\b(recommend|suggest|find me|looking for|need a car|want a car|family car|phu hop voi toi)\b/i],
];

const FOLLOW_UP_PATTERNS = [
  /\b(what about|how about|and what about|how is|what if)\b/i,
  /\b(now|also|then|next)\b/i,
  /\b(con|gio|neu vay|the thi)\b/i,
];

const TASK_REPLACEMENT_PATTERNS = [
  /\b(actually|instead|replace that|compare .* instead|so sanh .* thay vao do)\b/i,
  /\b(forget that|different question|another question|new question)\b/i,
];

const TOPIC_SHIFT_PATTERNS = [
  /\b(now another question|different question|forget that|also explain)\b/i,
  /\b(chuyen cau hoi khac|cau hoi khac|bo qua cai do)\b/i,
];

const COMPARE_DIMENSION_PATTERNS = [
  ["resale_value", /\b(resale|retain value|hold value|depreciation)\b/i],
  ["ownership_cost", /\b(cost to own|ownership cost|running cost|maintenance cost|insurance|fuel cost|chi phi nuoi|chi phi van hanh)\b/i],
  ["safety", /\b(safety|safe|crash|driver assist|adas)\b/i],
  ["comfort", /\b(comfort|ride quality|interior|rear seat|cabin)\b/i],
  ["technology", /\b(technology|tech|infotainment|screen|features)\b/i],
  ["performance", /\b(performance|power|acceleration|handling)\b/i],
  ["practicality", /\b(practicality|space|cargo|boot|trunk|family)\b/i],
  ["efficiency", /\b(fuel economy|mpg|efficiency|range|charging)\b/i],
];

function mapIntentToSkill(intent) {
  switch (intent) {
    case "compare_car":
      return "comparison";
    case "predict_vehicle_value":
    case "market_trend_analysis":
      return "forecast";
    case "calculate_tco":
      return "tco";
    case "recommend_car":
      return "recommendation";
    case "vehicle_general_qa":
      return "consultation";
    default:
      return "conversation";
  }
}

function uniqueIntegers(values) {
  return [...new Set((values ?? []).filter((value) => Number.isInteger(value)))];
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function findComparisonDimension(message) {
  const normalized = normalizeConversationText(message);
  const matched = COMPARE_DIMENSION_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  return matched?.[0] ?? null;
}

function hasTaskReplacementSignal(message) {
  const normalized = normalizeConversationText(message);
  return TASK_REPLACEMENT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function hasTopicShiftSignal(message) {
  const normalized = normalizeConversationText(message);
  return TOPIC_SHIFT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function matchesVehicleClarification({ previewEntities, hasVehicleMentions, referentialFocus, activeTopic, conversationState }) {
  if ((previewEntities?.vehicles?.length ?? 0) > 0 || hasVehicleMentions) {
    return { matched: true, confidence: 0.92 };
  }
  if (
    referentialFocus &&
    (Number.isInteger(activeTopic?.focus_variant_id) ||
      (conversationState?.referenced_vehicle_ids?.length ?? 0) === 1)
  ) {
    return { matched: true, confidence: 0.72 };
  }
  return { matched: false, confidence: 0 };
}

function matchesCountryClarification(previewEntities) {
  if (previewEntities?.country) {
    return { matched: true, confidence: 0.94 };
  }
  return { matched: false, confidence: 0 };
}

function matchesBudgetClarification(previewEntities) {
  if (Number.isFinite(previewEntities?.budget)) {
    return { matched: true, confidence: 0.94 };
  }
  return { matched: false, confidence: 0 };
}

function matchesNumericClarification(previewEntities, field) {
  if (field === "ownership_period_years" && Number.isFinite(previewEntities?.ownership_period_years)) {
    return { matched: true, confidence: 0.9 };
  }
  if (field === "annual_mileage_km" && Number.isFinite(previewEntities?.annual_mileage_km)) {
    return { matched: true, confidence: 0.9 };
  }
  return { matched: false, confidence: 0 };
}

function evaluatePendingClarification({
  pendingFlow,
  pendingQuestionKey = null,
  previewEntities = {},
  profilePatch = {},
  recognizedPendingQuestion = false,
  hasVehicleMentions = false,
  referentialFocus = false,
  activeTopic = null,
  conversationState = null,
}) {
  const expectedFields = uniqueStrings([pendingQuestionKey, ...(pendingFlow?.missing_fields ?? [])]);
  if (expectedFields.length === 0) {
    return { matched: false, confidence: 0, field: null, notes: [] };
  }

  if (pendingQuestionKey && recognizedPendingQuestion) {
    return {
      matched: true,
      confidence: 0.96,
      field: pendingQuestionKey,
      notes: [`pending_question:${pendingQuestionKey}`],
    };
  }

  let best = { matched: false, confidence: 0, field: null, notes: [] };

  for (const field of expectedFields) {
    let result = { matched: false, confidence: 0 };
    if (field === "vehicles" || field === "vehicle") {
      result = matchesVehicleClarification({
        previewEntities,
        hasVehicleMentions,
        referentialFocus,
        activeTopic,
        conversationState,
      });
    } else if (field === "country" || field === "market" || field === "market_id") {
      result = matchesCountryClarification(previewEntities);
    } else if (field === "budget" || field === "budget_max" || field === "base_price") {
      result = matchesBudgetClarification(previewEntities);
    } else if (matchesNumericClarification(previewEntities, field).matched) {
      result = matchesNumericClarification(previewEntities, field);
    } else if (Object.prototype.hasOwnProperty.call(profilePatch, field)) {
      result = { matched: true, confidence: 0.9 };
    }

    if (result.matched && result.confidence > best.confidence) {
      best = {
        matched: true,
        confidence: result.confidence,
        field,
        notes: [`pending_field:${field}`],
      };
    }
  }

  return best;
}

function summarizeStructuredResult(intent, structuredResult) {
  if (!structuredResult || typeof structuredResult !== "object") return null;
  if (intent === "compare_car") {
    const vehicleNames = uniqueStrings((structuredResult.vehicles ?? []).map((item) => item.name));
    return {
      intent,
      title: structuredResult.recommendation?.winner ?? vehicleNames.join(" vs "),
      vehicle_names: vehicleNames,
      winner: structuredResult.recommendation?.winner ?? null,
      focus_dimension: null,
    };
  }
  if (intent === "recommend_car") {
    const top = structuredResult.ranked_vehicles?.[0] ?? null;
    return {
      intent,
      title: top?.name ?? structuredResult.profile_summary ?? null,
      vehicle_names: uniqueStrings((structuredResult.ranked_vehicles ?? []).map((item) => item.name)),
      winner: top?.name ?? null,
      focus_dimension: null,
    };
  }
  return {
    intent,
    title: firstNonEmptyString(structuredResult.topic, structuredResult.vehicle, structuredResult.country),
    vehicle_names: uniqueStrings([structuredResult.vehicle]),
    winner: null,
    focus_dimension: null,
  };
}

function extractReferencedVehicleIds(intent, structuredResult, fallback = []) {
  if (intent === "compare_car") {
    return uniqueIntegers([
      ...(structuredResult?.vehicles ?? []).map((item) => item.variant_id),
      ...fallback,
    ]);
  }
  if (intent === "recommend_car") {
    return uniqueIntegers([
      ...(structuredResult?.ranked_vehicles ?? []).map((item) => item.variant_id),
      ...fallback,
    ]);
  }
  return uniqueIntegers([structuredResult?.variant_id, ...fallback]);
}

function extractReferencedListingIds(intent, structuredResult) {
  if (intent === "recommend_car") {
    return uniqueIntegers(
      (structuredResult?.ranked_vehicles ?? []).flatMap((item) => item?.links?.related_listing_ids ?? [])
    );
  }
  return [];
}

function extractReferencedVehicleLabels(intent, structuredResult, fallbackLabel = null) {
  if (intent === "compare_car") {
    return uniqueStrings((structuredResult?.vehicles ?? []).map((item) => item.name));
  }
  if (intent === "recommend_car") {
    return uniqueStrings((structuredResult?.ranked_vehicles ?? []).map((item) => item.name));
  }
  return uniqueStrings([structuredResult?.vehicle, fallbackLabel]);
}

export function isShortClarificationReply(message) {
  const normalized = String(message || "").trim();
  if (!normalized) return false;
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  return normalized.length <= 48 || tokenCount <= 6;
}

export function refersToFocusedVehicle(message) {
  const normalized = normalizeConversationText(message);
  return REFERENTIAL_FOCUS_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function detectExplicitIntent(message) {
  const normalized = normalizeConversationText(message);
  const matched = EXPLICIT_INTENT_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  return matched?.[0] ?? null;
}

export function isFollowUpQuestion(message) {
  const normalized = normalizeConversationText(message);
  return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function detectComparisonDimension(message) {
  return findComparisonDimension(message);
}

export function classifyConversationTurn({
  message,
  pendingFlow = null,
  pendingQuestionKey = null,
  previewIntent = "unknown",
  previewEntities = {},
  activeTopic = null,
  conversationState = null,
  profilePatch = {},
  recognizedPendingQuestion = false,
  hasVehicleMentions = false,
}) {
  const explicitIntent = detectExplicitIntent(message);
  const shortReply = isShortClarificationReply(message);
  const referentialFocus = refersToFocusedVehicle(message);
  const followUp = isFollowUpQuestion(message);
  const activeIntent = conversationState?.active_intent ?? activeTopic?.intent ?? null;
  const replacementSignal = hasTaskReplacementSignal(message);
  const topicShiftSignal = hasTopicShiftSignal(message);
  const comparisonFocus = findComparisonDimension(message);
  const linkedVehicles = previewEntities?.vehicles ?? [];
  const linkedEntities = {
    vehicles: linkedVehicles,
    country: previewEntities?.country ?? null,
  };

  const clarification = evaluatePendingClarification({
    pendingFlow,
    pendingQuestionKey,
    previewEntities,
    profilePatch,
    recognizedPendingQuestion,
    hasVehicleMentions,
    referentialFocus,
    activeTopic,
    conversationState,
  });

  if (clarification.matched) {
    return {
      turn_type: "clarification_response",
      confidence: clarification.confidence,
      should_preserve_topic: true,
      should_replace_active_task: false,
      should_clear_stale_result: false,
      bind_pending_flow: true,
      preserve_focus: true,
      effective_intent: pendingFlow?.intent ?? activeIntent ?? previewIntent,
      linked_entities: linkedEntities,
      follow_up_dimension: null,
      notes: clarification.notes,
    };
  }

  const hasKnownVehicleContext =
    Number.isInteger(activeTopic?.focus_variant_id) ||
    (activeTopic?.compare_variant_ids?.length ?? 0) > 0 ||
    (conversationState?.referenced_vehicle_ids?.length ?? 0) > 0;

  if (referentialFocus && !hasKnownVehicleContext) {
    return {
      turn_type: "ambiguous",
      confidence: 0.45,
      should_preserve_topic: false,
      should_replace_active_task: false,
      should_clear_stale_result: false,
      bind_pending_flow: false,
      preserve_focus: false,
      effective_intent: explicitIntent ?? previewIntent,
      linked_entities: linkedEntities,
      follow_up_dimension: null,
      notes: ["referential_without_focus"],
    };
  }

  if (
    activeIntent === "compare_car" &&
    comparisonFocus &&
    (followUp || referentialFocus || shortReply || previewIntent !== "compare_car")
  ) {
    return {
      turn_type: "follow_up",
      confidence: 0.88,
      should_preserve_topic: true,
      should_replace_active_task: false,
      should_clear_stale_result: false,
      bind_pending_flow: false,
      preserve_focus: true,
      effective_intent: "compare_car",
      linked_entities: linkedEntities,
      follow_up_dimension: comparisonFocus,
      notes: [`comparison_focus:${comparisonFocus}`],
    };
  }

  if (
    activeIntent === "compare_car" &&
    (replacementSignal || (previewIntent === "compare_car" && linkedVehicles.length > 0 && !referentialFocus && !followUp))
  ) {
    return {
      turn_type: "task_replacement",
      confidence: replacementSignal ? 0.94 : 0.8,
      should_preserve_topic: true,
      should_replace_active_task: true,
      should_clear_stale_result: true,
      bind_pending_flow: false,
      preserve_focus: false,
      effective_intent: "compare_car",
      linked_entities: linkedEntities,
      follow_up_dimension: null,
      notes: replacementSignal ? ["explicit_replacement"] : ["compare_entities_replaced"],
    };
  }

  if (
    activeIntent &&
    previewIntent !== "unknown" &&
    previewIntent !== activeIntent &&
    (referentialFocus || hasVehicleMentions || linkedVehicles.length > 0 || previewEntities?.country)
  ) {
    return {
      turn_type: "skill_switch_same_topic",
      confidence: 0.86,
      should_preserve_topic: true,
      should_replace_active_task: false,
      should_clear_stale_result: true,
      bind_pending_flow: false,
      preserve_focus: true,
      effective_intent: explicitIntent ?? previewIntent,
      linked_entities: linkedEntities,
      follow_up_dimension: null,
      notes: ["skill_switch_with_shared_entities"],
    };
  }

  if (
    activeIntent &&
    (followUp || referentialFocus || shortReply) &&
    !topicShiftSignal &&
    !replacementSignal
  ) {
    return {
      turn_type: "follow_up",
      confidence: referentialFocus || followUp ? 0.8 : 0.68,
      should_preserve_topic: true,
      should_replace_active_task: false,
      should_clear_stale_result: false,
      bind_pending_flow: false,
      preserve_focus: true,
      effective_intent: activeIntent,
      linked_entities: linkedEntities,
      follow_up_dimension: comparisonFocus,
      notes: ["short_or_referential_follow_up"],
    };
  }

  if (replacementSignal && activeIntent) {
    return {
      turn_type: "task_replacement",
      confidence: 0.86,
      should_preserve_topic: previewIntent === activeIntent,
      should_replace_active_task: true,
      should_clear_stale_result: true,
      bind_pending_flow: false,
      preserve_focus: false,
      effective_intent: explicitIntent ?? previewIntent,
      linked_entities: linkedEntities,
      follow_up_dimension: null,
      notes: ["replacement_signal"],
    };
  }

  if (
    activeIntent &&
    previewIntent !== "unknown" &&
    previewIntent !== activeIntent &&
    !referentialFocus &&
    linkedVehicles.length === 0 &&
    !previewEntities?.country
  ) {
    return {
      turn_type: "new_topic",
      confidence: 0.9,
      should_preserve_topic: false,
      should_replace_active_task: false,
      should_clear_stale_result: true,
      bind_pending_flow: false,
      preserve_focus: false,
      effective_intent: explicitIntent ?? previewIntent,
      linked_entities: linkedEntities,
      follow_up_dimension: null,
      notes: ["explicit_intent_shift"],
    };
  }

  if (topicShiftSignal && activeIntent) {
    return {
      turn_type: "new_topic",
      confidence: 0.78,
      should_preserve_topic: false,
      should_replace_active_task: false,
      should_clear_stale_result: true,
      bind_pending_flow: false,
      preserve_focus: false,
      effective_intent: explicitIntent ?? previewIntent,
      linked_entities: linkedEntities,
      follow_up_dimension: null,
      notes: ["topic_shift_signal"],
    };
  }

  if (referentialFocus && hasKnownVehicleContext) {
    return {
      turn_type: "follow_up",
      confidence: 0.72,
      should_preserve_topic: true,
      should_replace_active_task: false,
      should_clear_stale_result: false,
      bind_pending_flow: false,
      preserve_focus: true,
      effective_intent: explicitIntent ?? activeIntent ?? previewIntent,
      linked_entities: linkedEntities,
      follow_up_dimension: comparisonFocus,
      notes: ["referential_follow_up"],
    };
  }

  return {
    turn_type: activeIntent ? "new_topic" : "new_topic",
    confidence: activeIntent ? 0.72 : 0.64,
    should_preserve_topic: false,
    should_replace_active_task: false,
    should_clear_stale_result: Boolean(activeIntent),
    bind_pending_flow: false,
    preserve_focus: false,
    effective_intent: explicitIntent ?? previewIntent,
    linked_entities: linkedEntities,
    follow_up_dimension: null,
    notes: activeIntent ? ["default_new_topic"] : ["default_fresh_request"],
  };
}

export function detectConversationTransition(args) {
  const turn = classifyConversationTurn(args);
  return {
    bind_pending_flow: turn.bind_pending_flow,
    topic_switched: turn.turn_type === "new_topic" || turn.turn_type === "task_replacement",
    preserve_focus: turn.preserve_focus,
    explicit_intent: detectExplicitIntent(args?.message),
    turn_type: turn.turn_type,
    effective_intent: turn.effective_intent,
    follow_up_dimension: turn.follow_up_dimension,
    should_clear_stale_result: turn.should_clear_stale_result,
    should_replace_active_task: turn.should_replace_active_task,
    notes: turn.notes,
    confidence: turn.confidence,
  };
}

export function buildActiveTopic({
  intent,
  focus_variant_id = null,
  focus_variant_label = null,
  compare_variant_ids = [],
  market_id = null,
  skill = null,
  turn_type = null,
  summary = null,
}) {
  return {
    intent,
    skill: skill ?? mapIntentToSkill(intent),
    focus_variant_id: Number.isInteger(focus_variant_id) ? focus_variant_id : null,
    focus_variant_label: firstNonEmptyString(focus_variant_label),
    compare_variant_ids: Array.isArray(compare_variant_ids)
      ? compare_variant_ids.filter((value) => Number.isInteger(value)).slice(0, 5)
      : [],
    market_id: Number.isInteger(market_id) ? market_id : null,
    turn_type: turn_type ?? null,
    summary: summary ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function buildConversationState({
  previousState = null,
  turn,
  intent,
  market_id = null,
  market_name = null,
  country = null,
  focus_variant_id = null,
  focus_variant_label = null,
  compare_variant_ids = [],
  pending_flow = null,
  pending_question_key = null,
  structured_result = null,
  needs_clarification = false,
  flow_id = null,
}) {
  const resultSummary = needs_clarification ? null : summarizeStructuredResult(intent, structured_result);
  const referenced_vehicle_ids = extractReferencedVehicleIds(intent, structured_result, [
    focus_variant_id,
    ...compare_variant_ids,
  ]);
  const referenced_listing_ids = extractReferencedListingIds(intent, structured_result);
  const referenced_vehicle_labels = extractReferencedVehicleLabels(intent, structured_result, focus_variant_label);
  const effectiveFocusVariantId =
    Number.isInteger(focus_variant_id) ? focus_variant_id : referenced_vehicle_ids[0] ?? null;
  const effectiveFocusVariantLabel =
    firstNonEmptyString(
      focus_variant_label,
      referenced_vehicle_labels[0],
      previousState?.active_entities?.focus_variant_label
    ) ?? null;

  const activeTopic = buildActiveTopic({
    intent,
    focus_variant_id: effectiveFocusVariantId,
    focus_variant_label: effectiveFocusVariantLabel,
    compare_variant_ids,
    market_id,
    turn_type: turn?.turn_type ?? null,
    summary: resultSummary?.title ?? null,
  });

  return {
    active_topic: activeTopic,
    active_intent: intent,
    active_skill: mapIntentToSkill(intent),
    active_entities: {
      vehicles: referenced_vehicle_labels,
      vehicle_ids: referenced_vehicle_ids,
      focus_variant_id: effectiveFocusVariantId,
      focus_variant_label: effectiveFocusVariantLabel,
      compare_variant_ids: uniqueIntegers(compare_variant_ids),
      listing_ids: referenced_listing_ids,
      market_id: Number.isInteger(market_id) ? market_id : null,
      market_name: market_name ?? null,
      country: country ?? null,
    },
    pending_clarification: pending_flow
      ? {
          type: pending_flow.source ?? "service_validation",
          field: pending_question_key ?? pending_flow.missing_fields?.[0] ?? null,
          intent: pending_flow.intent ?? intent,
          flow_id: pending_flow.id ?? flow_id ?? null,
          missing_fields: uniqueStrings(pending_flow.missing_fields ?? []),
          created_at: pending_flow.created_at ?? new Date().toISOString(),
        }
      : {
          type: null,
          field: null,
          intent: null,
          flow_id: null,
          missing_fields: [],
          created_at: null,
        },
    missing_fields: pending_flow ? uniqueStrings(pending_flow.missing_fields ?? []) : [],
    last_structured_result: resultSummary,
    referenced_vehicle_ids,
    referenced_listing_ids,
    conversation_summary:
      resultSummary?.title ??
      firstNonEmptyString(
        activeTopic.focus_variant_label,
        referenced_vehicle_labels[0],
        previousState?.conversation_summary
      ),
    last_user_turn_type: turn?.turn_type ?? null,
    context_confidence: turn?.confidence ?? null,
    active_flow_id: flow_id ?? null,
    follow_up_dimension: turn?.follow_up_dimension ?? null,
  };
}

export function pruneConversationContext(
  context = {},
  { topicSwitched = false, preserveFocus = false, turnType = null } = {}
) {
  const next = { ...(context || {}) };
  delete next.pending_flow;
  delete next.pending_question_key;

  const effectiveTurnType = turnType ?? (topicSwitched ? "new_topic" : null);

  if (effectiveTurnType === "new_topic" || effectiveTurnType === "task_replacement") {
    delete next.compare_variant_ids;
    delete next.active_topic;
    delete next.pending_flow;
    delete next.pending_question_key;
    if (!preserveFocus) {
      delete next.focus_variant_id;
      delete next.focus_variant_label;
    }
    if (next.conversation_state && typeof next.conversation_state === "object") {
      next.conversation_state = {
        ...next.conversation_state,
        last_structured_result: null,
        referenced_vehicle_ids: preserveFocus ? next.conversation_state.referenced_vehicle_ids ?? [] : [],
        referenced_listing_ids: [],
        pending_clarification: {
          type: null,
          field: null,
          intent: null,
          flow_id: null,
          missing_fields: [],
          created_at: null,
        },
        missing_fields: [],
      };
      if (!preserveFocus) {
        next.conversation_state.active_entities = {
          ...(next.conversation_state.active_entities || {}),
          vehicles: [],
          vehicle_ids: [],
          focus_variant_id: null,
          focus_variant_label: null,
          compare_variant_ids: [],
          listing_ids: [],
        };
      }
    }
  }

  return next;
}
