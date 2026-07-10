"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import PageIntelligencePanel from "@/components/ai/PageIntelligencePanel";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import EstimatedTcoPanel from "@/components/catalog/EstimatedTcoPanel";
import PriceHistoryChart from "@/components/catalog/PriceHistoryChart";
import Header from "@/components/layout/Header";
import StarRating from "@/components/reviews/StarRating";
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

function getReviewKey(review: CarReview) {
  return String(
    review.car_review_id ||
      `${review.title || "car-review"}-${review.comment || ""}-${review.created_at || ""}`
  );
}

const reviewControlClass =
  "w-full border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition placeholder:text-cars-gray focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:border-white/10 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-400";

export default function CatalogDetailPage() {
  const params = useParams<{ id: string }>();
  const { openAuth } = useAuthModal();
  const id = Number(params.id);

  const [marketId] = useState("1");
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

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("Good car");
  const [comment, setComment] = useState("Solid value for money.");

  const load = useCallback(
    async (activeMarketId = Number(marketId), activeOwnershipYears = Number(ownershipYears)) => {
      setLoading(true);
      setMessage("");
      try {
        const [detailRes, historyRes, reviewsRes, ownershipRes] = await Promise.allSettled([
          catalogApi.variantDetail(id),
          catalogApi.variantPriceHistory(id, activeMarketId, 72),
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
    },
    [id, marketId, ownershipYears]
  );

  useEffect(() => {
    if (Number.isFinite(id)) {
      void load();
    }
  }, [id, load]);

  const gallery = useMemo(
    () => (detail?.images || []).map(getImageUrl).filter((item): item is string => Boolean(item)),
    [detail]
  );

  useEffect(() => {
    setSelectedImage(gallery[0] || null);
  }, [gallery]);

  const saveVariant = useCallback(async () => {
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/catalog/${id}` });
      return;
    }

    try {
      await watchlistApi.saveVariant(id);
      setTone("success");
      setMessage("Saved to your watchlist.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save variant");
    }
  }, [id, openAuth]);

  const submitReview = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!hasToken()) {
        openAuth({ mode: "login", next: `/catalog/${id}` });
        return;
      }

      try {
        await reviewsApi.createCarReview({
          variant_id: id,
          rating,
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
    },
    [comment, id, openAuth, rating, title]
  );

  const changeOwnershipYears = useCallback(
    async (nextValue: string) => {
      setOwnershipYears(nextValue);
      await load(Number(marketId), Number(nextValue));
    },
    [load, marketId]
  );

  const heading = useMemo(() => {
    const variant = detail?.variant;
    if (!variant) return "Vehicle details";
    const modelYear = getText(variant.model_year);
    const makeName = getText(variant.make_name);
    const modelName = getText(variant.model_name);
    const trim = getText(variant.trim_name);
    return [modelYear, makeName, modelName, trim]
      .filter((part) => part && part !== "-")
      .join(" ");
  }, [detail]);

  const specCards = useMemo(
    () => [
      { label: "Body type", value: detail?.variant?.body_type },
      { label: "Fuel", value: detail?.variant?.fuel_type },
      { label: "Engine", value: detail?.variant?.engine },
      { label: "Transmission", value: detail?.variant?.transmission },
      { label: "Drivetrain", value: detail?.variant?.drivetrain },
      { label: "MSRP", value: toCurrency(detail?.variant?.msrp_base) },
    ],
    [detail]
  );

  const listingsHref = useMemo(() => {
    const variant = detail?.variant;
    if (!variant) return "/listings";

    const params = new URLSearchParams();
    params.set("mode", "match");
    params.set("variantId", String(id));
    params.set("query", heading);

    if (variant.make_name != null) params.set("make", String(variant.make_name));
    if (variant.model_year != null) params.set("year", String(variant.model_year));
    if (variant.body_type != null) params.set("bodyType", String(variant.body_type));
    if (variant.fuel_type != null) params.set("fuelType", String(variant.fuel_type));

    return `/listings?${params.toString()}`;
  }, [detail, heading, id]);

  return (
    <>
      <Header />
      <main className="container-cars py-6 sm:py-8">
        <section className="section-shell overflow-hidden border-white/10 bg-[linear-gradient(135deg,rgba(14,20,31,0.98),rgba(12,18,27,0.98),rgba(18,27,42,0.94))] p-5 sm:p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8fb4ff]">
                Catalog detail
              </p>
              <h1 className="mt-2 text-3xl font-apercu-bold text-slate-50 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                {heading}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Use this screen to review visuals, specs, price history, and user feedback before
                saving the car or moving into marketplace and AI flows.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto xl:flex xl:flex-wrap xl:justify-end">
              <Link
                href={listingsHref}
                className="editorial-button inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold text-slate-950 transition-colors hover:brightness-105 sm:w-auto"
              >
                View listings
              </Link>
              <button
                type="button"
                onClick={saveVariant}
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 sm:w-auto"
              >
                Save to watchlist
              </button>
              <Link
                href="/catalog"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 sm:w-auto"
              >
                Back to catalog
              </Link>
            </div>
          </div>
        </section>

        <div className="mb-6 mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p className="text-sm text-slate-300">Loading variant detail...</p> : null}

        {detail?.variant ? (
          <section className="mb-8 grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <div className="section-shell flex h-full flex-col p-4 sm:p-5 md:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
                    Photo gallery
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-cars-gray">
                    Browse official catalog imagery before opening live marketplace matches.
                  </p>
                </div>
              </div>

              {selectedImage ? (
                <div className="mt-5 flex min-h-[360px] flex-1 overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(143,180,255,0.16),transparent_48%),linear-gradient(180deg,rgba(16,22,32,0.96),rgba(10,14,20,0.98))] sm:min-h-[420px] sm:rounded-[28px]">
                  <img
                    src={selectedImage}
                    alt={heading}
                    className="h-full w-full object-cover object-center"
                  />
                </div>
              ) : (
                <div className="mt-5 flex min-h-[360px] flex-1 items-center justify-center rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(143,180,255,0.16),transparent_48%),linear-gradient(180deg,rgba(16,22,32,0.96),rgba(10,14,20,0.98))] px-6 text-center text-sm font-medium text-slate-300 sm:min-h-[420px] sm:rounded-[28px]">
                  Photos coming soon.
                </div>
              )}

              {gallery.length > 1 ? (
                <div className="mt-4 grid auto-rows-fr grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3">
                  {gallery.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      className={
                        image === selectedImage
                          ? "h-full overflow-hidden rounded-[18px] ring-2 ring-cars-accent"
                          : "h-full overflow-hidden rounded-[18px] border border-cars-gray-light/70"
                      }
                    >
                      <div className="aspect-[4/3]">
                        <img src={image} alt={heading} className="h-full w-full object-cover" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="section-shell flex h-full flex-col self-stretch p-4 sm:p-5 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Overview
                  </p>
                  <h2 className="mt-2 min-h-[5.5rem] text-2xl font-apercu-bold leading-tight text-cars-primary line-clamp-2 sm:min-h-[6.5rem] sm:text-3xl">
                    {heading}
                  </h2>
                </div>
                <Link
                  href={listingsHref}
                  className="inline-flex h-10 items-center justify-center self-start rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
                >
                  Match listings
                </Link>
              </div>

              <div className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-2">
                {specCards.map((item) => (
                  <div
                    key={item.label}
                    className="flex h-full min-h-[108px] flex-col rounded-[20px] border border-white/8 bg-white/5 px-4 py-3 text-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                      {item.label}
                    </p>
                    <p className="mt-3 line-clamp-2 break-words font-medium leading-6 text-cars-primary">
                      {getText(item.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {detail?.variant ? (
          <PageIntelligencePanel
            subjectType="variant"
            subjectId={id}
            marketId={Number(marketId) || 1}
            ownershipYears={Number(ownershipYears) || 5}
            title="AI fit preview"
            className="mb-8"
            compactLayout
            hiddenSectionKeys={["ownership_cost", "price_outlook"]}
            requirePersonalizedContext
            allowedActionPathTypes={["related_listings"]}
            showSectionCaveats={false}
            showSectionSources={false}
          />
        ) : null}

        <section className="mb-8 space-y-6">
          <div className="section-shell p-4 sm:p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
                  Price history
                </h2>
                <p className="mt-3 text-sm leading-6 text-cars-gray">
                  Latest monthly snapshots for this exact variant.
                </p>
              </div>
            </div>
            <PriceHistoryChart rows={priceHistory} />
          </div>

          <EstimatedTcoPanel
            ownershipSummary={ownershipSummary}
            ownershipError={ownershipError}
            ownershipYears={ownershipYears}
            onOwnershipYearsChange={changeOwnershipYears}
          />
        </section>

        <section className="section-shell mb-8 p-4 sm:p-5 md:p-6">
          <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
            Create car review
          </h2>
          <p className="mt-3 text-sm leading-6 text-cars-gray">
            Reviews require login and help build the user-generated feedback layer of CarVista.
          </p>
          <form onSubmit={submitReview} className="mt-5 space-y-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-cars-primary">Your rating</p>
              <div className="mt-3 overflow-x-auto">
                <StarRating value={rating} onChange={setRating} size="lg" showValue={false} />
              </div>
            </div>
            <input
              className={`h-11 rounded-full ${reviewControlClass}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="title"
            />
            <textarea
              className={`min-h-[120px] rounded-[24px] py-3 ${reviewControlClass}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="comment"
            />
            <button
              className="editorial-button inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-slate-950 sm:w-auto"
              type="submit"
            >
              Submit review
            </button>
          </form>
        </section>

        <section className="section-shell p-4 sm:p-5 md:p-6">
          <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">Car reviews</h2>
          <div className="mt-5 space-y-3">
            {reviews.length === 0 ? <p className="text-sm text-cars-gray">No reviews yet.</p> : null}
            {reviews.map((review) => (
              <div
                key={getReviewKey(review)}
                className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium text-cars-primary">{review.title || "Car review"}</p>
                  <StarRating value={Number(review.rating || 0)} size="sm" showValue={false} />
                </div>
                <p className="mt-2 text-cars-gray">{review.comment || "-"}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
