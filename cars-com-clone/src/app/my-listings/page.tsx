"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import EmptyState from "@/components/common/EmptyState";
import { buildListingEyebrow, buildListingTitle, formatLocation } from "@/components/listings/listing-utils";
import { authApi, listingsApi } from "@/lib/carvista-api";
import { toCurrency } from "@/lib/api-client";
import { useRequireLogin } from "@/lib/auth-guard";
import type { Listing, User } from "@/lib/types";

export default function MyListingsPage() {
  const ready = useRequireLogin("/my-listings");
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Listing[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [askingPrice, setAskingPrice] = useState("");
  const [mileageKm, setMileageKm] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [countryCode, setCountryCode] = useState("VN");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  if (!ready) return null;

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const me = await authApi.me();
      setUser(me.user);
      const listings = await listingsApi.list({ ownerId: me.user.user_id });
      setItems(listings.items);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load my listings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(item: Listing) {
    setEditingId(item.listing_id);
    setAskingPrice(String(item.asking_price));
    setMileageKm(String(item.mileage_km ?? ""));
    setLocationCity(item.location_city || "");
    setCountryCode(item.location_country_code || "VN");
    setDescription(item.description || "");
    setStatus(item.status);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    try {
      await listingsApi.update(editingId, {
        asking_price: Number(askingPrice),
        mileage_km: mileageKm ? Number(mileageKm) : undefined,
        location_city: locationCity,
        location_country_code: countryCode,
        description,
        status: status as "active" | "reserved" | "sold" | "hidden",
      });
      setTone("success");
      setMessage("Listing updated.");
      setEditingId(null);
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Seller control
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">My listings</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Update your price, mileage, location, description, and listing status without
                touching the underlying marketplace logic.
              </p>
            </div>

            <div className="rounded-[28px] bg-cars-primary p-5 text-white shadow-[0_18px_44px_rgba(15,45,98,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Account owner
              </p>
              <p className="mt-2 text-2xl font-apercu-bold">{user?.name || "Loading..."}</p>
              <p className="mt-1 text-sm text-white/80">{user?.email || "Fetching account"}</p>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-cars-gray">
            {loading ? "Loading your listings..." : `${items.length} listing${items.length === 1 ? "" : "s"} in your seller account`}
          </p>
          <Link
            href="/sell"
            className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary"
          >
            Create another listing
          </Link>
        </div>

        {!loading && items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No listings created by this user"
              description="Create your first marketplace listing from the Sell page."
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <article key={item.listing_id} className="section-shell p-5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    {buildListingEyebrow(item)}
                  </p>
                  <p className="mt-3 text-2xl font-apercu-bold text-cars-primary">
                    {toCurrency(item.asking_price)}
                  </p>
                  <h2 className="mt-3 text-xl font-apercu-bold text-cars-primary">
                    {buildListingTitle(item)}
                  </h2>
                </div>
                <span className="rounded-full bg-cars-off-white px-3 py-1 font-semibold capitalize text-cars-primary">
                  {item.status}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  Mileage: {item.mileage_km ?? "-"}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  Location: {formatLocation(item.location_city, item.location_country_code)}
                </p>
              </div>

              <p className="mt-5 leading-6 text-cars-gray">
                {item.description || "No seller description yet."}
              </p>
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="mt-5 rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Edit this listing
              </button>
            </article>
          ))}
        </div>

        {editingId ? (
          <section className="section-shell mt-8 p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Edit listing</h2>
            <form onSubmit={saveEdit} className="mt-5 grid gap-4 md:grid-cols-2">
              <input
                className="h-11 rounded-full border border-cars-gray-light px-4 text-sm"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="asking_price"
              />
              <input
                className="h-11 rounded-full border border-cars-gray-light px-4 text-sm"
                value={mileageKm}
                onChange={(e) => setMileageKm(e.target.value)}
                placeholder="mileage_km"
              />
              <input
                className="h-11 rounded-full border border-cars-gray-light px-4 text-sm"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="location_city"
              />
              <input
                className="h-11 rounded-full border border-cars-gray-light px-4 text-sm"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                placeholder="location_country_code"
              />
              <select
                className="h-11 rounded-full border border-cars-gray-light px-4 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">active</option>
                <option value="reserved">reserved</option>
                <option value="sold">sold</option>
                <option value="hidden">hidden</option>
              </select>
              <div />
              <textarea
                className="min-h-[140px] rounded-[24px] border border-cars-gray-light px-4 py-3 text-sm md:col-span-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="description"
              />
              <div className="flex gap-2 md:col-span-2">
                <button
                  className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                  type="submit"
                >
                  Save update
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </>
  );
}
