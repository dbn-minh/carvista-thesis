"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Phone } from "lucide-react";
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
import {
  getPreferredContactLabel,
  getRequestStatusBadgeClass,
  getRequestStatusLabel,
  sellerFollowUpStatusOptions,
} from "@/lib/viewing-requests";

type SellerLead = {
  request: ViewingRequest;
  listing: Listing | null;
};

export default function RequestsPage() {
  const ready = useRequireLogin("/requests");
  const [items, setItems] = useState<SellerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  if (!ready) return null;

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(
    requestId: number,
    status: (typeof sellerFollowUpStatusOptions)[number]["value"]
  ) {
    try {
      await requestsApi.updateStatus(requestId, status);
      setTone("success");
      setMessage(`Request updated to ${getRequestStatusLabel(status)}.`);
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

  const newLeadCount = sortedItems.filter((item) => item.request.status === "new").length;

  return (
    <>
      <Header />
      <main className="container-cars py-6 sm:py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-5 sm:p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Seller leads
              </p>
              <h1 className="mt-2 text-3xl font-apercu-bold text-cars-primary sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
                Viewing Requests
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Scan incoming buyers quickly, see how they want to be contacted, and keep your
                follow-up workflow tidy.
              </p>
            </div>

            <div className="rounded-[28px] bg-cars-primary p-5 text-primary-foreground shadow-[0_18px_44px_rgba(15,45,98,0.18)] sm:min-w-[220px]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
                New requests
              </p>
              <p className="mt-2 text-3xl font-apercu-bold text-primary-foreground">{newLeadCount}</p>
              <p className="mt-1 text-sm text-primary-foreground/82">
                Buyer lead{newLeadCount === 1 ? "" : "s"} waiting
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
                className="inline-flex w-full items-center justify-center rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white sm:w-auto"
              >
                Open my listings
              </Link>
            </div>
          </div>
        ) : null}

        {!loading && sortedItems.length > 0 ? (
          <div className="mt-6 space-y-4">
            {sortedItems.map(({ request, listing }) => {
              const listingTitle = listing ? buildListingTitle(listing) : "Saved listing";
              const listingPrice = listing ? formatListingPrice(listing.asking_price) : null;
              const location = listing
                ? formatLocation(listing.location_city, listing.location_country_code)
                : null;

              return (
                <article key={request.request_id} className="section-shell p-4 sm:p-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                          Buyer lead
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRequestStatusBadgeClass(request.status)}`}
                        >
                          {getRequestStatusLabel(request.status)}
                        </span>
                        <span className="text-xs text-cars-gray">
                          Sent {toDateTime(request.created_at)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="break-words text-xl font-apercu-bold text-cars-primary">
                            {request.contact_name || "Interested buyer"}
                          </h2>
                          <p className="mt-1 break-words text-sm font-medium text-cars-gray">
                            {listingTitle}
                          </p>
                        </div>

                        <div className="min-w-0 text-sm text-cars-gray sm:max-w-[240px] sm:text-right">
                          {listingPrice ? <span>{listingPrice}</span> : null}
                          {location && location !== "Location pending" ? (
                            <span className="break-words">
                              {listingPrice ? " - " : ""}
                              {location}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0 rounded-[18px] border border-cars-gray-light/60 px-3 py-2.5 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                            Email
                          </p>
                          <p className="mt-1 break-words text-cars-primary">
                            {request.contact_email || "Not provided"}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-[18px] border border-cars-gray-light/60 px-3 py-2.5 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                            Phone
                          </p>
                          <p className="mt-1 break-words text-cars-primary">
                            {request.contact_phone || "Not provided"}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-[18px] border border-cars-gray-light/60 px-3 py-2.5 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                            Preferred
                          </p>
                          <p className="mt-1 break-words text-cars-primary">
                            {getPreferredContactLabel(
                              request.preferred_contact_method,
                              request
                            )}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-[18px] border border-cars-gray-light/60 px-3 py-2.5 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                            Requested time
                          </p>
                          <p className="mt-1 break-words text-cars-primary">
                            {request.preferred_viewing_time || "To be arranged"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[20px] bg-cars-off-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                          Buyer message
                        </p>
                        <p className="mt-1 line-clamp-4 break-words text-sm leading-6 text-cars-gray">
                          {request.message || "No note was included with this request."}
                        </p>
                      </div>
                    </div>

                    <aside className="w-full xl:w-[260px] xl:flex-shrink-0">
                      <div className="grid gap-3 rounded-[22px] border border-cars-gray-light/60 p-4">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-cars-accent">
                          Follow-up status
                        </label>
                        <select
                          value={request.status}
                          onChange={(event) =>
                            void updateStatus(
                              request.request_id,
                              event.target.value as (typeof sellerFollowUpStatusOptions)[number]["value"]
                            )
                          }
                          className="h-11 w-full rounded-[18px] border border-cars-gray-light bg-white px-4 text-sm font-medium text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-background"
                        >
                          {request.status === "cancelled" ? (
                            <option value="cancelled" disabled>
                              Cancelled by buyer
                            </option>
                          ) : null}
                          {sellerFollowUpStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                          {listing ? (
                            <Link
                              href={`/listings/${listing.listing_id}`}
                              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-cars-primary/15 px-4 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                            >
                              View listing
                            </Link>
                          ) : null}
                          {request.contact_phone ? (
                            <a
                              href={`tel:${request.contact_phone}`}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-cars-primary/15 px-4 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                            >
                              <Phone className="h-4 w-4" />
                              Call
                            </a>
                          ) : null}
                          {request.contact_email ? (
                            <a
                              href={`mailto:${request.contact_email}`}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-cars-primary/15 px-4 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                            >
                              <Mail className="h-4 w-4" />
                              Email
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </aside>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </main>
    </>
  );
}
