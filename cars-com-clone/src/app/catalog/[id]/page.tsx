"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import JsonPreview from "@/components/common/JsonPreview";
import { catalogApi, reviewsApi, watchlistApi } from "@/lib/carvista-api";
import { toCurrency } from "@/lib/api-client";
import type { CarReview, VariantDetail } from "@/lib/types";

function getText(value: unknown): string {
  return value == null ? "-" : String(value);
}

export default function CatalogDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [marketId, setMarketId] = useState("1");
  const [detail, setDetail] = useState<VariantDetail | null>(null);
  const [priceHistory, setPriceHistory] = useState<Array<Record<string, unknown>>>([]);
  const [reviews, setReviews] = useState<CarReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("Good car");
  const [comment, setComment] = useState("Solid value for money.");

  async function load(activeMarketId = Number(marketId)) {
    setLoading(true);
    setMessage("");
    try {
      const [detailRes, historyRes, reviewsRes] = await Promise.all([
        catalogApi.variantDetail(id),
        catalogApi.variantPriceHistory(id, activeMarketId),
        reviewsApi.carReviews(id),
      ]);
      setDetail(detailRes);
      setPriceHistory(historyRes.items);
      setReviews(reviewsRes.items);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load variant detail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Number.isFinite(id)) {
      load();
    }
  }, [id]);

  async function reloadHistory(e: FormEvent) {
    e.preventDefault();
    await load(Number(marketId));
  }

  async function saveVariant() {
    try {
      await watchlistApi.saveVariant(id);
      setTone("success");
      setMessage(`Variant ${id} saved to watchlist.`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save variant");
    }
  }

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    try {
      await reviewsApi.createCarReview({
        variant_id: id,
        rating: Number(rating),
        title,
        comment,
      });
      setTone("success");
      setMessage("Car review submitted.");
      const refreshed = await reviewsApi.carReviews(id);
      setReviews(refreshed.items);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Review failed");
    }
  }

  const heading = useMemo(() => {
    const variant = detail?.variant;
    if (!variant) return `Variant #${id}`;
    return `${getText(variant.make_name || variant.make_id)} ${getText(
      variant.model_name || variant.model_id
    )} ${getText(variant.trim_name)}`.trim();
  }, [detail, id]);

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <h1 className="mb-2 text-3xl font-bold">{heading}</h1>
        <p className="mb-6 text-sm text-slate-600">variant_id: {id}</p>
        <div className="mb-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p>Loading variant detail...</p> : null}

        {detail?.variant ? (
          <section className="mb-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border p-5">
              <h2 className="mb-4 text-xl font-semibold">Overview</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <p><span className="font-medium">Model year:</span> {getText(detail.variant.model_year)}</p>
                <p><span className="font-medium">Body type:</span> {getText(detail.variant.body_type)}</p>
                <p><span className="font-medium">Fuel:</span> {getText(detail.variant.fuel_type)}</p>
                <p><span className="font-medium">Engine:</span> {getText(detail.variant.engine)}</p>
                <p><span className="font-medium">Transmission:</span> {getText(detail.variant.transmission)}</p>
                <p><span className="font-medium">Drivetrain:</span> {getText(detail.variant.drivetrain)}</p>
                <p><span className="font-medium">MSRP:</span> {toCurrency(detail.variant.msrp_base)}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveVariant}
                  className="rounded bg-purple-800 px-4 py-2 text-sm text-white"
                >
                  Save to watchlist
                </button>
              </div>
            </div>

            <div className="rounded-2xl border p-5">
              <h2 className="mb-4 text-xl font-semibold">Price history</h2>
              <form onSubmit={reloadHistory} className="mb-4 flex gap-2">
                <input
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                  placeholder="marketId"
                />
                <button className="rounded border px-3 py-2 text-sm" type="submit">
                  Reload
                </button>
              </form>
              <div className="space-y-2 text-sm">
                {priceHistory.length === 0 ? <p>No price history.</p> : null}
                {priceHistory.map((row, index) => (
                  <div key={index} className="rounded border p-3">
                    <p>price: {toCurrency(row.price)}</p>
                    <p>captured_at: {getText(row.captured_at)}</p>
                    <p>source: {getText(row.source)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border p-5">
            <h2 className="mb-4 text-xl font-semibold">Create car review</h2>
            <form onSubmit={submitReview} className="space-y-3">
              <input
                className="w-full rounded border px-3 py-2"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="rating 1-5"
              />
              <input
                className="w-full rounded border px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="title"
              />
              <textarea
                className="min-h-[120px] w-full rounded border px-3 py-2"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="comment"
              />
              <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
                Submit review
              </button>
            </form>
          </div>

          <div className="rounded-2xl border p-5">
            <h2 className="mb-4 text-xl font-semibold">Car reviews</h2>
            <div className="space-y-3">
              {reviews.length === 0 ? <p className="text-sm text-slate-600">No reviews yet.</p> : null}
              {reviews.map((review, index) => (
                <div key={review.car_review_id || index} className="rounded border p-3 text-sm">
                  <p className="font-medium">{review.title || `Rating ${review.rating}/5`}</p>
                  <p className="mt-1">rating: {review.rating}/5</p>
                  <p className="mt-1">{review.comment || "-"}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <JsonPreview title="Raw variant payload" data={detail?.variant || null} />
          <JsonPreview title="Raw specs payload" data={{ spec: detail?.spec, kv: detail?.kv, images: detail?.images }} />
        </section>
      </main>
    </>
  );
}
