"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
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
import { watchlistApi } from "@/lib/carvista-api";
import { apiFetch, hasToken } from "@/lib/api-client";
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

const LISTINGS_PAGE_SIZE = 24;
const SKELETON_KEYS = [
  "listing-skeleton-1",
  "listing-skeleton-2",
  "listing-skeleton-3",
  "listing-skeleton-4",
  "listing-skeleton-5",
  "listing-skeleton-6",
] as const;
type ListingsMode = "browse" | "match";

function parseListingsMode(
  searchParams: URLSearchParams | ReadonlyURLSearchParams
): ListingsMode {
  return searchParams.get("mode") === "match" ? "match" : "browse";
}

function parseSearchFilters(
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  options?: { lockToVariant?: boolean }
): ListingFilterState {
  if (options?.lockToVariant) {
    return {
      ...initialFilters,
      sort: (searchParams.get("sort") as ListingFilterState["sort"]) || initialFilters.sort,
    };
  }

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
  const { openAuth } = useAuthModal();
  const [items, setItems] = useState<Listing[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(true);
  const [savedListingIds, setSavedListingIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<ListingFilterState>(initialFilters);
  const [linkedVariantId, setLinkedVariantId] = useState<number | null>(null);
  const [mode, setMode] = useState<ListingsMode>("browse");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchListings = useCallback(async (params: { status: string; variantId?: number | null }) => {
    const qs = new URLSearchParams();
    qs.set("status", params.status);
    qs.set("limit", "1000");
    if (Number.isFinite(params.variantId)) {
      qs.set("variantId", String(params.variantId));
    }
    return apiFetch<{ items: Listing[]; limit?: number }>(`/listings?${qs.toString()}`);
  }, []);

  const load = useCallback(async (activeVariantId?: number | null) => {
    setLoading(true);
    setMessage("");

    try {
      const savedPromise = hasToken()
        ? watchlistApi.savedListings()
        : Promise.resolve({ items: [] as Array<{ listing_id: number }> });

      const [listings, sessionData] = await Promise.allSettled([
        fetchListings({
          status: "active",
          ...(Number.isFinite(activeVariantId) ? { variantId: Number(activeVariantId) } : {}),
        }),
        savedPromise,
      ]);

      if (listings.status === "fulfilled") {
        setItems(listings.value.items);
        if (Number.isFinite(activeVariantId)) {
          setTone("info");
          setMessage("Showing listings that closely match this vehicle.");
        }
      } else {
        throw listings.reason;
      }

      if (sessionData.status === "fulfilled") {
        setSavedListingIds(sessionData.value.items.map((item) => item.listing_id));
      } else {
        setSavedListingIds([]);
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [fetchListings]);

  const handleSetFilters = useCallback((nextFilters: SetStateAction<ListingFilterState>) => {
    setCurrentPage(1);
    setFilters(nextFilters);
  }, []);

  useEffect(() => {
    const nextMode = parseListingsMode(searchParams);
    const variantId = Number(searchParams.get("variantId"));
    const normalizedVariantId =
      nextMode === "match" && Number.isFinite(variantId) ? variantId : null;

    setMode(normalizedVariantId != null ? nextMode : "browse");
    setLinkedVariantId(normalizedVariantId);
    setFilters(parseSearchFilters(searchParams, { lockToVariant: normalizedVariantId != null }));
    setCurrentPage(1);
    void load(normalizedVariantId);
  }, [load, searchParams]);

  function clearMarketplaceFilters() {
    setFilters(initialFilters);
    setLinkedVariantId(null);
    setMode("browse");
    setCurrentPage(1);
    router.replace("/listings");
    void load(null);
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
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / LISTINGS_PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * LISTINGS_PAGE_SIZE;
    return filteredItems.slice(start, start + LISTINGS_PAGE_SIZE);
  }, [currentPage, filteredItems]);
  const pageWindow = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <>
      <Header />
      <main className="container-cars py-6 sm:py-8">
        <ListingFilters filters={filters} setFilters={handleSetFilters} options={filterOptions} />

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <div className="mt-6">
          <ListingToolbar
            totalCount={items.length}
            filteredCount={filteredItems.length}
            activeFilters={
              mode === "match" && linkedVariantId != null
                ? [...activeFilters, "Exact match"]
                : activeFilters
            }
            onClearFilters={clearMarketplaceFilters}
          />
        </div>

        {loading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {SKELETON_KEYS.map((key) => (
              <ListingCardSkeleton key={key} />
            ))}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={
                linkedVariantId != null
                  ? "No active listings for this vehicle yet"
                  : "No active listings"
              }
              description={
                linkedVariantId != null
                  ? `We couldn't find any active marketplace listings for ${
                      filters.query || "this vehicle"
                    } right now. Try browsing all listings or check back later.`
                  : "There are no active marketplace listings yet. Check back later or browse another search."
              }
            />
            {linkedVariantId != null ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={clearMarketplaceFilters}
                  className="w-full rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white sm:w-auto"
                >
                  Browse all listings
                </button>
              </div>
            ) : null}
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
                className="w-full rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white sm:w-auto"
              >
                Reset marketplace filters
              </button>
            </div>
          </div>
        ) : null}

        {!loading && filteredItems.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedItems.map((item) => (
              <ListingCard
                key={item.listing_id}
                item={item}
                saved={savedListingIds.includes(item.listing_id)}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        ) : null}

        {!loading && filteredItems.length > LISTINGS_PAGE_SIZE ? (
          <div className="mt-8 flex flex-col gap-4 rounded-[28px] border border-cars-primary/10 bg-cars-surface px-4 py-4 sm:px-5 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm text-cars-gray dark:text-slate-300">
              Showing{" "}
              <span className="font-semibold text-cars-primary dark:text-white">
                {(currentPage - 1) * LISTINGS_PAGE_SIZE + 1}-
                {Math.min(currentPage * LISTINGS_PAGE_SIZE, filteredItems.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-cars-primary dark:text-white">
                {filteredItems.length}
              </span>{" "}
              listings
            </p>

            <div className="flex items-center gap-2 sm:hidden">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-cars-primary/15 px-4 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
              >
                Previous
              </button>
              <div className="min-w-[88px] text-center text-sm font-semibold text-cars-primary dark:text-white">
                {currentPage} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-cars-primary/15 px-4 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
              >
                Next
              </button>
            </div>

            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
              >
                Previous
              </button>

              {pageWindow[0] > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    className="h-10 min-w-10 rounded-full border border-cars-primary/15 px-3 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                  >
                    1
                  </button>
                  {pageWindow[0] > 2 ? (
                    <span className="px-1 text-sm text-cars-gray dark:text-slate-400">...</span>
                  ) : null}
                </>
              ) : null}

              {pageWindow.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  aria-current={page === currentPage ? "page" : undefined}
                  className={
                    page === currentPage
                      ? "h-10 min-w-10 rounded-full bg-cars-primary px-3 text-sm font-semibold text-white"
                      : "h-10 min-w-10 rounded-full border border-cars-primary/15 px-3 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                  }
                >
                  {page}
                </button>
              ))}

              {pageWindow[pageWindow.length - 1] < totalPages ? (
                <>
                  {pageWindow[pageWindow.length - 1] < totalPages - 1 ? (
                    <span className="px-1 text-sm text-cars-gray dark:text-slate-400">...</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    className="h-10 min-w-10 rounded-full border border-cars-primary/15 px-3 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                  >
                    {totalPages}
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
              >
                Next
              </button>
            </div>
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
          <main className="container-cars py-6 sm:py-8">
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {SKELETON_KEYS.map((key) => (
                <ListingCardSkeleton key={key} />
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
