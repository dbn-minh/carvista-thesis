"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ListingCard from "@/components/cards/ListingCard";
import EmptyState from "@/components/common/EmptyState";
import StatusBanner from "@/components/common/StatusBanner";
import Header from "@/components/layout/Header";
import ListingCardSkeleton from "@/components/listings/ListingCardSkeleton";
import { listingsApi, watchlistApi } from "@/lib/carvista-api";
import { useRequireLogin } from "@/lib/auth-guard";
import type { Listing } from "@/lib/types";

type SavedSort = "newest" | "price-asc" | "price-desc";

function sortSavedListings(items: Listing[], sort: SavedSort) {
  const copy = [...items];

  copy.sort((left, right) => {
    if (sort === "price-asc") return Number(left.asking_price) - Number(right.asking_price);
    if (sort === "price-desc") return Number(right.asking_price) - Number(left.asking_price);

    return new Date(String(right.created_at || 0)).getTime() - new Date(String(left.created_at || 0)).getTime();
  });

  return copy;
}

export default function GaragePage() {
  const ready = useRequireLogin("/garage");
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SavedSort>("newest");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  if (!ready) return null;

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const saved = await watchlistApi.savedListings();
      const details = await Promise.all(
        saved.items.map(async (item) => {
          try {
            const detail = await listingsApi.detail(item.listing_id);
            const listing: Listing = {
              ...detail.listing,
              images: detail.images
                .map((image) => image.url)
                .filter((image): image is string => typeof image === "string" && image.length > 0),
              image_count: detail.images.length || detail.listing.image_count,
            };

            return listing;
          } catch {
            return null;
          }
        })
      );

      const availableListings = details.filter((item): item is Listing => item !== null);
      const missingCount = saved.items.length - availableListings.length;

      setItems(availableListings);

      if (missingCount > 0) {
        setTone("info");
        setMessage(
          `${missingCount} saved car${missingCount === 1 ? " is" : "s are"} no longer available.`
        );
      }
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error ? error.message : "Could not load your saved cars right now."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function removeSaved(listingId: number) {
    try {
      await watchlistApi.unsaveListing(listingId);
      setItems((prev) => prev.filter((item) => item.listing_id !== listingId));
      setTone("success");
      setMessage("Removed from Saved Cars.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not remove this saved car.");
    }
  }

  const sortedItems = useMemo(() => sortSavedListings(items, sort), [items, sort]);

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Saved cars
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Saved Cars</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Keep the cars you want to revisit, compare later, or contact the seller about.
              </p>
            </div>

            <div className="rounded-[28px] bg-cars-primary p-5 text-white shadow-[0_18px_44px_rgba(15,45,98,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Your shortlist
              </p>
              <p className="mt-2 text-3xl font-apercu-bold">{items.length}</p>
              <p className="mt-1 text-sm text-white/80">
                {items.length === 1 ? "Saved car" : "Saved cars"}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <section className="mt-6 flex flex-col gap-4 rounded-[28px] border border-cars-gray-light/70 bg-white p-5 shadow-[0_18px_40px_rgba(15,45,98,0.06)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
              Saved inventory
            </p>
            <p className="mt-2 text-sm text-cars-gray">
              {loading
                ? "Loading your saved cars..."
                : `${sortedItems.length} saved car${sortedItems.length === 1 ? "" : "s"} ready to review.`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SavedSort)}
              className="h-11 rounded-full border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            >
              <option value="newest">Newest listings</option>
              <option value="price-asc">Price low to high</option>
              <option value="price-desc">Price high to low</option>
            </select>
            <Link
              href="/listings"
              className="inline-flex h-11 items-center justify-center rounded-full border border-cars-primary/15 px-4 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
            >
              Browse listings
            </Link>
          </div>
        </section>

        {loading ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <ListingCardSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {!loading && sortedItems.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No saved cars yet"
              description="Save cars from Listings so you can compare them later."
            />
            <div className="mt-4">
              <Link
                href="/listings"
                className="inline-flex rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
              >
                Browse listings
              </Link>
            </div>
          </div>
        ) : null}

        {!loading && sortedItems.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {sortedItems.map((item) => (
              <ListingCard
                key={item.listing_id}
                item={item}
                saved
                onToggleSave={removeSaved}
              />
            ))}
          </div>
        ) : null}
      </main>
    </>
  );
}
