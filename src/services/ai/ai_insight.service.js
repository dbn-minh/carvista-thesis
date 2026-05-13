import { defaultOllamaService } from "./ollama.service.js";
import { parseModelJson } from "./advisor_llm.service.js";
import { logAiEvent } from "./logger.service.js";

// Shared explanation layer: backend services calculate and validate; Qwen3 only
// interprets already-structured results and must fall back safely when unavailable.
const DISABLED_AI_PROVIDERS = new Set(["0", "false", "off", "none", "disabled"]);

const COMMON_GUARDRAILS = [
  "Use only the provided backend JSON data.",
  "Do not invent missing values, vehicle specs, prices, taxes, fees, ratings, production numbers, or market data.",
  "If data is missing, say that the data is unavailable or incomplete.",
  "Do not directly calculate numeric values unless the exact numbers are provided by the backend JSON.",
  "Do not guarantee future prices, resale outcomes, legal tax treatment, or financial results.",
  "Return strict JSON only.",
].join(" ");

function providerDisabledByEnv() {
  const configured = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  return DISABLED_AI_PROVIDERS.has(configured);
}

function shouldUseInsightModel(ollama) {
  if (!ollama?.generate) return false;
  if (providerDisabledByEnv()) return false;
  if (ollama === defaultOllamaService && process.env.NODE_ENV === "test") return false;
  if (ollama.provider === "fpt" && (!ollama.apiKey || !ollama.model)) return false;
  return true;
}

