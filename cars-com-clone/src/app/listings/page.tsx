"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import EmptyState from "@/components/common/EmptyState";
import ListingCard from "@/components/cards/ListingCard";
import { listingsApi, requestsApi, watchlistApi } from "@/lib/carvista-api";
import { hasToken } from "@/lib/api-client";
import type { Listing } from "@/lib/types";

export default function ListingsPage() {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [items, setItems] = useState<Listing[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(true);
  const [requestMessage, setRequestMessage] = useState("I want to view this car.");
  const [savedListingIds, setSavedListingIds] = useState<number[]>([]);

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const savedPromise = hasToken()
        ? watchlistApi.savedListings()
        : Promise.resolve({ items: [] as Array<{ listing_id: number }> });

      const [listings, saved] = await Promise.allSettled([
        listingsApi.list({ status: "active" }),
        savedPromise,
      ]);

      if (listings.status === "fulfilled") {
        setItems(listings.value.items);
      } else {
        throw listings.reason;
      }

      if (saved.status === "fulfilled") {
        setSavedListingIds(saved.value.items.map((x) => x.listing_id));
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
    load();
  }, []);

  async function sendRequest(listingId: number) {
    if (!hasToken()) {
      openAuth({ mode: "login", next: "/listings" });
      return;
    }

    try {
      await requestsApi.createRequest(listingId, { message: requestMessage });
      setTone("success");
      setMessage(`Viewing request created for listing ${listingId}.`);
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
        setMessage(`Listing ${listingId} removed from saved list.`);
      } else {
        await watchlistApi.saveListing(listingId);
        setSavedListingIds((prev) => [...prev, listingId]);
        setTone("success");
        setMessage(`Listing ${listingId} saved.`);
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  function onMessageChange(e: ChangeEvent<HTMLInputElement>) {
    setRequestMessage(e.target.value);
  }

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Marketplace inventory
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Listings</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Browse active seller listings, save promising cars, and send viewing requests
                after authentication. The listing logic stays unchanged; this refactor only
                upgrades the buying experience around it.
              </p>
            </div>

            <div className="rounded-[28px] bg-cars-primary p-5 text-white shadow-[0_18px_44px_rgba(15,45,98,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Buyer actions
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-white/85">
                <li>Open any listing detail without logging in.</li>
                <li>Save listings and request viewings after login.</li>
                <li>Use Garage to monitor requests and notifications.</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl rounded-[24px] bg-white p-4 shadow-[0_16px_34px_rgba(15,45,98,0.08)]">
              <label className="mb-1 block text-sm font-semibold text-cars-primary">
                Default message for viewing requests
              </label>
              <input
                className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm text-cars-primary"
                value={requestMessage}
                onChange={onMessageChange}
              />
            </div>

            {!hasToken() ? (
              <button
                type="button"
                onClick={() => openAuth({ mode: "login", next: "/listings" })}
                className="rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Login to save and request
              </button>
            ) : null}
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p className="mt-6 text-sm text-cars-gray">Loading listings...</p> : null}

        {!loading && items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No active listings"
              description="Create a listing from Sell or check the current seed data in the backend."
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ListingCard
              key={item.listing_id}
              item={item}
              saved={savedListingIds.includes(item.listing_id)}
              onRequest={sendRequest}
              onToggleSave={toggleSave}
            />
          ))}
        </div>
      </main>
    </>
  );
}
