"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import {
  authApi,
  notificationsApi,
  requestsApi,
  watchlistApi,
} from "@/lib/carvista-api";
import { toDateTime } from "@/lib/api-client";
import { useRequireLogin } from "@/lib/auth-guard";
import type {
  NotificationItem,
  User,
  ViewingRequest,
  WatchListingItem,
  WatchVariantItem,
} from "@/lib/types";

export default function GaragePage() {
  const ready = useRequireLogin("/garage");
  const [user, setUser] = useState<User | null>(null);
  const [watchVariants, setWatchVariants] = useState<WatchVariantItem[]>([]);
  const [watchListings, setWatchListings] = useState<WatchListingItem[]>([]);
  const [inbox, setInbox] = useState<ViewingRequest[]>([]);
  const [outbox, setOutbox] = useState<ViewingRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  if (!ready) return null;

  async function load() {
    setMessage("");
    try {
      const [me, variants, listings, inboxRes, outboxRes, notificationsRes] =
        await Promise.all([
          authApi.me(),
          watchlistApi.watchedVariants(),
          watchlistApi.savedListings(),
          requestsApi.inbox(),
          requestsApi.outbox(),
          notificationsApi.list(),
        ]);

      setUser(me.user);
      setWatchVariants(variants.items);
      setWatchListings(listings.items);
      setInbox(inboxRes.items);
      setOutbox(outboxRes.items);
      setNotifications(notificationsRes.items);
    } catch (error) {
      setTone("error");
      setMessage(
        error instanceof Error ? error.message : "Could not load garage. Login first."
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: number) {
    try {
      await notificationsApi.markRead(id);
      setTone("success");
      setMessage(`Notification ${id} marked as read.`);
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Mark read failed");
    }
  }

  async function accept(requestId: number) {
    try {
      await requestsApi.updateStatus(requestId, "accepted");
      setTone("success");
      setMessage(`Request ${requestId} accepted.`);
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function reject(requestId: number) {
    try {
      await requestsApi.updateStatus(requestId, "rejected");
      setTone("success");
      setMessage(`Request ${requestId} rejected.`);
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function cancel(requestId: number) {
    try {
      await requestsApi.updateStatus(requestId, "cancelled");
      setTone("success");
      setMessage(`Request ${requestId} cancelled.`);
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Update failed");
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
                Account hub
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Garage</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Review your saved items, incoming and outgoing requests, and marketplace
                notifications from one account-first dashboard.
              </p>
            </div>

            <div className="rounded-[28px] bg-cars-primary p-5 text-white shadow-[0_18px_44px_rgba(15,45,98,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Signed in as
              </p>
              <p className="mt-2 text-2xl font-apercu-bold">{user?.name || "Loading..."}</p>
              <p className="mt-1 text-sm text-white/80">{user?.email || "Fetching account"}</p>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="section-shell p-5">
            <p className="text-sm text-cars-gray">Watched variants</p>
            <p className="mt-2 text-3xl font-apercu-bold text-cars-primary">{watchVariants.length}</p>
          </div>
          <div className="section-shell p-5">
            <p className="text-sm text-cars-gray">Saved listings</p>
            <p className="mt-2 text-3xl font-apercu-bold text-cars-primary">{watchListings.length}</p>
          </div>
          <div className="section-shell p-5">
            <p className="text-sm text-cars-gray">Inbox requests</p>
            <p className="mt-2 text-3xl font-apercu-bold text-cars-primary">{inbox.length}</p>
          </div>
          <div className="section-shell p-5">
            <p className="text-sm text-cars-gray">Notifications</p>
            <p className="mt-2 text-3xl font-apercu-bold text-cars-primary">{notifications.length}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Saved research</h2>
            <div className="mt-5">
              <p className="text-sm font-semibold text-cars-primary">Watched variant IDs</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {watchVariants.length === 0 ? (
                  <p className="text-sm text-cars-gray">No watched variants yet.</p>
                ) : (
                  watchVariants.map((item) => (
                    <span
                      key={`${item.user_id}-${item.variant_id}`}
                      className="rounded-full bg-cars-off-white px-3 py-1 text-sm font-medium text-cars-primary"
                    >
                      Variant #{item.variant_id}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold text-cars-primary">Saved listing IDs</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {watchListings.length === 0 ? (
                  <p className="text-sm text-cars-gray">No saved listings yet.</p>
                ) : (
                  watchListings.map((item) => (
                    <span
                      key={`${item.user_id}-${item.listing_id}`}
                      className="rounded-full bg-cars-off-white px-3 py-1 text-sm font-medium text-cars-primary"
                    >
                      Listing #{item.listing_id}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Notifications</h2>
            <div className="mt-5 space-y-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-cars-gray">No notifications.</p>
              ) : null}
              {notifications.map((item) => (
                <div
                  key={item.notification_id}
                  className="rounded-[22px] border border-cars-gray-light/70 p-4"
                >
                  <p className="text-sm font-semibold text-cars-primary">
                    {item.title || "Notification"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-cars-gray">{item.body || "-"}</p>
                  <p className="mt-2 text-xs text-cars-gray">
                    {item.status} • #{item.notification_id} • {toDateTime(item.created_at)}
                  </p>
                  {item.status !== "read" ? (
                    <button
                      type="button"
                      onClick={() => markRead(item.notification_id)}
                      className="mt-3 rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary"
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Request inbox</h2>
            <div className="mt-5 space-y-3">
              {inbox.length === 0 ? <p className="text-sm text-cars-gray">No inbox requests.</p> : null}
              {inbox.map((item) => (
                <div
                  key={item.request_id}
                  className="rounded-[22px] border border-cars-gray-light/70 p-4 text-sm"
                >
                  <p className="font-semibold text-cars-primary">
                    Request #{item.request_id} • Listing #{item.listing_id}
                  </p>
                  <p className="mt-2 text-cars-gray">{item.message || "-"}</p>
                  <p className="mt-2 text-xs text-cars-gray">
                    {item.status} • {toDateTime(item.created_at)}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => accept(item.request_id)}
                      className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(item.request_id)}
                      className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-shell p-6">
            <h2 className="text-2xl font-apercu-bold text-cars-primary">Request outbox</h2>
            <div className="mt-5 space-y-3">
              {outbox.length === 0 ? <p className="text-sm text-cars-gray">No outbox requests.</p> : null}
              {outbox.map((item) => (
                <div
                  key={item.request_id}
                  className="rounded-[22px] border border-cars-gray-light/70 p-4 text-sm"
                >
                  <p className="font-semibold text-cars-primary">
                    Request #{item.request_id} • Listing #{item.listing_id}
                  </p>
                  <p className="mt-2 text-cars-gray">{item.message || "-"}</p>
                  <p className="mt-2 text-xs text-cars-gray">
                    {item.status} • {toDateTime(item.created_at)}
                  </p>
                  <button
                    type="button"
                    onClick={() => cancel(item.request_id)}
                    className="mt-4 rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
