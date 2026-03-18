"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import JsonPreview from "@/components/common/JsonPreview";
import {
  authApi,
  notificationsApi,
  requestsApi,
  watchlistApi,
} from "@/lib/carvista-api";
import { toDateTime } from "@/lib/api-client";
import type {
  NotificationItem,
  User,
  ViewingRequest,
  WatchListingItem,
  WatchVariantItem,
} from "@/lib/types";

export default function GaragePage() {
  const [user, setUser] = useState<User | null>(null);
  const [watchVariants, setWatchVariants] = useState<WatchVariantItem[]>([]);
  const [watchListings, setWatchListings] = useState<WatchListingItem[]>([]);
  const [inbox, setInbox] = useState<ViewingRequest[]>([]);
  const [outbox, setOutbox] = useState<ViewingRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

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
        <h1 className="mb-6 text-3xl font-bold">Garage</h1>
        <div className="mb-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border p-4">
            <p className="text-sm text-slate-500">User</p>
            <p className="mt-2 text-2xl font-semibold">{user?.name || "-"}</p>
          </div>
          <div className="rounded-2xl border p-4">
            <p className="text-sm text-slate-500">Watched variants</p>
            <p className="mt-2 text-2xl font-semibold">{watchVariants.length}</p>
          </div>
          <div className="rounded-2xl border p-4">
            <p className="text-sm text-slate-500">Saved listings</p>
            <p className="mt-2 text-2xl font-semibold">{watchListings.length}</p>
          </div>
          <div className="rounded-2xl border p-4">
            <p className="text-sm text-slate-500">Notifications</p>
            <p className="mt-2 text-2xl font-semibold">{notifications.length}</p>
          </div>
        </section>

        <section className="mb-8 grid gap-6 md:grid-cols-2">
          <JsonPreview title="Current user" data={user} />
          <JsonPreview title="Watchlist snapshot" data={{ watchVariants, watchListings }} />
        </section>

        <section className="mb-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <h2 className="mb-3 text-xl font-semibold">Request inbox</h2>
            <div className="space-y-3">
              {inbox.length === 0 ? <p className="text-sm text-slate-600">No inbox requests.</p> : null}
              {inbox.map((item) => (
                <div key={item.request_id} className="rounded border p-3 text-sm">
                  <p>
                    request_id={item.request_id} • listing_id={item.listing_id} • status={item.status}
                  </p>
                  <p className="mt-1">{item.message || "-"}</p>
                  <p className="mt-1 text-slate-500">created: {toDateTime(item.created_at)}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => accept(item.request_id)}
                      className="rounded bg-green-700 px-3 py-1 text-sm text-white"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(item.request_id)}
                      className="rounded bg-red-700 px-3 py-1 text-sm text-white"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <h2 className="mb-3 text-xl font-semibold">Request outbox</h2>
            <div className="space-y-3">
              {outbox.length === 0 ? <p className="text-sm text-slate-600">No outbox requests.</p> : null}
              {outbox.map((item) => (
                <div key={item.request_id} className="rounded border p-3 text-sm">
                  <p>
                    request_id={item.request_id} • listing_id={item.listing_id} • status={item.status}
                  </p>
                  <p className="mt-1">{item.message || "-"}</p>
                  <p className="mt-1 text-slate-500">created: {toDateTime(item.created_at)}</p>
                  <button
                    type="button"
                    onClick={() => cancel(item.request_id)}
                    className="mt-3 rounded border px-3 py-1 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border p-4">
          <h2 className="mb-3 text-xl font-semibold">Notifications</h2>
          <div className="space-y-3">
            {notifications.length === 0 ? <p className="text-sm text-slate-600">No notifications.</p> : null}
            {notifications.map((item) => (
              <div key={item.notification_id} className="rounded border p-3">
                <p className="text-sm font-medium">{item.title || "Notification"}</p>
                <p className="mt-1 text-sm">{item.body || "-"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  status={item.status} • id={item.notification_id} • created={toDateTime(item.created_at)}
                </p>
                {item.status !== "read" ? (
                  <button
                    type="button"
                    onClick={() => markRead(item.notification_id)}
                    className="mt-3 rounded border px-3 py-1 text-sm"
                  >
                    Mark as read
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