function compactString(value, fallback = "") {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function compactTextArray(values, limit = 4) {
  return (Array.isArray(values) ? values : [])
    .map((value) => compactString(value))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeInsight(parsed, fallback) {
  if (!parsed || typeof parsed !== "object") return fallback;

  const summary = compactString(parsed.summary || parsed.answer, fallback.summary);
  const reasons = compactTextArray(parsed.reasons, 5);
  const caveats = compactTextArray(parsed.caveats, 4);
  const advice = compactString(parsed.advice, fallback.advice);

  return {
    summary: summary || fallback.summary,
    reasons: reasons.length ? reasons : fallback.reasons,
    caveats: caveats.length ? caveats : fallback.caveats,
    advice: advice || fallback.advice,
  };
}

function buildMeta(ollama, { aiUsed, fallbackUsed, error = null }) {
  return {
    aiProvider: ollama?.provider ?? null,
    aiModel: ollama?.model ?? null,
    aiUsed: Boolean(aiUsed),
    fallbackUsed: Boolean(fallbackUsed),
    ...(error ? { error: compactString(error.message || error).slice(0, 180) } : {}),
  };
}

function buildPresentationFromInsight(presentation, aiInsight, titleFallback) {
  return {
    ...(presentation ?? {}),
    title: presentation?.title || titleFallback,
    assistant_message: aiInsight.summary || presentation?.assistant_message || titleFallback,
    highlights: aiInsight.reasons?.length ? aiInsight.reasons.slice(0, 4) : presentation?.highlights ?? [],
    caveats: presentation?.caveats ?? aiInsight.caveats ?? [],
  };
}

function fallbackComparisonInsight(result, presentation) {
  return {
    summary:
      presentation?.assistant_message ||
      "The comparison is based on backend scoring, local catalog data, and available market signals.",
    reasons: compactTextArray(presentation?.highlights, 4),
    caveats: compactTextArray(result?.caveats, 4),
    advice: "Use the winner as decision support, then check price, condition, and equipment before buying.",
  };
}

function fallbackPriceInsight(result, presentation) {
  return {
    summary:
      presentation?.assistant_message ||
      "The price outlook is generated from backend market indicators because AI explanation was unavailable.",
    reasons: compactTextArray(result?.key_factors ?? result?.factors ?? presentation?.highlights, 4),
    caveats: compactTextArray(result?.caveats ?? result?.assumptions?.map((item) => item.label), 4),
    advice: "Treat the outlook as decision support, not a guaranteed future resale value.",
  };
}

function fallbackTcoInsight(result, presentation) {
  return {
    summary:
      presentation?.assistant_message ||
      result?.message ||
      "Generated from backend TCO result because AI explanation was unavailable.",
    reasons: compactTextArray(presentation?.highlights, 4),
    caveats: compactTextArray(result?.caveats ?? result?.assumptions, 4),
    advice: "Use the final ownership cost together with the assumptions and configured market rules.",
  };
}

function fallbackAdvisorInsight(fallbackAnswer, structuredResult) {
  return {
    summary:
      compactString(fallbackAnswer) ||
      "I used the backend result to prepare a grounded vehicle answer.",
    reasons: compactTextArray(structuredResult?.factors ?? structuredResult?.highlights, 4),
    caveats: compactTextArray(structuredResult?.caveats ?? structuredResult?.assumptions?.map((item) => item.label), 4),
    advice: "Ask a follow-up question if you want the result narrowed to your budget, market, or ownership plan.",
  };
}

function vehicleName(item) {
  return [item?.year, item?.make, item?.model, item?.trim, item?.name]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactComparisonResult(result) {
  return {
    recommended_variant_id: result?.recommended_variant_id ?? null,
    recommendation_reason: result?.recommendation_reason ?? null,
    comparison_focus: result?.comparison_focus ?? null,
    profile_fit_summary: result?.profile_fit_summary ?? null,
    confidence: result?.confidence ?? null,
    vehicles: (result?.items ?? []).slice(0, 5).map((item) => ({
      variant_id: item.variant_id,
      title: vehicleName(item),
      body_type: item.body_type ?? null,
      fuel_type: item.fuel_type ?? null,
      seats: item.seats ?? null,
      latest_price: item.latest_price ?? null,
      msrp_base: item.msrp_base ?? null,
      scores: item.scores ?? {},
      strengths: compactTextArray(item.pros, 4),
      weaknesses: compactTextArray(item.cons, 4),
      market_signal: item.market_signal ?? null,
    })),
    caveats: compactTextArray(result?.caveats, 5),
  };
}

function compactPriceResult(result) {
  return {
    variant_id: result?.variant_id ?? null,
    vehicle: result?.vehicle ?? null,
    market_id: result?.market_id ?? null,
    currency: result?.currency ?? result?.forecast_range?.currency ?? null,
    horizon_months: result?.horizon_months ?? null,
    prediction_mode: result?.prediction_mode ?? null,
    history_points: result?.history_points ?? null,
    last_price: result?.last_price ?? null,
    predicted_price: result?.predicted_price ?? result?.forecast_range?.midpoint ?? null,
    predicted_min: result?.predicted_min ?? result?.forecast_range?.min ?? null,
    predicted_max: result?.predicted_max ?? result?.forecast_range?.max ?? null,
    trend_slope: result?.trend_slope ?? null,
    volatility: result?.volatility ?? null,
    fair_value_estimate: result?.fair_value_estimate ?? null,
    fair_value_min: result?.fair_value_min ?? null,
    fair_value_max: result?.fair_value_max ?? null,
    scarcity_signal: result?.scarcity_signal ?? null,
    primary_driver: result?.primary_driver ?? null,
    key_factors: compactTextArray(result?.key_factors ?? result?.factors, 5),
    live_market_snapshot: result?.live_market_snapshot ?? null,
    confidence: result?.confidence ?? null,
    caveats: compactTextArray(result?.caveats ?? result?.assumptions?.map((item) => item.label), 5),
  };
}

function compactTcoResult(result) {
  return {
    status: result?.status ?? "complete",
    code: result?.code ?? null,
    market_name: result?.market_name ?? result?.country ?? null,
    currency: result?.currency ?? result?.totals?.currency ?? null,
    base_price: result?.base_price ?? result?.one_time_costs?.base_price ?? null,
    ownership_years: result?.ownership_years ?? result?.totals?.ownership_years ?? null,
    km_per_year: result?.km_per_year ?? null,
    costs: result?.costs ?? {
      ...result?.one_time_costs,
      ...result?.recurring_costs,
    },
    total_cost: result?.total_cost ?? result?.totals?.total ?? null,
    yearly_cost_avg: result?.yearly_cost_avg ?? result?.totals?.yearly_average ?? null,
    monthly_cost_avg: result?.monthly_cost_avg ?? result?.totals?.monthly_average ?? null,
    yearly_breakdown: result?.yearly_breakdown ?? null,
    rules_applied: (result?.rules_applied ?? []).slice(0, 12),
    assumptions: compactTextArray(result?.assumptions, 6),
    confidence: result?.confidence ?? null,
    caveats: compactTextArray(result?.caveats, 5),
  };
}

async function runInsightGeneration({
  feature,
  system,
  prompt,
  fallbackInsight,
  fallbackPresentation = null,
  presentationTitle,
  ollama = defaultOllamaService,
  options = { temperature: 0.25, num_predict: 360 },
}) {
  if (!shouldUseInsightModel(ollama)) {
    logAiEvent("info", `qwen3_${feature}_fallback`, {
      reason: "provider_disabled_or_unavailable",
      provider: ollama?.provider ?? null,
      model: ollama?.model ?? null,
    });
    return {
      aiInsight: fallbackInsight,
      presentation: buildPresentationFromInsight(fallbackPresentation, fallbackInsight, presentationTitle),
      meta: buildMeta(ollama, { aiUsed: false, fallbackUsed: true }),
    };
  }

  try {
    logAiEvent("info", `qwen3_${feature}`, {
      provider: ollama.provider,
      model: ollama.model,
    });
    const response = await ollama.generate({
      system,
      prompt,
      format: "json",
      options,
    });
    const aiInsight = normalizeInsight(parseModelJson(response.text), fallbackInsight);
    return {
      aiInsight,
      presentation: buildPresentationFromInsight(fallbackPresentation, aiInsight, presentationTitle),
      meta: buildMeta(ollama, { aiUsed: true, fallbackUsed: false }),
    };
  } catch (error) {
    logAiEvent("warn", `qwen3_${feature}_fallback`, {
      provider: ollama?.provider ?? null,
      model: ollama?.model ?? null,
      error: error?.message ?? String(error),
    });
    return {
      aiInsight: fallbackInsight,
      presentation: buildPresentationFromInsight(fallbackPresentation, fallbackInsight, presentationTitle),
      meta: buildMeta(ollama, { aiUsed: false, fallbackUsed: true, error }),
    };
  }
}

export async function generateComparisonInsight(
  { structuredResult, presentation = null } = {},
  { ollama = defaultOllamaService } = {}
) {
  const fallbackInsight = fallbackComparisonInsight(structuredResult, presentation);
  return runInsightGeneration({
    feature: "comparison_insight",
    ollama,
    fallbackInsight,
    fallbackPresentation: presentation,
    presentationTitle: presentation?.title || "AI comparison verdict",
    system: [
      "You are CarVista's vehicle comparison insight layer.",
      COMMON_GUARDRAILS,
      "The backend already selected scores, strengths, weaknesses, and winner.",
      "Do not override the backend winner unless you only explain uncertainty caused by incomplete data.",
      "Write practical car-buyer language.",
      'Return JSON exactly as {"summary": string, "reasons": string[], "caveats": string[], "advice": string}.',
    ].join(" "),
    prompt: [
      "/no_think",
      "Explain this structured comparison result.",
      "Include a short verdict, why the winner is suitable, strengths and weaknesses, trade-offs, and caveats.",
      `comparison_json: ${JSON.stringify(compactComparisonResult(structuredResult))}`,
      `fallback_text: ${JSON.stringify(fallbackInsight.summary)}`,
    ].join("\n"),
    options: { temperature: 0.28, num_predict: 420 },
  });
}

export async function generatePriceOutlookInsight(
  { structuredResult, presentation = null } = {},
  { ollama = defaultOllamaService } = {}
) {
  const fallbackInsight = fallbackPriceInsight(structuredResult, presentation);
  return runInsightGeneration({
    feature: "price_outlook_insight",
    ollama,
    fallbackInsight,
    fallbackPresentation: presentation,
    presentationTitle: presentation?.title || "AI price outlook",
    system: [
      "You are CarVista's price outlook and market trend insight layer.",
      COMMON_GUARDRAILS,
      "The backend already estimated all price indicators and market signals.",
      "Do not invent future prices, demand signals, production volume, or limited-edition facts.",
      "Explain rarity or limited-production only if the backend JSON explicitly supports it.",
      "Explain the outlook as decision support, not financial certainty.",
      'Return JSON exactly as {"summary": string, "reasons": string[], "caveats": string[], "advice": string}.',
    ].join(" "),
    prompt: [
      "/no_think",
      "Explain this structured price outlook result.",
      "Cover trend direction, value-retention supports, downside risks, rarity/market supply if available, risk level, buyer advice, and uncertainty.",
      `price_outlook_json: ${JSON.stringify(compactPriceResult(structuredResult))}`,
      `fallback_text: ${JSON.stringify(fallbackInsight.summary)}`,
    ].join("\n"),
    options: { temperature: 0.25, num_predict: 420 },
  });
}

export async function generateTcoInsight(
  { structuredResult, presentation = null } = {},
  { ollama = defaultOllamaService } = {}
) {
  const fallbackInsight = fallbackTcoInsight(structuredResult, presentation);
  return runInsightGeneration({
    feature: "tco_insight",
    ollama,
    fallbackInsight,
    fallbackPresentation: presentation,
    presentationTitle: presentation?.title || "Estimated ownership cost",
    system: [
      "You are CarVista's total cost of ownership insight layer.",
      COMMON_GUARDRAILS,
      "The backend already calculated taxes, fees, insurance, maintenance, depreciation, energy cost, and final totals.",
      "Do not recalculate or change the numbers.",
      "Do not invent tax laws, fees, insurance quotes, or legal advice.",
      "Explain the result in simple language for normal car buyers.",
      'Return JSON exactly as {"summary": string, "reasons": string[], "caveats": string[], "advice": string}.',
    ].join(" "),
    prompt: [
      "/no_think",
      "Explain this structured TCO result.",
      "Cover final TCO, main cost drivers, taxes/fees, insurance, maintenance, depreciation, practical advice, and uncertainty.",
      `tco_json: ${JSON.stringify(compactTcoResult(structuredResult))}`,
      `fallback_text: ${JSON.stringify(fallbackInsight.summary)}`,
    ].join("\n"),
    options: { temperature: 0.24, num_predict: 420 },
  });
}

export async function generateAdvisorFinalResponse(
  { intent, userMessage = "", structuredResult, rawPayload = null, fallbackAnswer = "", turnContext = {} } = {},
  { ollama = defaultOllamaService } = {}
) {
  const fallbackInsight = fallbackAdvisorInsight(fallbackAnswer, structuredResult);
  const result = await runInsightGeneration({
    feature: "advisor_response",
    ollama,
    fallbackInsight,
    fallbackPresentation: {
      title: "CarVista advisor response",
      assistant_message: fallbackInsight.summary,
      highlights: fallbackInsight.reasons,
      caveats: fallbackInsight.caveats,
    },
    presentationTitle: "CarVista advisor response",
    system: [
      "You are CarVista's expert car advisor final response layer.",
      COMMON_GUARDRAILS,
      "The backend has already routed the intent, validated inputs, retrieved data, and calculated or scored the result.",
      "Prefer backend-provided data over general knowledge.",
      "Do not invent vehicle inventory, specs, prices, taxes, fees, or market results.",
      "Ask one concise follow-up question only when the backend result says information is incomplete.",
      "Use a professional dealership advisor tone.",
      'Return JSON exactly as {"answer": string, "reasons": string[], "caveats": string[], "advice": string}.',
    ].join(" "),
    prompt: [
      "/no_think",
      "Write the final advisor answer from the backend result.",
      `intent: ${JSON.stringify(intent || "unknown")}`,
      `customer_message: ${JSON.stringify(String(userMessage || ""))}`,
      `turn_context_json: ${JSON.stringify(turnContext || {})}`,
      `fallback_backend_answer: ${JSON.stringify(fallbackInsight.summary)}`,
      `structured_backend_result_json: ${JSON.stringify(structuredResult || {})}`,
      `raw_backend_payload_json: ${JSON.stringify(rawPayload || null)}`,
    ].join("\n"),
    options: { temperature: 0.34, num_predict: 420 },
  });

  return {
    ...result,
    final_answer: result.aiInsight.summary || fallbackInsight.summary,
  };
}
