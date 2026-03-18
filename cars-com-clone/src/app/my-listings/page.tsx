"use client";

import { FormEvent, useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import EmptyState from "@/components/common/EmptyState";
import { authApi, listingsApi } from "@/lib/carvista-api";
import { toCurrency } from "@/lib/api-client";
import type { Listing, User } from "@/lib/types";

export default function MyListingsPage() {
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
      setMessage(`Listing ${editingId} updated.`);
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
        <h1 className="mb-2 text-3xl font-bold">My listings</h1>
        <p className="mb-6 text-sm text-slate-600">
          Use page này để sửa price / mileage / description / status cho listing của chính bạn.
        </p>
        <div className="mb-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <section className="mb-8 rounded-2xl border p-4 text-sm">
          <p><span className="font-medium">Current user:</span> {user?.name || "-"}</p>
          <p><span className="font-medium">user_id:</span> {user?.user_id || "-"}</p>
        </section>

        {loading ? <p>Loading your listings...</p> : null}

        {!loading && items.length === 0 ? (
          <EmptyState
            title="No listings created by this user"
            description="Tạo listing ở trang Sell trước rồi quay lại đây để edit."
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <article key={item.listing_id} className="rounded-2xl border p-4 text-sm">
              <p className="text-slate-500">listing_id: {item.listing_id}</p>
              <p className="mt-2 font-medium">Price: {toCurrency(item.asking_price)}</p>
              <p className="mt-1">Status: {item.status}</p>
              <p className="mt-1">Mileage: {item.mileage_km ?? "-"}</p>
              <p className="mt-1">Location: {item.location_city || "-"} / {item.location_country_code || "-"}</p>
              <p className="mt-2">{item.description || "No description"}</p>
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="mt-4 rounded border px-3 py-2"
              >
                Edit this listing
              </button>
            </article>
          ))}
        </div>

        {editingId ? (
          <section className="mt-8 rounded-2xl border p-6">
            <h2 className="mb-4 text-xl font-semibold">Edit listing #{editingId}</h2>
            <form onSubmit={saveEdit} className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded border px-3 py-2"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="asking_price"
              />
              <input
                className="rounded border px-3 py-2"
                value={mileageKm}
                onChange={(e) => setMileageKm(e.target.value)}
                placeholder="mileage_km"
              />
              <input
                className="rounded border px-3 py-2"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="location_city"
              />
              <input
                className="rounded border px-3 py-2"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                placeholder="location_country_code"
              />
              <select
                className="rounded border px-3 py-2"
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
                className="min-h-[120px] rounded border px-3 py-2 md:col-span-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="description"
              />
              <div className="flex gap-2 md:col-span-2">
                <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
                  Save update
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded border px-4 py-2"
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
