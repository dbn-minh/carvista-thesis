"use client";

import { FormEvent, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { listingsApi } from "@/lib/carvista-api";

export default function SellPage() {
  const [variantId, setVariantId] = useState("1");
  const [askingPrice, setAskingPrice] = useState("650000000");
  const [mileageKm, setMileageKm] = useState("32000");
  const [locationCity, setLocationCity] = useState("Ho Chi Minh City");
  const [countryCode, setCountryCode] = useState("VN");
  const [description, setDescription] = useState("Well maintained car.");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await listingsApi.create({
        variant_id: Number(variantId),
        asking_price: Number(askingPrice),
        mileage_km: Number(mileageKm),
        location_city: locationCity,
        location_country_code: countryCode,
        description,
      });
      setTone("success");
      setMessage(`Listing created successfully. listing_id=${res.listing_id}`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Create listing failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container-cars max-w-2xl py-10">
        <h1 className="mb-6 text-3xl font-bold">Sell your car</h1>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">variant_id</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">asking_price</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">mileage_km</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={mileageKm}
              onChange={(e) => setMileageKm(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">location_city</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">location_country_code</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              maxLength={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">description</label>
            <textarea
              className="min-h-[120px] w-full rounded border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            className="rounded bg-purple-800 px-4 py-2 text-white disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Creating..." : "Create listing"}
          </button>

          <StatusBanner tone={tone}>{message}</StatusBanner>
        </form>
      </main>
    </>
  );
}
