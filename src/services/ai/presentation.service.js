import { currencySymbolMap } from "./_helpers.js";
import { buildConfidence, buildEvidence, buildNarrativeEnvelope } from "./contracts.js";

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatMoneyText(value, currency) {
  const num = safeNumber(value);
  if (num == null) return "N/A";

  const symbol = currencySymbolMap[currency] ?? "";
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(num);

  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`.trim();
}

function formatVariantName(item) {
  return [item?.make, item?.model, item?.trim].filter(Boolean).join(" ").trim();
}

function describeScore(item) {
  if (!item?.scores) return "Scoring details are limited.";

  const finalScore = safeNumber(item.scores.final_score);
  const ratingScore = safeNumber(item.scores.rating_score);
  const priceScore = safeNumber(item.scores.price_score);
  const practicalityScore = safeNumber(item.scores.practicality_score);
  const useCaseFit = safeNumber(item.scores.use_case_fit_score);

  return [
    finalScore != null ? `overall ${finalScore.toFixed(1)}` : null,
    ratingScore != null ? `rating ${ratingScore.toFixed(1)}` : null,
    priceScore != null ? `value ${priceScore.toFixed(1)}` : null,
    practicalityScore != null ? `practicality ${practicalityScore.toFixed(1)}` : null,
    useCaseFit != null ? `use-case fit ${useCaseFit.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildComparePresentation(result) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const sorted = [...items].sort(
    (a, b) => (safeNumber(b?.scores?.final_score) ?? -1) - (safeNumber(a?.scores?.final_score) ?? -1)
  );

  const winner = sorted[0] ?? null;
  const runnerUp = sorted[1] ?? null;
  const comparedNames = items.map(formatVariantName).filter(Boolean);
  const comparedText =
    comparedNames.length > 1
      ? `${comparedNames.slice(0, -1).join(", ")} and ${comparedNames.at(-1)}`
      : comparedNames[0] || "the selected variants";

  return buildNarrativeEnvelope({
    title: "AI comparison verdict",
    assistant_message: winner
      ? `${formatVariantName(winner)} is the strongest overall fit among ${comparedText}. ${describeScore(winner)}.`
      : "The comparison ran, but there was not enough grounded data to produce a confident verdict.",
    highlights: [
      winner ? `${formatVariantName(winner)} is the best all-round recommendation.` : null,
      runnerUp ? `${formatVariantName(runnerUp)} is the closest alternative.` : null,
      result?.profile_fit_summary ?? null,
    ].filter(Boolean),
    insight_cards: [
      winner
        ? {
            title: "Best overall",
            value: formatVariantName(winner),
            description: winner.recommendation_reason || describeScore(winner),
          }
        : null,
      runnerUp
        ? {
            title: "Closest alternative",
            value: formatVariantName(runnerUp),
            description: runnerUp.pros?.[0] || describeScore(runnerUp),
          }
        : null,
      result?.comparison_focus
        ? {
            title: "Decision lens",
            value: result.comparison_focus,
            description: "The recommendation was weighted toward the buyer profile or decision context supplied.",
          }
        : null,
    ].filter(Boolean),
    confidence: result?.confidence ?? buildConfidence(0.66, ["The result is grounded to structured local catalog and pricing data."]),
    evidence:
      result?.evidence ??
      buildEvidence({
        verified: ["Vehicle identities, internal specs, and local market data were used when available."],
        inferred: ["Practicality and fit scoring combine structured signals into an expert-style verdict."],
        estimated: [],
      }),
    sources: result?.sources ?? [],
    caveats: result?.caveats ?? [],
  });
}

export function buildPredictPresentation(result) {
  const predictedPrice = safeNumber(result?.predicted_price);
  const lastPrice = safeNumber(result?.last_price);
  const predictedMin = safeNumber(result?.predicted_min);
  const predictedMax = safeNumber(result?.predicted_max);
  const trendSlope = safeNumber(result?.trend_slope);
  const currency = result?.currency ?? "USD";
  const direction =
    predictedPrice != null && lastPrice != null
      ? predictedPrice >= lastPrice
        ? "upward"
        : "downward"
      : trendSlope != null && trendSlope >= 0
        ? "upward"
        : "downward";

  return buildNarrativeEnvelope({
    title: "AI price outlook",
    assistant_message:
      predictedPrice != null
        ? `The best current estimate points to a ${direction} move over the next ${result?.horizon_months ?? 6} month(s), with a midpoint near ${formatMoneyText(
            predictedPrice,
            currency
          )}.`
        : "There is still not enough grounded evidence to estimate a future price range for this vehicle.",
    highlights: [
      predictedPrice != null ? `Projected midpoint: ${formatMoneyText(predictedPrice, currency)}` : null,
      predictedMin != null && predictedMax != null
        ? `Estimated range: ${formatMoneyText(predictedMin, currency)} to ${formatMoneyText(predictedMax, currency)}`
        : null,
      result?.scarcity_signal ? `Market position: ${result.scarcity_signal}` : null,
    ].filter(Boolean),
    insight_cards: [
      {
        title: "Forecast range",
        value: predictedPrice != null ? formatMoneyText(predictedPrice, currency) : "Unavailable",
        description:
          predictedMin != null && predictedMax != null
            ? `Likely band ${formatMoneyText(predictedMin, currency)} to ${formatMoneyText(predictedMax, currency)}`
            : "No confidence band could be established.",
      },
      {
        title: "Confidence",
        value: result?.confidence?.label ?? "Pending",
        description:
          result?.prediction_mode === "history_regression"
            ? "Built from this variant's own market history."
            : "Built from limited local history plus comparable market and retention signals.",
      },
      {
        title: "Key factor",
        value: direction === "upward" ? "Retention support" : "Depreciation pressure",
        description: result?.primary_driver ?? "The market outlook is driven by a blend of history, comparables, and retention heuristics.",
      },
    ],
    confidence:
      result?.confidence ??
      buildConfidence(result?.confidence_score ?? 0.45, [
        result?.history_points >= 8 ? "The forecast uses a meaningful local history window." : "The forecast required fallback logic because the local history is limited.",
      ]),
    evidence:
      result?.evidence ??
      buildEvidence({
        verified: ["Local price history and comparable model signals were used where available."],
        inferred: ["Depreciation pressure and retention strength are interpreted from the available signals."],
        estimated: ["Future price is always an estimate, not a guaranteed resale outcome."],
      }),
    sources: result?.sources ?? [],
    caveats: result?.caveats ?? [],
  });
}

export function buildTcoPresentation(result) {
  const currency = result?.currency ?? "USD";
  const upfront =
    (safeNumber(result?.base_price) ?? 0) +
    (safeNumber(result?.costs?.registration_tax) ?? 0) +
    (safeNumber(result?.costs?.excise_tax) ?? 0) +
    (safeNumber(result?.costs?.vat) ?? 0) +
    (safeNumber(result?.costs?.import_duty) ?? 0) +
    (safeNumber(result?.costs?.other) ?? 0);

  return buildNarrativeEnvelope({
    title: "Estimated ownership cost",
    assistant_message: `In ${result?.market_name || "the selected market"}, the drive-away spend is estimated around ${formatMoneyText(
      upfront,
      currency
    )}, while total ownership over ${result?.ownership_years ?? 5} year(s) lands near ${formatMoneyText(
      result?.total_cost,
      currency
    )}.`,
    highlights: [
      `Estimated drive-away spend: ${formatMoneyText(upfront, currency)}`,
      `Estimated ${result?.ownership_years ?? 5}-year total: ${formatMoneyText(result?.total_cost, currency)}`,
      `Average yearly cost: ${formatMoneyText(result?.yearly_cost_avg, currency)}`,
    ],
    insight_cards: [
      {
        title: "Drive-away estimate",
        value: formatMoneyText(upfront, currency),
        description: "Vehicle price plus taxes, registration, and other one-time fees.",
      },
      {
        title: "Recurring ownership",
        value: formatMoneyText(
          (safeNumber(result?.costs?.insurance_total) ?? 0) + (safeNumber(result?.costs?.maintenance_total) ?? 0),
          currency
        ),
        description: "Insurance and maintenance over the selected ownership period.",
      },
      {
        title: "Depreciation",
        value: formatMoneyText(result?.costs?.depreciation_total, currency),
        description: "Depreciation is separated so the user can see the hidden cost of ownership clearly.",
      },
    ],
    confidence:
      result?.confidence ??
      buildConfidence(0.72, ["The TCO path is formula-based and uses configured market rules rather than free-form text generation."]),
    evidence:
      result?.evidence ??
      buildEvidence({
        verified: ["Configured local market rules and formulas were used when present."],
        inferred: [],
        estimated: result?.assumptions?.length ? ["Some recurring cost assumptions were filled using defaults."] : [],
      }),
    sources: result?.sources ?? [],
    caveats: result?.caveats ?? [],
  });
}
