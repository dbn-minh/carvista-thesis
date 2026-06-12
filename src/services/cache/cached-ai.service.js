import { env } from "../../config/env.js";
import { predictPrice } from "../ai/predict_price.service.js";
import { calculateTco } from "../ai/tco.service.js";
import { buildCacheKey, remember } from "./cache.service.js";

export async function predictPriceWithCache(ctx, input, options = {}) {
  const cacheKey = buildCacheKey("price:outlook", {
    variant_id: input?.variant_id,
    market_id: input?.market_id,
    price_type: input?.price_type ?? "avg_market",
    horizon_months: input?.horizon_months ?? 6,
  });

  return remember(
    cacheKey,
    env.redis.priceOutlookTtlSeconds,
    async () => predictPrice(ctx, input),
    options
  );
}

export async function calculateTcoWithCache(ctx, input, options = {}) {
  const cacheKey = buildCacheKey("tco:analysis", {
    profile_id: input?.profile_id,
    market_id: input?.market_id,
    variant_id: input?.variant_id,
    base_price: input?.base_price,
    ownership_years: input?.ownership_years,
    km_per_year: input?.km_per_year,
    energy_cost_per_year: input?.energy_cost_per_year,
  });

  return remember(
    cacheKey,
    env.redis.tcoTtlSeconds,
    async () => calculateTco(ctx, input),
    options
  );
}
