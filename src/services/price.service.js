import { env } from "../config/env.js";
import { processPriceDropAlertNotification } from "./notifications/notification-job.service.js";
import { enqueueNotificationJob } from "./queue/queue.service.js";

export async function addVariantPricePoint(ctx, { variantId, marketId, price, capturedAt, source = "manual" }) {
  const { VariantPriceHistory, WatchedVariants } = ctx.models;

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
      if (watchers.length > 0) {
        const queueResult = await enqueueNotificationJob(
          "priceDropAlert",
          {
            variantId,
            pricePointId: created.price_id,
            dropRatio: drop,
            newPrice: price,
          },
          {
            jobId: `price-drop-alert:${variantId}:${created.price_id}`,
          }
        );

        if (!queueResult.queued) {
          await processPriceDropAlertNotification(ctx, {
            variantId,
            pricePointId: created.price_id,
            dropRatio: drop,
            newPrice: price,
          }).catch((error) => {
            console.warn("[price] price-drop fallback notification failed", {
              variantId,
              priceId: created.price_id,
              message: error?.message || String(error),
            });
          });
        }
      }
    }
  }

  return created;
}
