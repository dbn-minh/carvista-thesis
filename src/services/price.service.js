import { env } from "../config/env.js";
import { createNotification } from "./notify.service.js";

export async function addVariantPricePoint(ctx, { variantId, marketId, price, capturedAt, source = "manual" }) {
  const { VariantPriceHistory, WatchedVariants, Notifications } = ctx.models;

  // get latest price
  const latest = await VariantPriceHistory.findOne({
    where: { variant_id: variantId, market_id: marketId },
    order: [["captured_at", "DESC"]],
  });

  const created = await VariantPriceHistory.create({
    variant_id: variantId,
    market_id: marketId,
    price_type: "avg_market",
    price,
    captured_at: capturedAt,
    source,
  });

  // price drop alert
  if (latest?.price && price < latest.price) {
    const drop = (latest.price - price) / latest.price;
    if (drop >= env.priceDropThreshold) {
      const watchers = await WatchedVariants.findAll({ where: { variant_id: variantId } });
      for (const w of watchers) {
        await createNotification(
          { Notifications },
          w.user_id,
          "price_alert",
          created.price_id,
          "Price drop alert",
          `A watched variant dropped by ${(drop * 100).toFixed(1)}%. New price: ${price}.`
        );
      }
    }
  }

  return created;
}