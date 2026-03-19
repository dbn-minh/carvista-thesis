"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { catalogApi, reviewsApi, watchlistApi } from "@/lib/carvista-api";
import { hasToken, toCurrency } from "@/lib/api-client";
import type { CarReview, CatalogOwnershipSummary, VariantDetail } from "@/lib/types";

function getText(value: unknown): string {
  return value == null ? "-" : String(value);
}

function getImageUrl(image: Record<string, unknown>): string | null {
  const value = image.url ?? image.image_url ?? image.src ?? image.image;
  return typeof value === "string" && value ? value : null;
}

export default function CatalogDetailPage() {
  const params = useParams<{ id: string }>();
  const { openAssistant, openCompare } = useAiAssistant();
  const { openAuth } = useAuthModal();
  const id = Number(params.id);

  const [marketId, setMarketId] = useState("1");
  const [ownershipYears, setOwnershipYears] = useState("5");
  const [detail, setDetail] = useState<VariantDetail | null>(null);
  const [priceHistory, setPriceHistory] = useState<Array<Record<string, unknown>>>([]);
  const [reviews, setReviews] = useState<CarReview[]>([]);
  const [ownershipSummary, setOwnershipSummary] = useState<CatalogOwnershipSummary | null>(null);
  const [ownershipError, setOwnershipError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("Good car");
  const [comment, setComment] = useState("Solid value for money.");

  async function load(
    activeMarketId = Number(marketId),
    activeOwnershipYears = Number(ownershipYears)
  ) {
    setLoading(true);
    setMessage("");
    try {
      const [detailRes, historyRes, reviewsRes, ownershipRes] = await Promise.allSettled([
        catalogApi.variantDetail(id),
        catalogApi.variantPriceHistory(id, activeMarketId),
        reviewsApi.carReviews(id),
        catalogApi.variantOwnershipSummary(id, {
          marketId: activeMarketId,
          ownershipYears: activeOwnershipYears,
        }),
      ]);

      if (detailRes.status !== "fulfilled") {
        throw detailRes.reason;
      }

      setDetail(detailRes.value);
      setPriceHistory(historyRes.status === "fulfilled" ? historyRes.value.items : []);
      setReviews(reviewsRes.status === "fulfilled" ? reviewsRes.value.items : []);
      setOwnershipSummary(ownershipRes.status === "fulfilled" ? ownershipRes.value : null);
      setOwnershipError(
        ownershipRes.status === "rejected"
          ? ownershipRes.reason instanceof Error
            ? ownershipRes.reason.message
            : "Ownership estimate is unavailable for this market."
          : ""
      );
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
    await load(Number(marketId), Number(ownershipYears));
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
    const makeName = getText(variant.make_name);
    const modelName = getText(variant.model_name);
    const trim = getText(variant.trim_name);
    return [modelYear, makeName, modelName, trim].filter((part) => part && part !== "-").join(" ");
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
                onClick={() =>
                  openCompare({
                    variantId: id,
                    variantLabel: heading,
                    marketId: Number(marketId) || 1,
                  })
                }
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Compare with AI
              </button>
              <button
                type="button"
                onClick={() =>
                  openAssistant({
                    prompt: `Help me decide whether ${heading} fits my lifestyle and budget.`,
                    marketId: Number(marketId) || 1,
                    variantId: id,
                    variantLabel: heading,
                  })
                }
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Ask AI advisor
              </button>
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
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-apercu-bold text-cars-primary">Price history</h2>
                <p className="mt-3 text-sm leading-6 text-cars-gray">
                  Review the recent market trail, then let AI turn it into a buyer-friendly price
                  outlook for this exact vehicle.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  openAssistant({
                    prompt: `Predict the future price of ${heading} over the next 6 months.`,
                    marketId: Number(marketId) || 1,
                    variantId: id,
                    variantLabel: heading,
                  })
                }
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                Get AI price outlook
              </button>
            </div>
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
            <div className="mt-3">
              <select
                value={ownershipYears}
                onChange={(e) => setOwnershipYears(e.target.value)}
                className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm text-cars-primary"
              >
                <option value="3">3-year ownership</option>
                <option value="5">5-year ownership</option>
                <option value="7">7-year ownership</option>
              </select>
            </div>
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
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-apercu-bold text-cars-primary">Estimated TCO</h2>
                <p className="mt-3 text-sm leading-6 text-cars-gray">
                  Ownership estimate is now part of the detail view, so buyers can see a practical
                  drive-away and long-term cost snapshot before deciding.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  openAssistant({
                    prompt: `Explain the ownership cost of ${heading} and the biggest cost drivers.`,
                    marketId: Number(marketId) || 1,
                    variantId: id,
                    variantLabel: heading,
                  })
                }
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                Discuss this estimate with AI
              </button>
            </div>

            {ownershipSummary?.estimate ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[22px] bg-cars-off-white px-4 py-4 text-sm leading-7 text-cars-primary">
                  {ownershipSummary.estimate.assistant_message}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {ownershipSummary.estimate.insight_cards.map((card) => (
                    <article
                      key={card.title}
                      className="rounded-[22px] border border-cars-gray-light/70 px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        {card.title}
                      </p>
                      {card.value != null ? (
                        <p className="mt-2 text-lg font-apercu-bold text-cars-primary">
                          {typeof card.value === "number" ? toCurrency(card.value) : card.value}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm leading-6 text-cars-gray">{card.description}</p>
                    </article>
                  ))}
                </div>

                {ownershipSummary.estimate.highlights.length ? (
                  <div className="space-y-2">
                    {ownershipSummary.estimate.highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="rounded-[18px] bg-white px-4 py-3 text-sm text-cars-primary shadow-sm"
                      >
                        {highlight}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-cars-primary/20 bg-cars-off-white px-4 py-4 text-sm leading-7 text-cars-gray">
                {ownershipError || "Ownership estimate is not available for this market yet."}
              </div>
            )}
          </div>
        </section>

        <section className="section-shell mb-8 p-6">
          <h2 className="text-2xl font-apercu-bold text-cars-primary">Create car review</h2>
          <p className="mt-3 text-sm leading-6 text-cars-gray">
            Reviews require login and help build the user-generated feedback layer of CarVista.
          </p>
          <form onSubmit={submitReview} className="mt-5 space-y-3">
            <input
              className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
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
