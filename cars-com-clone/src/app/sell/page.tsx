"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { listingsApi } from "@/lib/carvista-api";
import { useRequireLogin } from "@/lib/auth-guard";

export default function SellPage() {
  const ready = useRequireLogin("/sell");
  const [variantId, setVariantId] = useState("1");
  const [askingPrice, setAskingPrice] = useState("650000000");
  const [mileageKm, setMileageKm] = useState("32000");
  const [locationCity, setLocationCity] = useState("Ho Chi Minh City");
  const [countryCode, setCountryCode] = useState("VN");
  const [description, setDescription] = useState("Well maintained car.");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  if (!ready) return null;

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
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Seller workflow
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Sell your car</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Create a listing tied to an existing catalog variant, publish it to the current
                marketplace flow, and manage follow-up actions later from My Listings and Garage.
              </p>
            </div>

            <div className="rounded-[28px] bg-cars-primary p-5 text-white shadow-[0_18px_44px_rgba(15,45,98,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Before you publish
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-white/85">
                <li>Pick the correct variant ID from Catalog.</li>
                <li>Set a realistic asking price and mileage.</li>
                <li>Use My Listings later to adjust status and details.</li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/catalog"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-cars-primary"
                >
                  Browse catalog
                </Link>
                <Link
                  href="/my-listings"
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white"
                >
                  Manage listings
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <form onSubmit={onSubmit} className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Listing information</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-cars-primary">
                  Variant ID
                </label>
                <input
                  className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-cars-primary">
                  Asking price
                </label>
                <input
                  className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-cars-primary">
                  Mileage (km)
                </label>
                <input
                  className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                  value={mileageKm}
                  onChange={(e) => setMileageKm(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-cars-primary">
                  City
                </label>
                <input
                  className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-cars-primary">
                  Country code
                </label>
                <input
                  className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  maxLength={2}
                />
              </div>
            </div>
          </section>

          <section className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Seller note</h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              Describe the condition, maintenance history, or anything buyers should know before
              they request a viewing.
            </p>
            <textarea
              className="mt-5 min-h-[220px] w-full rounded-[28px] border border-cars-gray-light px-4 py-4 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <button
              className="mt-5 rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? "Creating..." : "Create listing"}
            </button>
          </section>
        </form>
      </main>
    </>
  );
}
