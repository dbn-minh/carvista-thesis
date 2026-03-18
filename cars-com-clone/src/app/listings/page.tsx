"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import EmptyState from "@/components/common/EmptyState";
import ListingCard from "@/components/cards/ListingCard";
import { listingsApi, requestsApi, watchlistApi } from "@/lib/carvista-api";
import type { Listing } from "@/lib/types";

export default function ListingsPage() {
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
      const [listings, saved] = await Promise.allSettled([
        listingsApi.list({ status: "active" }),
        watchlistApi.savedListings(),
      ]);

      if (listings.status === "fulfilled") {
        setItems(listings.value.items);
      } else {
        throw listings.reason;
      }

      if (saved.status === "fulfilled") {
        setSavedListingIds(saved.value.items.map((x) => x.listing_id));
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
        <h1 className="mb-6 text-3xl font-bold">Listings</h1>

        <div className="mb-6 max-w-xl rounded-2xl border p-4">
          <label className="mb-1 block text-sm font-medium">
            Default message for viewing request
          </label>
          <input
            className="w-full rounded border px-3 py-2"
            value={requestMessage}
            onChange={onMessageChange}
          />
        </div>

        <div className="mb-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p>Loading listings...</p> : null}

        {!loading && items.length === 0 ? (
          <EmptyState
            title="No active listings"
            description="Tạo listing mới ở trang Sell hoặc kiểm tra seed data backend."
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
