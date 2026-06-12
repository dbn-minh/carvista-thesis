import { buildCacheKey, deleteByPattern, deleteCache } from "./cache.service.js";

export async function invalidateListingReadCaches({ listingId, variantId } = {}) {
  if (listingId != null) {
    await deleteCache(buildCacheKey("listing:detail", { listing_id: listingId }));
  }

  await deleteByPattern("listing:search:*");

  if (variantId != null) {
    await deleteByPattern(`price:outlook:*variant_id=${variantId}*`);
  }
}

export async function invalidateVariantReadCaches({ variantId } = {}) {
  if (variantId != null) {
    await deleteCache(buildCacheKey("vehicle:detail", { variant_id: variantId }));
    await deleteByPattern(`price:outlook:*variant_id=${variantId}*`);
  }

  await deleteByPattern("catalog:variants:*");
}

export async function invalidateTcoCaches({ marketId } = {}) {
  if (marketId != null) {
    await deleteByPattern(`tco:analysis:*market_id=${marketId}*`);
  } else {
    await deleteByPattern("tco:analysis:*");
  }
}
