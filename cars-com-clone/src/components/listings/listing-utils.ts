import { toCurrency } from "@/lib/api-client";
import type { Listing } from "@/lib/types";

export type ListingSortOption =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "mileage-asc";

export type ListingFilterState = {
  query: string;
  minPrice: string;
  maxPrice: string;
  make: string;
  bodyType: string;
  year: string;
  maxMileage: string;
  transmission: string;
  fuelType: string;
  location: string;
  sort: ListingSortOption;
};

export type ListingFilterOptions = {
  makes: string[];
  bodyTypes: string[];
  years: number[];
  transmissions: string[];
  fuelTypes: string[];
  locations: string[];
};

export function buildListingTitle(item: Listing): string {
  if (item.title) return item.title;

  const base = [item.make_name, item.model_name, item.trim_name].filter(Boolean).join(" ").trim();
  if (base) return base;
  if (item.variant_id) return `Variant #${item.variant_id}`;
  return `Listing #${item.listing_id}`;
}

export function buildListingMetaTitle(item: Listing): string {
  const title = buildListingTitle(item);
  return item.model_year ? `${title} ${item.model_year}` : title;
}

export function getListingImages(item: Listing): string[] {
  if (Array.isArray(item.images) && item.images.length > 0) {
    return item.images.filter((image): image is string => typeof image === "string" && image.length > 0);
  }

  const fallback = [item.cover_image, item.thumbnail].filter(
    (image): image is string => typeof image === "string" && image.length > 0
  );

  return Array.from(new Set(fallback));
}

export function formatListingPrice(value: unknown): string {
  const formatted = toCurrency(value);
  return formatted === "-" ? formatted : `${formatted} VND`;
}

export function formatMileage(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return "Mileage not listed";
  return `${toCurrency(Number(value))} km`;
}

export function formatTransmission(value: string | null | undefined): string {
  return formatLabel(value, "Transmission pending");
}

export function formatFuelType(value: string | null | undefined): string {
  return formatLabel(value, "Fuel pending");
}

export function formatBodyType(value: string | null | undefined): string {
  return formatLabel(value, "Body pending");
}

export function formatLocation(city?: string | null, countryCode?: string | null): string {
  if (city && countryCode) return `${city}, ${countryCode}`;
  if (city) return city;
  if (countryCode) return countryCode;
  return "Location pending";
}

export function formatPhotoSource(source?: Listing["photo_source"]): string | null {
  if (source === "listing") return "Seller photos";
  if (source === "catalog") return "Catalog photos";
  return null;
}

export function formatLabel(value: string | null | undefined, fallback = "Not listed"): string {
  if (!value) return fallback;

  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function hasActiveListingFilters(filters: ListingFilterState): boolean {
  return Object.entries(filters).some(([key, value]) => key !== "sort" && value.trim().length > 0);
}

export function buildActiveListingFilters(filters: ListingFilterState): string[] {
  const summary: string[] = [];

  if (filters.query.trim()) summary.push(`Search: ${filters.query.trim()}`);
  if (filters.make) summary.push(`Brand: ${filters.make}`);
  if (filters.bodyType) summary.push(`Body: ${formatBodyType(filters.bodyType)}`);
  if (filters.year) summary.push(`Year: ${filters.year}`);
  if (filters.fuelType) summary.push(`Fuel: ${formatFuelType(filters.fuelType)}`);
  if (filters.transmission) {
    summary.push(`Transmission: ${formatTransmission(filters.transmission)}`);
  }
  if (filters.location) summary.push(`Location: ${filters.location}`);
  if (filters.minPrice || filters.maxPrice) {
    const min = filters.minPrice ? toCurrency(Number(filters.minPrice)) : "Any";
    const max = filters.maxPrice ? toCurrency(Number(filters.maxPrice)) : "Any";
    summary.push(`Price: ${min} - ${max}`);
  }
  if (filters.maxMileage) {
    summary.push(`Mileage under ${toCurrency(Number(filters.maxMileage))} km`);
  }

  return summary;
}

export function buildListingFilterOptions(items: Listing[]): ListingFilterOptions {
  return {
    makes: uniqueSortedStrings(items.map((item) => item.make_name)),
    bodyTypes: uniqueSortedStrings(items.map((item) => item.body_type)),
    years: Array.from(
      new Set(
        items
          .map((item) => item.model_year)
          .filter((value): value is number => Number.isFinite(Number(value)))
      )
    ).sort((a, b) => b - a),
    transmissions: uniqueSortedStrings(items.map((item) => item.transmission)),
    fuelTypes: uniqueSortedStrings(items.map((item) => item.fuel_type)),
    locations: uniqueSortedStrings(items.map((item) => item.location_city)),
  };
}

export function applyListingFilters(
  items: Listing[],
  filters: ListingFilterState
): Listing[] {
  const query = filters.query.trim().toLowerCase();
  const minPrice = parsePositiveNumber(filters.minPrice);
  const maxPrice = parsePositiveNumber(filters.maxPrice);
  const maxMileage = parsePositiveNumber(filters.maxMileage);

  return items.filter((item) => {
    if (query) {
      const haystack = [
        buildListingTitle(item),
        item.model_year ? String(item.model_year) : "",
        item.make_name,
        item.model_name,
        item.trim_name,
        item.location_city,
        item.location_country_code,
        item.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    if (filters.make && item.make_name !== filters.make) return false;
    if (filters.bodyType && item.body_type !== filters.bodyType) return false;
    if (filters.year && String(item.model_year ?? "") !== filters.year) return false;
    if (filters.transmission && item.transmission !== filters.transmission) return false;
    if (filters.fuelType && item.fuel_type !== filters.fuelType) return false;
    if (filters.location && item.location_city !== filters.location) return false;
    if (minPrice != null && Number(item.asking_price) < minPrice) return false;
    if (maxPrice != null && Number(item.asking_price) > maxPrice) return false;
    if (maxMileage != null && Number(item.mileage_km ?? Number.MAX_SAFE_INTEGER) > maxMileage) {
      return false;
    }

    return true;
  });
}

export function sortListings(items: Listing[], sort: ListingSortOption): Listing[] {
  const copy = [...items];

  copy.sort((left, right) => {
    if (sort === "price-asc") return Number(left.asking_price) - Number(right.asking_price);
    if (sort === "price-desc") return Number(right.asking_price) - Number(left.asking_price);
    if (sort === "mileage-asc") {
      return Number(left.mileage_km ?? Number.MAX_SAFE_INTEGER) - Number(
        right.mileage_km ?? Number.MAX_SAFE_INTEGER
      );
    }

    return new Date(String(right.created_at || 0)).getTime() - new Date(String(left.created_at || 0)).getTime();
  });

  return copy;
}

function uniqueSortedStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function parsePositiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
}
