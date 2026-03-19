import { buildConfidence } from "./contracts.js";
import { forecastResultSchema } from "./dtos.js";
import { buildInternalSource, loadComparableMarketContext, loadVariantContext } from "./source_retrieval.service.js";

function describeTrend(priceHistory) {
  if (!Array.isArray(priceHistory) || priceHistory.length < 2) return "insufficient local trend data";
  const first = Number(priceHistory[0].price);
  const last = Number(priceHistory[priceHistory.length - 1].price);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return "insufficient local trend data";
  if (last > first * 1.03) return "upward";
  if (last < first * 0.97) return "downward";
  return "stable";
}

export async function analyzeMarketTrend(ctx, { variant_id, market_id = 1, horizon_months = 6 }) {
  const context = await loadVariantContext(ctx, { variant_id, market_id });
  if (!context) throw { status: 404, message: "variant_id not found" };
  const comparable = await loadComparableMarketContext(ctx, { variant: context.variant, market_id, limit: 12 });
  const trend = describeTrend(context.price_history);
  const scarcity = comparable.items.length >= 6 ? "mass-market or well-supplied" : comparable.items.length >= 2 ? "thin market" : "scarcity uncertain";

  return forecastResultSchema.parse({
    intent: "market_trend_analysis",
    vehicle: context.variant.label,
    horizon_months,
    forecast_range: {
      min: null,
      midpoint: null,
      max: null,
      currency: "N/A",
    },
    scarcity_signal: scarcity,
    confidence: buildConfidence(
      comparable.items.length >= 3 ? 0.62 : 0.42,
      [
        "Trend analysis is based on local history depth and comparable-market coverage.",
      ]
    ),
    factors: [
      `Current local trend looks ${trend}.`,
      `${comparable.items.length} comparable variant(s) were found in the same model family.`,
    ],
    assumptions: [
      { label: "Trend analysis here is market-context only and not a full valuation forecast.", type: "verified" },
    ],
    sources: [
      buildInternalSource("Local price-history and comparable-market trend analysis"),
      ...comparable.sources,
    ],
  });
}
