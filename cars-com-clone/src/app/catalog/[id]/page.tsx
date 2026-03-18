"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { catalogApi, reviewsApi, watchlistApi } from "@/lib/carvista-api";
import { hasToken, toCurrency } from "@/lib/api-client";
import type { CarReview, VariantDetail } from "@/lib/types";

function getText(value: unknown): string {
  return value == null ? "-" : String(value);
}

function getImageUrl(image: Record<string, unknown>): string | null {
  const value = image.url ?? image.image_url ?? image.src ?? image.image;
  return typeof value === "string" && value ? value : null;
}

export default function CatalogDetailPage() {
  const params = useParams<{ id: string }>();
  const { openAuth } = useAuthModal();
  const id = Number(params.id);

  const [marketId, setMarketId] = useState("1");
  const [detail, setDetail] = useState<VariantDetail | null>(null);
  const [priceHistory, setPriceHistory] = useState<Array<Record<string, unknown>>>([]);
  const [reviews, setReviews] = useState<CarReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

  const gallery = useMemo(
    () => (detail?.images || []).map(getImageUrl).filter((item): item is string => Boolean(item)),
    [detail]
  );

  useEffect(() => {
    setSelectedImage(gallery[0] || null);
  }, [gallery]);

  async function reloadHistory(e: FormEvent) {
    e.preventDefault();
    await load(Number(marketId));
  }

  async function saveVariant() {
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/catalog/${id}` });
      return;
    }

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
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/catalog/${id}` });
      return;
    }

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
    const modelYear = getText(variant.model_year);
    const trim = getText(variant.trim_name);
    return `${modelYear} ${trim}`.trim();
  }, [detail, id]);

  const specCards = [
    { label: "Body type", value: detail?.variant?.body_type },
    { label: "Fuel", value: detail?.variant?.fuel_type },
    { label: "Engine", value: detail?.variant?.engine },
    { label: "Transmission", value: detail?.variant?.transmission },
    { label: "Drivetrain", value: detail?.variant?.drivetrain },
    { label: "MSRP", value: toCurrency(detail?.variant?.msrp_base) },
  ];

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Catalog detail
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">{heading}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Use this screen to review visuals, specs, price history, and user feedback before
                saving the car or moving into marketplace and AI flows.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalog"
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Back to catalog
              </Link>
              <button
                type="button"
                onClick={saveVariant}
                className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Save to watchlist
              </button>
            </div>
          </div>
        </section>

        <div className="mb-6 mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p className="text-sm text-cars-gray">Loading variant detail...</p> : null}

        {detail?.variant ? (
          <section className="mb-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="section-shell p-6">
              <h2 className="text-2xl font-apercu-bold text-cars-primary">Photo gallery</h2>
              {selectedImage ? (
                <div className="mt-5 overflow-hidden rounded-[28px] bg-cars-off-white">
                  <img
                    src={selectedImage}
                    alt={heading}
                    className="h-[360px] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="mt-5 flex h-[360px] items-center justify-center rounded-[28px] bg-cars-off-white text-sm font-medium text-cars-gray">
                  No catalog images seeded for this variant yet.
                </div>
              )}

              {gallery.length > 1 ? (
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {gallery.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      className={
                        image === selectedImage
                          ? "overflow-hidden rounded-[18px] ring-2 ring-cars-accent"
                          : "overflow-hidden rounded-[18px] border border-cars-gray-light/70"
                      }
                    >
                      <img src={image} alt={heading} className="h-20 w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="section-shell p-6">
              <h2 className="text-2xl font-apercu-bold text-cars-primary">Overview</h2>
              <div className="mt-5 grid gap-3">
                {specCards.map((item) => (
                  <div key={item.label} className="rounded-[20px] bg-cars-off-white px-4 py-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                      {item.label}
                    </p>
                    <p className="mt-2 font-medium text-cars-primary">{getText(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-8 grid gap-6 xl:grid-cols-2">
          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Price history</h2>
            <form onSubmit={reloadHistory} className="mt-5 flex gap-3">
              <input
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
                className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                placeholder="marketId"
              />
              <button
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary"
                type="submit"
              >
                Reload
              </button>
            </form>
            <div className="mt-5 space-y-3 text-sm">
              {priceHistory.length === 0 ? <p className="text-cars-gray">No price history.</p> : null}
              {priceHistory.map((row, index) => (
                <div
                  key={index}
                  className="rounded-[22px] border border-cars-gray-light/70 p-4"
                >
                  <p className="font-medium text-cars-primary">Price: {toCurrency(row.price)}</p>
                  <p className="mt-2 text-cars-gray">Captured: {getText(row.captured_at)}</p>
                  <p className="mt-1 text-cars-gray">Source: {getText(row.source)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Create car review</h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              Reviews require login and help build the user-generated feedback layer of CarVista.
            </p>
            <form onSubmit={submitReview} className="space-y-3">
              <input
                className="mt-5 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="rating 1-5"
              />
              <input
                className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="title"
              />
              <textarea
                className="min-h-[120px] w-full rounded-[24px] border border-cars-gray-light px-4 py-3 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="comment"
              />
              <button
                className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Submit review
              </button>
            </form>
          </div>
        </section>

        <section className="section-shell p-6">
          <h2 className="text-2xl font-apercu-bold text-cars-primary">Car reviews</h2>
          <div className="mt-5 space-y-3">
            {reviews.length === 0 ? <p className="text-sm text-cars-gray">No reviews yet.</p> : null}
            {reviews.map((review, index) => (
              <div
                key={review.car_review_id || index}
                className="rounded-[22px] border border-cars-gray-light/70 p-4 text-sm"
              >
                <p className="font-medium text-cars-primary">
                  {review.title || `Rating ${review.rating}/5`}
                </p>
                <p className="mt-2 text-cars-gray">Rating: {review.rating}/5</p>
                <p className="mt-2 text-cars-gray">{review.comment || "-"}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
