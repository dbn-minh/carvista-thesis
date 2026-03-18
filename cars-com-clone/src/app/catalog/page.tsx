"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import EmptyState from "@/components/common/EmptyState";
import VariantCard from "@/components/cards/VariantCard";
import { catalogApi, watchlistApi } from "@/lib/carvista-api";
import { hasToken } from "@/lib/api-client";
import type { VariantListItem } from "@/lib/types";

type CatalogFilters = {
  q?: string;
  make?: string;
  model?: string;
  year?: number;
  fuel?: string;
  bodyType?: string;
};

function CatalogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAuth } = useAuthModal();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<VariantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const searchKey = searchParams.toString();
  const filters = useMemo<CatalogFilters>(() => {
    const yearValue = searchParams.get("year");
    return {
      q: searchParams.get("q") || "",
      make: searchParams.get("make") || undefined,
      model: searchParams.get("model") || undefined,
      fuel: searchParams.get("fuel") || undefined,
      bodyType: searchParams.get("bodyType") || undefined,
      year: yearValue ? Number(yearValue) : undefined,
    };
  }, [searchKey, searchParams]);

  async function load(activeFilters: CatalogFilters) {
    setLoading(true);
    setMessage("");
    try {
      const watchedPromise = hasToken()
        ? watchlistApi.watchedVariants()
        : Promise.resolve({ items: [] as Array<{ variant_id: number }> });

      const [variants, watched] = await Promise.allSettled([
        catalogApi.variants(activeFilters),
        watchedPromise,
      ]);

      if (variants.status === "fulfilled") {
        setItems(variants.value.items);
      } else {
        throw variants.reason;
      }

      if (watched.status === "fulfilled") {
        setSavedIds(watched.value.items.map((x) => x.variant_id));
      } else {
        setSavedIds([]);
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQ(filters.q || "");
    load(filters);
  }, [filters]);

  function buildUrl(next: URLSearchParams) {
    const serialized = next.toString();
    return serialized ? `/catalog?${serialized}` : "/catalog";
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchKey);
    const normalized = q.trim();
    if (normalized) {
      next.set("q", normalized);
    } else {
      next.delete("q");
    }
    router.push(buildUrl(next));
  }

  function applyFilter(key: "bodyType" | "fuel", value: string) {
    const next = new URLSearchParams(searchKey);
    next.set(key, value);
    router.push(buildUrl(next));
  }

  function clearFilters() {
    router.push("/catalog");
  }

  async function toggleSave(variantId: number) {
    if (!hasToken()) {
      openAuth({ mode: "login", next: "/catalog" });
      return;
    }

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
  const activeFilters = [
    filters.q ? `Search: ${filters.q}` : null,
    filters.bodyType ? `Body: ${filters.bodyType}` : null,
    filters.fuel ? `Fuel: ${filters.fuel}` : null,
  ].filter(Boolean);

  return (
    <main className="container-cars py-8">
      <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(233,241,255,0.9),rgba(255,255,255,1))] p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
              Vehicle research
            </p>
            <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Catalog</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
              Search real makes, models, trims, and price points from the current CarVista
              database. Save interesting variants to your Garage once you log in.
            </p>
          </div>

          <div className="rounded-[24px] bg-white px-5 py-4 shadow-[0_18px_40px_rgba(15,45,98,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
              Current result set
            </p>
            <p className="mt-2 text-2xl font-apercu-bold text-cars-primary">{countLabel}</p>
            <p className="mt-1 text-sm text-cars-gray">Filtered directly from Home or this page.</p>
          </div>
        </div>

        <form onSubmit={onSearch} className="mt-8 flex flex-col gap-3 lg:flex-row">
          <input
            className="h-12 min-w-[280px] flex-1 rounded-full border border-cars-gray-light bg-white px-5 text-sm text-cars-primary"
            placeholder="Search make, model, trim, or EV"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="h-12 rounded-full bg-cars-primary px-6 text-sm font-semibold text-white"
            type="submit"
          >
            Search catalog
          </button>
          <button
            type="button"
            onClick={() => {
              if (!hasToken()) {
                openAuth({ mode: "login", next: "/ai" });
                return;
              }
              router.push("/ai");
            }}
            className="inline-flex h-12 items-center justify-center rounded-full border border-cars-primary/15 px-6 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
          >
            Open AI tools
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyFilter("bodyType", "suv")}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-cars-primary shadow-sm"
          >
            SUVs
          </button>
          <button
            type="button"
            onClick={() => applyFilter("bodyType", "sedan")}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-cars-primary shadow-sm"
          >
            Sedans
          </button>
          <button
            type="button"
            onClick={() => applyFilter("fuel", "hybrid")}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-cars-primary shadow-sm"
          >
            Hybrid
          </button>
          <button
            type="button"
            onClick={() => applyFilter("fuel", "electric")}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-cars-primary shadow-sm"
          >
            Electric
          </button>
          {activeFilters.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-medium text-cars-primary"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {activeFilters.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeFilters.map((item) => (
              <span
                key={item}
                className="rounded-full bg-cars-primary px-3 py-1 text-sm font-medium text-white"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="mt-6">
        <StatusBanner tone={tone}>{message}</StatusBanner>
      </div>

      {loading ? <p className="mt-6 text-sm text-cars-gray">Loading catalog...</p> : null}

      {!loading && items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No variants found"
            description="Try a different search term or clear the current catalog filters."
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
  );
}

export default function CatalogPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<main className="container-cars py-8 text-sm text-cars-gray">Loading catalog...</main>}>
        <CatalogPageContent />
      </Suspense>
    </>
  );
}
