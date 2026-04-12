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

function formatThemeList(themes) {
  if (!themes.length) return "balanced all-round use";
  if (themes.length === 1) return themes[0];
  return `${themes.slice(0, -1).join(", ")} and ${themes.at(-1)}`;
}

function buildComparisonThemes(item) {
  if (!item?.scores) return [];

  const seats = safeNumber(item.seats) ?? 0;
  const powerHp = safeNumber(item?.specs?.power_hp ?? item?.specs_kv_selected?.power_hp?.value) ?? 0;
  const priceScore = safeNumber(item.scores.price_score) ?? 0;
  const practicalityScore = safeNumber(item.scores.practicality_score) ?? 0;
  const comfortScore = safeNumber(item.scores.comfort_score) ?? 0;
  const efficiencyScore = safeNumber(item.scores.efficiency_score) ?? 0;
  const resaleScore = safeNumber(item.scores.resale_score) ?? 0;
  const technologyScore = safeNumber(item.scores.technology_score) ?? 0;
  const maintenanceScore = safeNumber(item.scores.maintenance_score) ?? 0;
  const safetyScore = safeNumber(item.scores.safety_score) ?? 0;

  return [
    { label: "overall value", score: priceScore + resaleScore * 0.45 },
    { label: "family practicality", score: practicalityScore + comfortScore + (seats >= 7 ? 2 : seats >= 5 ? 1 : 0) },
    { label: "easy ownership", score: efficiencyScore + maintenanceScore + priceScore * 0.15 },
    { label: "premium comfort", score: comfortScore + technologyScore * 0.75 },
    { label: "resale confidence", score: resaleScore + safetyScore * 0.2 },
    { label: "sportier feel", score: powerHp / 35 + comfortScore * 0.2 + technologyScore * 0.15 },
  ]
    .sort((left, right) => right.score - left.score)
    .filter((item, index, items) => item.score > 0 && items.findIndex((candidate) => candidate.label === item.label) === index)
    .slice(0, 2)
    .map((item) => item.label);
}

function buildBudgetLens(result, winner, runnerUp) {
  if (!winner || !String(result?.profile_fit_summary || "").toLowerCase().includes("budget")) return null;

  const winnerPrice = safeNumber(winner.latest_price ?? winner.msrp_base);
  const runnerPrice = safeNumber(runnerUp?.latest_price ?? runnerUp?.msrp_base);
  const winnerName = formatVariantName(winner);

  if (winnerPrice != null && runnerPrice != null) {
    if (winnerPrice <= runnerPrice * 0.85) {
      return `With your saved budget in mind, ${winnerName} is the easier recommendation to justify.`;
    }
    if (winnerPrice < runnerPrice) {
      return `With your saved budget in mind, ${winnerName} still makes the cleaner value case.`;
    }
  }

  return `With your saved priorities in mind, ${winnerName} still makes the cleaner all-round choice.`;
}

function toSentenceFragment(value, fallback) {
  const text = String(value || fallback || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.]+$/g, "");
  if (!text) return fallback;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildTradeoffSentence(item, fallbackLabel = "all-round use") {
  if (!item) return null;

  const itemName = formatVariantName(item);
  const strongestTheme = buildComparisonThemes(item)[0] ?? fallbackLabel;
  const standout = toSentenceFragment(item?.pros?.[0], `its strongest case is ${strongestTheme}`);
  const caution = item?.cons?.[0] ?? null;
  const shouldSkipCaution = /\brecall\b/i.test(String(caution || ""));

  return caution && !shouldSkipCaution
    ? `${itemName} stands out for ${standout} but asks you to accept ${toSentenceFragment(caution, "a narrower trade-off")}`
    : `${itemName} stands out most for ${strongestTheme}`;
}

function describeAlternativeAngle(item, themes = []) {
  if (!item) return "a narrower niche";

  const price = safeNumber(item.latest_price ?? item.msrp_base) ?? 0;
  const powerHp = safeNumber(item?.specs?.power_hp ?? item?.specs_kv_selected?.power_hp?.value) ?? 0;

  if (powerHp >= 450 || price >= 5000000000) return "drama, design presence, and occasion";
  if (themes.includes("sportier feel")) return "driving character and performance feel";
  if (themes.includes("premium comfort")) return "comfort, badge appeal, and presence";
  if (themes.includes("easy ownership")) return "lower-stress daily ownership";
  if (themes.includes("overall value")) return "overall value";
  return themes[0] ?? "a narrower niche";
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
  const winnerThemes = winner ? buildComparisonThemes(winner) : [];
  const runnerUpThemes = runnerUp ? buildComparisonThemes(runnerUp) : [];
  const budgetLens = buildBudgetLens(result, winner, runnerUp);
  const winnerName = winner ? formatVariantName(winner) : null;
  const runnerUpName = runnerUp ? formatVariantName(runnerUp) : null;
  const winnerTradeoff = buildTradeoffSentence(winner, "all-round balance");
  const runnerUpTradeoff = buildTradeoffSentence(runnerUp, "a narrower niche");
  const runnerUpAngle = describeAlternativeAngle(runnerUp, runnerUpThemes);
  const assistantMessage = winner
    ? [
        `${winnerName} is the better all-round buy here, especially if you care about ${formatThemeList(winnerThemes)}.`,
        runnerUp
          ? `${runnerUpName} is the more compelling choice if your heart is pulling you toward ${runnerUpAngle}.`
          : null,
        winnerTradeoff ? `${winnerTradeoff}.` : null,
        runnerUpTradeoff && runnerUpName ? `${runnerUpTradeoff}.` : null,
        budgetLens,
      ]
        .filter(Boolean)
        .join(" ")
    : "The comparison ran, but there was not enough grounded data to produce a confident verdict.";

  return buildNarrativeEnvelope({
    title: "AI comparison verdict",
    assistant_message: assistantMessage,
    highlights: [
      winner ? `${winnerName}: stronger ${winnerThemes[0] ?? "all-round balance"}` : null,
      runnerUp ? `${runnerUpName}: more about ${runnerUpThemes[0] ?? "a narrower niche"}` : null,
      budgetLens ?? result?.profile_fit_summary ?? null,
    ].filter(Boolean),
    insight_cards: [
      winner
        ? {
            title: "Best overall",
            value: formatVariantName(winner),
            description:
              winner.pros?.[0] ||
              `Best balanced for ${formatThemeList(winnerThemes)} from the current catalog, pricing, and market signals.`,
          }
        : null,
      runnerUp
        ? {
            title: "Closest alternative",
            value: formatVariantName(runnerUp),
            description:
              runnerUp.pros?.[0] ||
              `Makes the more specific case for ${formatThemeList(runnerUpThemes)} if that matters most to you.`,
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
