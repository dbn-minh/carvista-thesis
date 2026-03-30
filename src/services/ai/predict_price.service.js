import { clamp, roundMoney } from "./_helpers.js";
import { buildConfidence, buildEvidence } from "./contracts.js";
import { buildPredictPresentation } from "./presentation.service.js";
import {
  buildInternalSource,
  fetchOfficialVehicleSignals,
  loadComparableMarketContext,
  loadListingMarketSignals,
  loadVariantContext,
} from "./source_retrieval.service.js";

function linearRegression(xs, ys) {
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = ys.reduce((a, _, index) => a + xs[index] * ys[index], 0);
  const denom = n * sxx - sx * sx;
  const slope = denom ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

function computeVolatility(prices) {
  if (prices.length < 3) return null;
  const returns = [];
  for (let index = 1; index < prices.length; index += 1) {
    const prev = prices[index - 1];
    const next = prices[index];
    if (prev > 0) returns.push((next - prev) / prev);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance);
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function currentModelYear() {
  return new Date().getUTCFullYear();
}

function computeAnnualDepreciationRate(variant) {
  const modelYear = Number(variant?.model_year);
  const age = Number.isFinite(modelYear) ? Math.max(0, currentModelYear() - modelYear) : 3;
  let rate = age <= 1 ? 0.12 : age <= 3 ? 0.1 : age <= 5 ? 0.08 : 0.07;

  if (variant?.fuel_type === "ev") rate += 0.02;
  if (variant?.fuel_type === "hybrid" || variant?.fuel_type === "phev") rate -= 0.005;
  if (["pickup", "suv", "mpv"].includes(variant?.body_type)) rate -= 0.01;

  return clamp(rate, 0.05, 0.16);
}

function classifyScarcity(comparableCount) {
  if (comparableCount >= 6) return "mass-market or well-supplied";
  if (comparableCount >= 3) return "moderately supplied niche";
  if (comparableCount >= 1) return "thin market / harder to read";
  return "scarcity uncertain";
}

function buildPriceRange(anchorPrice, volatility, confidenceScore, currency) {
  if (!Number.isFinite(anchorPrice)) {
    return {
      fair_value_estimate: null,
      fair_value_min: null,
      fair_value_max: null,
    };
  }

  const spread = clamp((volatility ?? 0.08) + (1 - confidenceScore) * 0.15, 0.08, 0.28);
  return {
    fair_value_estimate: roundMoney(anchorPrice, currency),
    fair_value_min: roundMoney(anchorPrice * (1 - spread), currency),
    fair_value_max: roundMoney(anchorPrice * (1 + spread), currency),
  };
}

export async function predictPrice(ctx, input) {
  const variant_id = Number(input?.variant_id);
  const market_id = Number(input?.market_id);
  const price_type = input?.price_type ?? "avg_market";
  const horizon_months = input?.horizon_months == null ? 6 : Number(input.horizon_months);

  if (!Number.isInteger(variant_id)) throw { status: 400, message: "variant_id must be integer" };
  if (!Number.isInteger(market_id)) throw { status: 400, message: "market_id must be integer" };
  if (!Number.isInteger(horizon_months) || horizon_months < 1 || horizon_months > 24) {
    throw { status: 400, message: "horizon_months must be 1..24" };
  }

  const { Markets } = ctx.models;
  const market = await Markets.findByPk(market_id);
  const currency = market?.currency_code ?? "USD";

  const context = await loadVariantContext(ctx, { variant_id, market_id });
  if (!context) throw { status: 404, message: "variant_id not found" };

  const comparableContext = await loadComparableMarketContext(ctx, {
    variant: context.variant,
    market_id,
    limit: 10,
  });
  const listingSignals = await loadListingMarketSignals(ctx, {
    variant_id,
    market_id,
    limit: 20,
  });
  const officialSignals = await fetchOfficialVehicleSignals({
    ctx,
    variant_id,
    year: context.variant.model_year,
    make: context.variant.make_name,
    model: context.variant.model_name,
  });

  const priceSeries = context.price_history.map((row) => Number(row.price)).filter((value) => Number.isFinite(value));
  const history_points = priceSeries.length;
  const last_price = priceSeries.length ? priceSeries[priceSeries.length - 1] : Number(context.variant.latest_price ?? context.variant.msrp_base);

  const comparablePrices = comparableContext.items
    .map((item) => Number(item.latest_price ?? item.msrp_base))
    .filter((value) => Number.isFinite(value));
  const comparableAverage = average(comparablePrices);
  const liveListingAverage = Number(listingSignals.average_asking_price);
  const comparableRatios = comparableContext.items
    .map((item) => {
      const latestPrice = Number(item.latest_price);
      const msrpBase = Number(item.msrp_base);
      if (!Number.isFinite(latestPrice) || !Number.isFinite(msrpBase) || msrpBase <= 0) return null;
      return latestPrice / msrpBase;
    })
    .filter((value) => value != null);
  const comparableRetention = average(comparableRatios);

  const annualRate = computeAnnualDepreciationRate(context.variant);
  const monthlyRate = annualRate / 12;
  const volatility = computeVolatility(priceSeries) ?? 0.08;
  const anchorCandidates = [
    Number.isFinite(last_price) ? { weight: history_points >= 4 ? 0.48 : 0.24, value: last_price } : null,
    Number.isFinite(liveListingAverage) ? { weight: 0.28, value: liveListingAverage } : null,
    Number.isFinite(comparableAverage) ? { weight: 0.18, value: comparableAverage } : null,
    Number.isFinite(comparableRetention) && Number(context.variant.msrp_base) > 0
      ? { weight: 0.16, value: Number(context.variant.msrp_base) * comparableRetention }
      : null,
  ].filter(Boolean);
  const priceAnchor =
    anchorCandidates.length > 0
      ? anchorCandidates.reduce((sum, candidate) => sum + candidate.value * candidate.weight, 0) /
        anchorCandidates.reduce((sum, candidate) => sum + candidate.weight, 0)
      : null;

  let predictedRaw = priceAnchor;
  let trendSlope = null;
  let predictionMode = "limited_history_fallback";

  if (history_points >= 8) {
    const window = priceSeries.slice(-12);
    const xs = window.map((_, index) => index);
    const regression = linearRegression(xs, window);
    trendSlope = regression.slope;
    predictedRaw = window[window.length - 1] + regression.slope * horizon_months;
    predictionMode = "history_regression";
  } else if (Number.isFinite(priceAnchor)) {
    predictedRaw = priceAnchor * Math.pow(1 - monthlyRate, horizon_months);
    trendSlope = -(priceAnchor * monthlyRate);
  }

  const predicted_price = Number.isFinite(predictedRaw) ? Math.max(0, predictedRaw) : null;
  const predicted_min = predicted_price != null ? Math.max(0, predicted_price * (1 - volatility)) : null;
  const predicted_max = predicted_price != null ? Math.max(predicted_price, predicted_price * (1 + volatility)) : null;

  let confidenceScore = 0.28;
  if (history_points >= 8) confidenceScore += 0.28;
  else if (history_points >= 4) confidenceScore += 0.16;
  if (comparablePrices.length >= 3) confidenceScore += 0.18;
  if (listingSignals.item_count >= 3) confidenceScore += 0.14;
  else if (listingSignals.item_count >= 1) confidenceScore += 0.08;
  if (officialSignals.sources.length > 0) confidenceScore += 0.08;
  if (context.variant.latest_price != null) confidenceScore += 0.1;
  confidenceScore = clamp(confidenceScore, 0.2, 0.9);

  const fairValue = buildPriceRange(priceAnchor, volatility, confidenceScore, currency);
  const primaryDriver =
    history_points >= 8
      ? "Strongest signal comes from the vehicle's own local market history."
      : listingSignals.item_count >= 3
        ? "Strongest signal comes from live marketplace asking prices blended with local retention signals."
      : comparablePrices.length >= 3
        ? "Strongest signal comes from comparable local variants plus retention heuristics."
        : "Strongest signal comes from MSRP anchoring and age-based depreciation heuristics.";

  const scarcitySignal = classifyScarcity(comparableContext.items.length);

  const result = {
    variant_id,
    market_id,
    currency,
    price_type,
    history_points,
    last_price: roundMoney(last_price, currency),
    horizon_months,
    predicted_price: roundMoney(predicted_price, currency),
    predicted_min: roundMoney(predicted_min, currency),
    predicted_max: roundMoney(predicted_max, currency),
    trend_slope: trendSlope,
    volatility,
    confidence_score: confidenceScore,
    confidence: buildConfidence(confidenceScore, [
      history_points >= 8 ? "This variant has a usable local market-history window." : "The variant's own history is limited, so fallback logic was required.",
      comparablePrices.length >= 3 ? "Comparable vehicles exist in the same model family." : "Comparable market coverage is thin.",
      officialSignals.sources.length > 0 ? "Official external context was available for enrichment." : "Official external enrichment was limited.",
    ]),
    prediction_mode: predictionMode,
    notes: predictionMode === "history_regression" ? "forecast_mode=history_regression" : "forecast_mode=fallback_blend",
    fair_value_estimate: fairValue.fair_value_estimate,
    fair_value_min: fairValue.fair_value_min,
    fair_value_max: fairValue.fair_value_max,
    primary_driver: primaryDriver,
    scarcity_signal: scarcitySignal,
    key_factors: [
      history_points >= 8 ? "Own-market history" : null,
      comparablePrices.length >= 3 ? "Comparable local variants" : null,
      listingSignals.item_count >= 1 ? "Live marketplace asking prices" : null,
      officialSignals.fuel_economy?.combined_mpg != null ? "Official efficiency context" : null,
      officialSignals.recalls.length > 0 ? "Official recall context" : null,
    ].filter(Boolean),
    evidence: buildEvidence({
      verified: [
        "The vehicle identity and price history are grounded to the local database.",
        comparablePrices.length ? "Comparable local market signals were found." : null,
        listingSignals.item_count ? "Active marketplace listing prices were folded into the estimate." : null,
        officialSignals.sources.length ? "Official external automotive data was used for enrichment." : null,
      ].filter(Boolean),
      inferred: [
        "Future value direction is inferred from recent history, comparable retention, and age-based depreciation.",
        `Scarcity was classified as ${scarcitySignal} based on comparable market depth, not claimed production totals.`,
      ],
      estimated: [
        "Forecast price is an estimate rather than a guaranteed resale outcome.",
        history_points < 8 ? "Fallback valuation was used because the local history was not deep enough." : null,
      ].filter(Boolean),
    }),
    sources: [
      buildInternalSource("Local market history and catalog valuation inputs"),
      ...listingSignals.sources,
      ...comparableContext.sources,
      ...officialSignals.sources,
    ],
    caveats: [
      "Mileage, condition, accident history, and ownership count were not modeled because those fields are not currently available in the local dataset.",
      listingSignals.item_count === 0 ? "No live marketplace listing prices were available for this exact variant in the selected market." : null,
      ...officialSignals.caveats,
    ].filter(Boolean),
    live_market_snapshot: {
      active_listing_count: listingSignals.item_count,
      average_asking_price: roundMoney(liveListingAverage, currency),
      min_asking_price: roundMoney(listingSignals.min_asking_price, currency),
      max_asking_price: roundMoney(listingSignals.max_asking_price, currency),
    },
  };

  return {
    ...result,
    ...buildPredictPresentation(result),
  };
}
