import { apiFetch } from "./api-client";
import type {
  AiCompareResponse,
  AiPredictResponse,
  AiTcoResponse,
  CatalogOwnershipSummary,
  CarReview,
  ChatResponse,
  Listing,
  ListingDetail,
  Make,
  Model,
  NotificationItem,
  SellerReview,
  User,
  VariantDetail,
  VariantListItem,
  ViewingRequest,
  WatchListingItem,
  WatchVariantItem,
} from "./types";

export const authApi = {
  register(payload: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) {
    return apiFetch<{ user_id: number; email: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return apiFetch<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me() {
    return apiFetch<{ user: User }>("/auth/me");
  },
};

export const catalogApi = {
  makes() {
    return apiFetch<{ items: Make[] }>("/catalog/makes");
  },

  models(makeId?: number) {
    const qs = makeId ? `?makeId=${makeId}` : "";
    return apiFetch<{ items: Model[] }>(`/catalog/models${qs}`);
  },

  variants(params?: {
    q?: string;
    make?: string;
    model?: string;
    year?: number;
    fuel?: string;
    bodyType?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.make) qs.set("make", params.make);
    if (params?.model) qs.set("model", params.model);
    if (params?.year) qs.set("year", String(params.year));
    if (params?.fuel) qs.set("fuel", params.fuel);
    if (params?.bodyType) qs.set("bodyType", params.bodyType);

    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<{ items: VariantListItem[] }>(`/catalog/variants${suffix}`);
  },

  variantDetail(id: number) {
    return apiFetch<VariantDetail>(`/catalog/variants/${id}`);
  },

  variantPriceHistory(id: number, marketId: number, limit = 50) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/catalog/variants/${id}/price-history?marketId=${marketId}&limit=${limit}`
    );
  },

  variantOwnershipSummary(
    id: number,
    params?: {
      marketId?: number;
      ownershipYears?: number;
      kmPerYear?: number;
    }
  ) {
    const qs = new URLSearchParams();
    if (params?.marketId) qs.set("marketId", String(params.marketId));
    if (params?.ownershipYears) qs.set("ownershipYears", String(params.ownershipYears));
    if (params?.kmPerYear) qs.set("kmPerYear", String(params.kmPerYear));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<CatalogOwnershipSummary>(`/catalog/variants/${id}/ownership-summary${suffix}`);
  },
};

export const listingsApi = {
  list(params?: {
    status?: string;
    ownerId?: number;
    variantId?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.ownerId) qs.set("ownerId", String(params.ownerId));
    if (params?.variantId) qs.set("variantId", String(params.variantId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<{ items: Listing[] }>(`/listings${suffix}`);
  },

  detail(id: number) {
    return apiFetch<ListingDetail>(`/listings/${id}`);
  },

  create(
    payload:
      | FormData
      | {
        variant_id?: number;
        asking_price: number;
        mileage_km?: number;
        location_city: string;
        location_country_code: string;
        description?: string;
        status?: "active" | "reserved" | "sold" | "hidden";
        image_urls?: string[];
        custom_vehicle?: {
          make: string;
          model: string;
          year: number;
          trim_name?: string;
          body_type?: string;
          transmission?: string;
          fuel_type?: string;
          drivetrain?: string;
          engine?: string;
          vin?: string;
        };
      }
  ) {
    return apiFetch<{
      listing_id: number;
      variant_id: number;
      custom_vehicle_created: boolean;
      image_count: number;
    }>("/listings", {
      method: "POST",
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    });
  },

  update(
    id: number,
    payload: Partial<{
      asking_price: number;
      mileage_km: number;
      location_city: string;
      location_country_code: string;
      description: string;
      status: "active" | "reserved" | "sold" | "hidden";
    }>
  ) {
    return apiFetch<{ ok: true }>(`/listings/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
};

export const watchlistApi = {
  watchedVariants() {
    return apiFetch<{ items: WatchVariantItem[] }>("/watchlist/variants");
  },

  saveVariant(variantId: number) {
    return apiFetch<{ ok: true }>(`/watchlist/variants/${variantId}`, {
      method: "POST",
    });
  },

  unsaveVariant(variantId: number) {
    return apiFetch<{ ok: true }>(`/watchlist/variants/${variantId}`, {
      method: "DELETE",
    });
  },

  savedListings() {
    return apiFetch<{ items: WatchListingItem[] }>("/watchlist/listings");
  },

  saveListing(listingId: number) {
    return apiFetch<{ ok: true }>(`/watchlist/listings/${listingId}`, {
      method: "POST",
    });
  },

  unsaveListing(listingId: number) {
    return apiFetch<{ ok: true }>(`/watchlist/listings/${listingId}`, {
      method: "DELETE",
    });
  },
};

export const requestsApi = {
  createRequest(
    listingId: number,
    payload: {
      message?: string;
      contact_name?: string;
      contact_email?: string;
      contact_phone?: string;
    }
  ) {
    return apiFetch<{ request_id: number }>(`/listings/${listingId}/requests`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  outbox() {
    return apiFetch<{ items: ViewingRequest[] }>("/requests/outbox");
  },

  inbox() {
    return apiFetch<{ items: ViewingRequest[] }>("/requests/inbox");
  },

  updateStatus(
    requestId: number,
    status: "accepted" | "rejected" | "cancelled"
  ) {
    return apiFetch<{ ok: true }>(`/requests/${requestId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
};

export const notificationsApi = {
  list() {
    return apiFetch<{ items: NotificationItem[] }>("/notifications");
  },

  markRead(id: number) {
    return apiFetch<{ ok: true }>(`/notifications/${id}/read`, {
      method: "PATCH",
    });
  },
};

export const reviewsApi = {
  carReviews(variantId: number) {
    return apiFetch<{ items: CarReview[] }>(`/reviews/cars?variantId=${variantId}`);
  },

  createCarReview(payload: {
    variant_id: number;
    rating: number;
    title?: string;
    comment?: string;
  }) {
    return apiFetch<{ car_review_id: number }>("/reviews/cars", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  sellerReviews(sellerId: number) {
    return apiFetch<{ items: SellerReview[] }>(
      `/reviews/sellers?sellerId=${sellerId}`
    );
  },

  createSellerReview(payload: {
    seller_id: number;
    listing_id?: number;
    rating: number;
    comment?: string;
  }) {
    return apiFetch<{ seller_review_id: number }>("/reviews/sellers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const aiApi = {
  tco(payload: {
    profile_id: number;
    base_price: number;
    ownership_years: number;
    km_per_year?: number;
  }) {
    return apiFetch<AiTcoResponse>("/ai/tco", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  predictPrice(payload: {
    variant_id: number;
    market_id: number;
    price_type?: string;
    horizon_months?: number;
  }) {
    return apiFetch<AiPredictResponse>("/ai/predict-price", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  compare(payload: {
    variant_ids: number[];
    market_id: number;
    price_type?: string;
  }) {
    return apiFetch<AiCompareResponse>("/ai/compare", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  chat(payload: {
    message: string;
    session_id?: number;
    context?: Record<string, unknown>;
  }) {
    return apiFetch<ChatResponse>("/ai/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
