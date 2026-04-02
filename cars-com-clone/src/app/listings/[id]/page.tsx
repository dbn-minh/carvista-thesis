"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import PageIntelligencePanel from "@/components/ai/PageIntelligencePanel";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import {
  buildListingTitle,
  formatBodyType,
  formatFuelType,
  formatListingPrice,
  formatLocation,
  formatMileage,
  formatTransmission,
} from "@/components/listings/listing-utils";
import { listingsApi, requestsApi, reviewsApi, watchlistApi } from "@/lib/carvista-api";
import { hasToken } from "@/lib/api-client";
import type { ListingDetail, SellerReview } from "@/lib/types";

function getImageUrl(image: Record<string, unknown>): string | null {
  const value = image.url ?? image.image_url ?? image.src ?? image.image;
  return typeof value === "string" && value ? value : null;
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const { openAssistant, openCompare } = useAiAssistant();
  const { openAuth } = useAuthModal();
  const id = Number(params.id);

  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [requestMessage, setRequestMessage] = useState("I would like to schedule a viewing for this car.");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [rating, setRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("Seller communication was good.");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const detailRes = await listingsApi.detail(id);
      setDetail(detailRes);
      try {
        const sellerReviews = await reviewsApi.sellerReviews(detailRes.listing.owner_id);
        setReviews(sellerReviews.items);
      } catch {
        setReviews([]);
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load listing detail");
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

  const listingTitle = detail?.listing ? buildListingTitle(detail.listing) : "Listing details";

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/listings/${id}` });
      return;
    }

    try {
      await requestsApi.createRequest(id, {
        message: requestMessage,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      });
      setTone("success");
      setMessage(
        "Viewing request sent successfully. The seller will review your note and may contact you using the details you provided."
      );
      setRequestMessage("I would like to schedule a viewing for this car.");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  async function saveListing() {
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/listings/${id}` });
      return;
    }

    try {
      await watchlistApi.saveListing(id);
      setTone("success");
      setMessage("Saved to Saved Cars.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save listing");
    }
  }

  async function submitSellerReview(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!hasToken()) {
      openAuth({ mode: "login", next: `/listings/${id}` });
      return;
    }

    try {
      await reviewsApi.createSellerReview({
        seller_id: detail.listing.owner_id,
        listing_id: detail.listing.listing_id,
        rating: Number(rating),
        comment: reviewComment,
      });
      setTone("success");
      setMessage("Seller review submitted.");
      const sellerReviews = await reviewsApi.sellerReviews(detail.listing.owner_id);
      setReviews(sellerReviews.items);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Seller review failed");
    }
  }

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Car for sale
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">{listingTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Review the listing, then log in to save it, request a viewing, or submit a
                seller review after your interaction.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/listings"
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Back to listings
              </Link>
              {detail?.listing?.variant_id ? (
                <button
                  type="button"
                  onClick={() =>
                    openCompare({
                      variantId: detail.listing.variant_id,
                      variantLabel: listingTitle,
                      marketId: 1,
                    })
                  }
                  className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
                >
                  Compare alternatives
                </button>
              ) : null}
              <button
                  type="button"
                  onClick={() =>
                    openAssistant({
                      prompt: `Help me evaluate ${listingTitle}, including ownership cost, market outlook, and whether it fits my needs.`,
                      marketId: 1,
                      variantId: detail?.listing?.variant_id,
                      variantLabel: listingTitle,
                    })
                  }
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Ask AI advisor
              </button>
              {!hasToken() ? (
                <button
                  type="button"
                  onClick={() => openAuth({ mode: "login", next: `/listings/${id}` })}
                  className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Login to interact
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mb-6 mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p className="text-sm text-cars-gray">Loading listing detail...</p> : null}

        {detail?.listing ? (
          <section className="mb-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="section-shell p-6">
              <h2 className="text-2xl font-apercu-bold text-cars-primary">Listing gallery</h2>
              {selectedImage ? (
                <div className="mt-5 overflow-hidden rounded-[28px] bg-cars-off-white">
                  <img
                    src={selectedImage}
                    alt={listingTitle}
                    className="h-[360px] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="mt-5 flex h-[360px] items-center justify-center rounded-[28px] bg-cars-off-white text-sm font-medium text-cars-gray">
                  No listing images uploaded yet.
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
                      <img src={image} alt={listingTitle} className="h-20 w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="section-shell p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Overview
                  </p>
                  <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                    {formatListingPrice(detail.listing.asking_price)}
                  </h2>
                </div>
                <span className="rounded-full bg-cars-off-white px-3 py-1 text-sm font-semibold capitalize text-cars-primary">
                  {detail.listing.status}
                </span>
              </div>

              <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Seller:</span>{" "}
                  {detail.listing.seller_type || "Private seller"}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Body style:</span>{" "}
                  {formatBodyType(detail.listing.body_type)}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Mileage:</span>{" "}
                  {formatMileage(detail.listing.mileage_km)}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Location:</span>{" "}
                  {formatLocation(detail.listing.location_city, detail.listing.location_country_code)}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Transmission:</span>{" "}
                  {formatTransmission(detail.listing.transmission)}
                </p>
                <p className="rounded-[20px] bg-cars-off-white px-4 py-3">
                  <span className="font-medium text-cars-primary">Fuel:</span>{" "}
                  {formatFuelType(detail.listing.fuel_type)}
                </p>
              </div>

              <p className="mt-6 text-sm leading-7 text-cars-gray">
                {detail.listing.description || "Seller has not added a description yet."}
              </p>

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={saveListing}
                  className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                >
                  Save listing
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {detail?.listing ? (
          <PageIntelligencePanel
            subjectType="listing"
            subjectId={id}
            marketId={1}
            title="AI price, ownership, and buyer-fit preview"
            className="mb-8"
          />
        ) : null}

        <section className="mb-8 grid gap-6 xl:grid-cols-2">
          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Request a viewing</h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              Send your details to the seller so they can review your request and get back to you.
            </p>
            <form onSubmit={sendRequest} className="space-y-3">
              <input
                className="mt-5 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Your name"
              />
              <input
                className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email address"
              />
              <input
                className="h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Phone number"
              />
              <textarea
                className="min-h-[120px] w-full rounded-[24px] border border-cars-gray-light px-4 py-3 text-sm"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Tell the seller when you would like to view the car."
              />
              <button
                className="rounded-full bg-cars-accent px-5 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Send request
              </button>
            </form>
          </div>

          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Create seller review</h2>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              Leave a rating and comment for the seller after a real interaction.
            </p>
            <form onSubmit={submitSellerReview} className="space-y-3">
              <input
                className="mt-5 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="rating 1-5"
              />
              <textarea
                className="min-h-[120px] w-full rounded-[24px] border border-cars-gray-light px-4 py-3 text-sm"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="comment"
              />
              <button
                className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Submit seller review
              </button>
            </form>
          </div>
        </section>

        <section className="mb-8 section-shell p-6">
          <h2 className="text-2xl font-apercu-bold text-cars-primary">Seller reviews</h2>
          <div className="space-y-3 text-sm">
            {reviews.length === 0 ? <p className="mt-4 text-cars-gray">No seller reviews yet.</p> : null}
            {reviews.map((review, index) => (
              <div
                key={review.seller_review_id || index}
                className="mt-4 rounded-[22px] border border-cars-gray-light/70 p-4"
              >
                <p className="font-medium text-cars-primary">Rating: {review.rating}/5</p>
                <p className="mt-2 text-cars-gray">{review.comment || "-"}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
