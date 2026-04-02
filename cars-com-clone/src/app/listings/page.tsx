"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import ListingCard from "@/components/cards/ListingCard";
import EmptyState from "@/components/common/EmptyState";
import StatusBanner from "@/components/common/StatusBanner";
import ListingCardSkeleton from "@/components/listings/ListingCardSkeleton";
import ListingFilters from "@/components/listings/ListingFilters";
import ListingToolbar from "@/components/listings/ListingToolbar";
import {
  applyListingFilters,
  buildActiveListingFilters,
  buildListingFilterOptions,
  sortListings,
  type ListingFilterState,
} from "@/components/listings/listing-utils";
import Header from "@/components/layout/Header";
import { listingsApi, requestsApi, watchlistApi } from "@/lib/carvista-api";
import { hasToken } from "@/lib/api-client";
import type { Listing } from "@/lib/types";

const initialFilters: ListingFilterState = {
  query: "",
  minPrice: "",
  maxPrice: "",
  make: "",
  bodyType: "",
  year: "",
  maxMileage: "",
  transmission: "",
  fuelType: "",
  location: "",
  sort: "newest",
};

function parseSearchFilters(searchParams: URLSearchParams | ReadonlyURLSearchParams): ListingFilterState {
  return {
    query: searchParams.get("query") || searchParams.get("q") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    make: searchParams.get("make") || "",
    bodyType: searchParams.get("bodyType") || "",
    year: searchParams.get("year") || "",
    maxMileage: searchParams.get("maxMileage") || "",
    transmission: searchParams.get("transmission") || "",
    fuelType: searchParams.get("fuelType") || searchParams.get("fuel") || "",
    location: searchParams.get("location") || "",
    sort: (searchParams.get("sort") as ListingFilterState["sort"]) || initialFilters.sort,
  };
}

function ListingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { openAuth } = useAuthModal();
  const [items, setItems] = useState<Listing[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(true);
  const [requestMessage, setRequestMessage] = useState("Hi, I'd like to schedule a viewing for this car.");
  const [savedListingIds, setSavedListingIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<ListingFilterState>(initialFilters);
  const [linkedVariantId, setLinkedVariantId] = useState<number | null>(null);

  async function load(activeVariantId?: number | null) {
    setLoading(true);
    setMessage("");

    try {
      const savedPromise = hasToken()
        ? watchlistApi.savedListings()
        : Promise.resolve({ items: [] as Array<{ listing_id: number }> });

      const [listings, saved] = await Promise.allSettled([
        listingsApi.list({
          status: "active",
          ...(Number.isFinite(activeVariantId) ? { variantId: Number(activeVariantId) } : {}),
        }),
        savedPromise,
      ]);

      if (listings.status === "fulfilled") {
        setItems(listings.value.items);
        if (Number.isFinite(activeVariantId)) {
          setTone("info");
          setMessage("Showing listings related to the vehicle recommended by CarVista AI.");
        }
      } else {
        throw listings.reason;
      }

      if (saved.status === "fulfilled") {
        setSavedListingIds(saved.value.items.map((item) => item.listing_id));
      } else {
        setSavedListingIds([]);
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const variantId = Number(searchParams.get("variantId"));
    const normalizedVariantId = Number.isFinite(variantId) ? variantId : null;
    setLinkedVariantId(normalizedVariantId);
    setFilters(parseSearchFilters(searchParams));
    void load(normalizedVariantId);
  }, [searchKey]);

  function clearMarketplaceFilters() {
    setFilters(initialFilters);
    setLinkedVariantId(null);
    router.replace("/listings");
    void load(null);
  }

  async function sendRequest(listingId: number) {
    if (!hasToken()) {
      openAuth({ mode: "login", next: "/listings" });
      return;
    }

    try {
      await requestsApi.createRequest(listingId, {
        message: requestMessage.trim() || "Hi, I'd like to schedule a viewing for this car.",
      });
      setTone("success");
      setMessage(
        "Viewing request sent successfully. The seller can review your request and may contact you using your account details."
      );
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  async function toggleSave(listingId: number) {
    if (!hasToken()) {
      openAuth({ mode: "login", next: "/listings" });
      return;
    }

    try {
      if (savedListingIds.includes(listingId)) {
        await watchlistApi.unsaveListing(listingId);
        setSavedListingIds((prev) => prev.filter((id) => id !== listingId));
        setTone("success");
        setMessage("Listing removed from your saved cars.");
      } else {
        await watchlistApi.saveListing(listingId);
        setSavedListingIds((prev) => [...prev, listingId]);
        setTone("success");
        setMessage("Listing saved to Saved Cars.");
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  const filterOptions = useMemo(() => buildListingFilterOptions(items), [items]);
  const activeFilters = useMemo(() => buildActiveListingFilters(filters), [filters]);
  const filteredItems = useMemo(
    () => sortListings(applyListingFilters(items, filters), filters.sort),
    [items, filters]
  );

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <ListingFilters
          filters={filters}
          setFilters={setFilters}
          options={filterOptions}
          requestMessage={requestMessage}
          setRequestMessage={setRequestMessage}
        />

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <div className="mt-6">
          <ListingToolbar
            totalCount={items.length}
            filteredCount={filteredItems.length}
            activeFilters={
              linkedVariantId != null
                ? [...activeFilters, "Recommended match"]
                : activeFilters
            }
            onClearFilters={clearMarketplaceFilters}
          />
        </div>

        {loading ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ListingCardSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No active listings"
              description="Create a listing from Sell or seed more marketplace cars in the backend."
            />
          </div>
        ) : null}

        {!loading && items.length > 0 && filteredItems.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No listings match these filters"
              description="Try widening the price range, clearing a few filters, or using a broader keyword."
            />
            <div className="mt-4">
              <button
                type="button"
                onClick={clearMarketplaceFilters}
                className="rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                Reset marketplace filters
              </button>
            </div>
          </div>
        ) : null}

        {!loading && filteredItems.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredItems.map((item) => (
              <ListingCard
                key={item.listing_id}
                item={item}
                saved={savedListingIds.includes(item.listing_id)}
                onRequest={sendRequest}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        ) : null}
      </main>
    </>
  );
}

export default function ListingsPage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="container-cars py-8">
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <ListingCardSkeleton key={index} />
              ))}
            </div>
          </main>
        </>
      }
    >
      <ListingsPageContent />
    </Suspense>
  );
}
