"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import JsonPreview from "@/components/common/JsonPreview";
import { listingsApi, requestsApi, reviewsApi, watchlistApi } from "@/lib/carvista-api";
import { toCurrency } from "@/lib/api-client";
import type { ListingDetail, SellerReview } from "@/lib/types";

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(true);

  const [requestMessage, setRequestMessage] = useState("I want to schedule a viewing.");
  const [contactName, setContactName] = useState("Test User");
  const [contactEmail, setContactEmail] = useState("user@example.com");
  const [contactPhone, setContactPhone] = useState("0900000000");

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

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    try {
      await requestsApi.createRequest(id, {
        message: requestMessage,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      });
      setTone("success");
      setMessage("Viewing request created.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }

  async function saveListing() {
    try {
      await watchlistApi.saveListing(id);
      setTone("success");
      setMessage(`Listing ${id} saved.`);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save listing");
    }
  }

  async function submitSellerReview(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
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
        <h1 className="mb-2 text-3xl font-bold">Listing detail</h1>
        <p className="mb-6 text-sm text-slate-600">listing_id: {id}</p>
        <div className="mb-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p>Loading listing detail...</p> : null}

        {detail?.listing ? (
          <section className="mb-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border p-5">
              <h2 className="mb-4 text-xl font-semibold">Overview</h2>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <p><span className="font-medium">Variant:</span> {detail.listing.variant_id}</p>
                <p><span className="font-medium">Seller:</span> {detail.listing.owner_id}</p>
                <p><span className="font-medium">Status:</span> {detail.listing.status}</p>
                <p><span className="font-medium">Price:</span> {toCurrency(detail.listing.asking_price)}</p>
                <p><span className="font-medium">Mileage:</span> {detail.listing.mileage_km ?? "-"} km</p>
                <p><span className="font-medium">Location:</span> {detail.listing.location_city || "-"} / {detail.listing.location_country_code || "-"}</p>
              </div>
              <p className="mt-4 text-sm">{detail.listing.description || "No description"}</p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={saveListing}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Save listing
                </button>
              </div>
            </div>

            <div className="rounded-2xl border p-5">
              <h2 className="mb-4 text-xl font-semibold">Listing images</h2>
              {detail.images.length === 0 ? <p className="text-sm text-slate-600">No images.</p> : null}
              <div className="space-y-2 text-sm">
                {detail.images.map((img, index) => (
                  <div key={index} className="rounded border p-3">
                    <p>image_url: {String(img.image_url ?? "-")}</p>
                    <p>sort_order: {String(img.sort_order ?? "-")}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border p-5">
            <h2 className="mb-4 text-xl font-semibold">Create viewing request</h2>
            <form onSubmit={sendRequest} className="space-y-3">
              <input
                className="w-full rounded border px-3 py-2"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="contact_name"
              />
              <input
                className="w-full rounded border px-3 py-2"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact_email"
              />
              <input
                className="w-full rounded border px-3 py-2"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="contact_phone"
              />
              <textarea
                className="min-h-[120px] w-full rounded border px-3 py-2"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="message"
              />
              <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
                Submit request
              </button>
            </form>
          </div>

          <div className="rounded-2xl border p-5">
            <h2 className="mb-4 text-xl font-semibold">Create seller review</h2>
            <form onSubmit={submitSellerReview} className="space-y-3">
              <input
                className="w-full rounded border px-3 py-2"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="rating 1-5"
              />
              <textarea
                className="min-h-[120px] w-full rounded border px-3 py-2"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="comment"
              />
              <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
                Submit seller review
              </button>
            </form>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border p-5">
          <h2 className="mb-4 text-xl font-semibold">Seller reviews</h2>
          <div className="space-y-3 text-sm">
            {reviews.length === 0 ? <p className="text-slate-600">No seller reviews yet.</p> : null}
            {reviews.map((review, index) => (
              <div key={review.seller_review_id || index} className="rounded border p-3">
                <p className="font-medium">rating: {review.rating}/5</p>
                <p className="mt-1">{review.comment || "-"}</p>
              </div>
            ))}
          </div>
        </section>

        <JsonPreview title="Raw listing payload" data={detail} />
      </main>
    </>
  );
}
