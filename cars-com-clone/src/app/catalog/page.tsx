"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import EmptyState from "@/components/common/EmptyState";
import VariantCard from "@/components/cards/VariantCard";
import { catalogApi, watchlistApi } from "@/lib/carvista-api";
import type { VariantListItem } from "@/lib/types";

export default function CatalogPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<VariantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [savedIds, setSavedIds] = useState<number[]>([]);

  async function load(search = "") {
    setLoading(true);
    setMessage("");
    try {
      const [variants, watched] = await Promise.allSettled([
        catalogApi.variants(search ? { q: search } : undefined),
        watchlistApi.watchedVariants(),
      ]);

      if (variants.status === "fulfilled") {
        setItems(variants.value.items);
      } else {
        throw variants.reason;
      }

      if (watched.status === "fulfilled") {
        setSavedIds(watched.value.items.map((x) => x.variant_id));
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await load(q);
  }

  async function toggleSave(variantId: number) {
    try {
      if (savedIds.includes(variantId)) {
        await watchlistApi.unsaveVariant(variantId);
        setSavedIds((prev) => prev.filter((id) => id !== variantId));
        setTone("success");
        setMessage(`Variant ${variantId} removed from watchlist.`);
      } else {
        await watchlistApi.saveVariant(variantId);
        setSavedIds((prev) => [...prev, variantId]);
        setTone("success");
        setMessage(`Variant ${variantId} saved.`);
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  const countLabel = useMemo(() => `${items.length} variants`, [items.length]);

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Catalog</h1>
            <p className="text-sm text-slate-600">{countLabel}</p>
          </div>

          <form onSubmit={onSearch} className="flex gap-2">
            <input
              className="min-w-[280px] rounded border px-3 py-2"
              placeholder="Search make / model / trim"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="rounded bg-purple-800 px-4 py-2 text-white" type="submit">
              Search
            </button>
          </form>
        </div>

        <div className="mb-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        {loading ? <p>Loading catalog...</p> : null}

        {!loading && items.length === 0 ? (
          <EmptyState
            title="No variants found"
            description="Kiểm tra lại seed data hoặc từ khóa tìm kiếm."
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <VariantCard
              key={item.variant_id}
              item={item}
              saved={savedIds.includes(item.variant_id)}
              onToggleSave={toggleSave}
            />
          ))}
        </div>
      </main>
    </>
  );
}
