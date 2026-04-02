"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/common/EmptyState";
import StatusBanner from "@/components/common/StatusBanner";
import Header from "@/components/layout/Header";
import {
  buildListingTitle,
  formatListingPrice,
  formatLocation,
} from "@/components/listings/listing-utils";
import { listingsApi, requestsApi } from "@/lib/carvista-api";
import { toDateTime } from "@/lib/api-client";
import { useRequireLogin } from "@/lib/auth-guard";
import type { Listing, ViewingRequest } from "@/lib/types";

type SellerLead = {
  request: ViewingRequest;
  listing: Listing | null;
};

function derivePreferredContact(request: ViewingRequest) {
  const hasPhone = Boolean(request.contact_phone);
  const hasEmail = Boolean(request.contact_email);

  if (hasPhone && hasEmail) return "Phone or email";
  if (hasPhone) return "Phone";
  if (hasEmail) return "Email";
  return "Account message";
}

export default function RequestsPage() {
  const ready = useRequireLogin("/requests");
  const [items, setItems] = useState<SellerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  if (!ready) return null;

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const inbox = await requestsApi.inbox();
      const leads = await Promise.all(
        inbox.items.map(async (request) => {
          try {
            const detail = await listingsApi.detail(request.listing_id);
            return {
              request,
              listing: detail.listing,
            } satisfies SellerLead;
          } catch {
            return {
              request,
              listing: null,
            } satisfies SellerLead;
          }
        })
      );

      setItems(leads);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("carvista-requests-changed"));
      }
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error ? error.message : "Could not load your viewing requests right now."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateStatus(requestId: number, status: "accepted" | "rejected") {
    try {
      await requestsApi.updateStatus(requestId, status);
      setTone("success");
      setMessage(
        status === "accepted"
          ? "Viewing request accepted. The buyer can follow up using the contact details they shared."
          : "Viewing request declined."
      );
      await load();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("carvista-requests-changed"));
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not update this request.");
    }
  }

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          new Date(String(right.request.created_at || 0)).getTime() -
          new Date(String(left.request.created_at || 0)).getTime()
      ),
    [items]
  );

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Seller leads
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Viewing Requests</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                See who wants to view your cars, what they asked for, and how they prefer to be contacted.
              </p>
            </div>

            <div className="rounded-[28px] bg-cars-primary p-5 text-white shadow-[0_18px_44px_rgba(15,45,98,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Open requests
              </p>
              <p className="mt-2 text-3xl font-apercu-bold">{sortedItems.length}</p>
              <p className="mt-1 text-sm text-white/80">
                Buyer lead{sortedItems.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-cars-gray">Loading your viewing requests...</p>
        ) : null}

        {!loading && sortedItems.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No viewing requests yet"
              description="When buyers request to view one of your listings, it will appear here."
            />
            <div className="mt-4">
              <Link
                href="/my-listings"
                className="inline-flex rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                Open my listings
              </Link>
            </div>
          </div>
        ) : null}

        {!loading && sortedItems.length > 0 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {sortedItems.map(({ request, listing }) => {
              const listingTitle = listing ? buildListingTitle(listing) : "Saved listing";
              const listingPrice = listing ? formatListingPrice(listing.asking_price) : null;
              const location = listing
                ? formatLocation(listing.location_city, listing.location_country_code)
                : null;

              return (
                <article
                  key={request.request_id}
                  className="section-shell flex h-full flex-col p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                        Buyer request
                      </p>
                      <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                        {request.contact_name || "Interested buyer"}
                      </h2>
                      <p className="mt-2 text-sm text-cars-gray">
                        Sent {toDateTime(request.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full bg-cars-off-white px-3 py-1 text-sm font-semibold capitalize text-cars-primary">
                      {request.status}
                    </span>
                  </div>

                  <div className="mt-5 rounded-[24px] bg-cars-off-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                      Requested listing
                    </p>
                    <p className="mt-2 text-lg font-apercu-bold text-cars-primary">{listingTitle}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-cars-gray">
                      {listingPrice ? <span>{listingPrice}</span> : null}
                      {location && location !== "Location pending" ? <span>{location}</span> : null}
                    </div>
                    {listing ? (
                      <Link
                        href={`/listings/${listing.listing_id}`}
                        className="mt-4 inline-flex text-sm font-semibold text-cars-primary hover:text-cars-accent"
                      >
                        View listing
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                    <p className="rounded-[20px] border border-cars-gray-light/70 px-4 py-3">
                      <span className="font-medium text-cars-primary">Phone:</span>{" "}
                      {request.contact_phone || "Not provided"}
                    </p>
                    <p className="rounded-[20px] border border-cars-gray-light/70 px-4 py-3">
                      <span className="font-medium text-cars-primary">Email:</span>{" "}
                      {request.contact_email || "Not provided"}
                    </p>
                    <p className="rounded-[20px] border border-cars-gray-light/70 px-4 py-3">
                      <span className="font-medium text-cars-primary">Preferred contact:</span>{" "}
                      {derivePreferredContact(request)}
                    </p>
                    <p className="rounded-[20px] border border-cars-gray-light/70 px-4 py-3">
                      <span className="font-medium text-cars-primary">Requested time:</span>{" "}
                      {request.preferred_viewing_time || "To be arranged"}
                    </p>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-cars-gray-light/70 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                      Buyer note
                    </p>
                    <p className="mt-2 text-sm leading-6 text-cars-gray">
                      {request.message || "No message was included with this request."}
                    </p>
                  </div>

                  {request.status === "pending" ? (
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      <button
                        type="button"
                        onClick={() => void updateStatus(request.request_id, "accepted")}
                        className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                      >
                        Accept request
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateStatus(request.request_id, "rejected")}
                        className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                      >
                        Decline
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </main>
    </>
  );
}
