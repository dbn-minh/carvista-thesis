import { Op } from "sequelize";

function buildVehicleSearchQuery(vehicle) {
  return [vehicle?.make_name, vehicle?.model_name, vehicle?.trim_name, vehicle?.model_year]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildCatalogDetailUrl(variantId) {
  return Number.isInteger(variantId) ? `/catalog/${variantId}` : null;
}

function buildRelatedListingsUrl({ variantId, query }) {
  if (Number.isInteger(variantId)) {
    const search = new URLSearchParams({
      mode: "match",
      variantId: String(variantId),
    });
    return `/listings?${search.toString()}`;
  }

  const search = new URLSearchParams();
  if (query) search.set("q", query);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return `/listings${suffix}`;
}

function buildFallbackCatalogUrl(query) {
  if (!query) return "/catalog";
  const search = new URLSearchParams({ q: query });
  return `/catalog?${search.toString()}`;
}

async function loadVariantListingMatches(ctx, variantIds) {
  if (!variantIds.length) return new Map();

  const { Listings } = ctx.models;
  const rows = await Listings.findAll({
    where: {
      variant_id: {
        [Op.in]: variantIds,
      },
      status: "active",
    },
    attributes: ["listing_id", "variant_id", "asking_price", "location_city", "created_at"],
    order: [["created_at", "DESC"]],
    limit: 60,
  });

  const map = new Map();
  for (const row of rows) {
    const listing =
      row && typeof row.toJSON === "function"
        ? row.toJSON()
        : row;
    const existing = map.get(listing.variant_id) || [];
    existing.push(listing);
    map.set(listing.variant_id, existing);
  }

  return map;
}

export async function linkRecommendationTargets(ctx, rankedVehicles = []) {
  const variantIds = rankedVehicles
    .map((vehicle) => Number(vehicle.variant_id))
    .filter((value) => Number.isInteger(value));
  const listingMap = await loadVariantListingMatches(ctx, variantIds);

  return rankedVehicles.map((vehicle) => {
    const variantId = Number(vehicle.variant_id);
    const query = buildVehicleSearchQuery(vehicle);
    const exactListings = Number.isInteger(variantId) ? listingMap.get(variantId) || [] : [];
    const detailPageUrl = buildCatalogDetailUrl(variantId);
    const relatedListingsUrl = buildRelatedListingsUrl({
      variantId,
      query,
    });
    const fallbackSearchUrl = buildFallbackCatalogUrl(query);
    const relatedListingIds = exactListings.slice(0, 6).map((listing) => listing.listing_id);
    const listingCount = exactListings.length;

    return {
      vehicle_id: Number.isInteger(variantId) ? variantId : null,
      display_name: vehicle.name || query || "Recommended vehicle",
      detail_page_url: detailPageUrl,
      related_listings_url: relatedListingsUrl,
      related_listing_ids: relatedListingIds,
      fallback_search_url: fallbackSearchUrl,
      match_confidence: Number.isInteger(variantId) ? (listingCount > 0 ? 0.98 : 0.88) : 0.42,
      match_label:
        Number.isInteger(variantId) && listingCount > 0
          ? "Exact catalog match with active listings"
          : Number.isInteger(variantId)
            ? "Exact catalog match"
            : "Search fallback",
      related_listings_count: listingCount,
    };
  });
}
