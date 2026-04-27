"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { buildListingFilterOptions } from "@/components/listings/listing-utils";
import Header from "@/components/layout/Header";
import { apiFetch } from "@/lib/api-client";
import type { Listing } from "@/lib/types";

type SearchDraft = {
  query: string;
  make: string;
  bodyType: string;
  fuelType: string;
};

type Shortcut = {
  key: string;
  label: string;
  description: string;
  filters: Partial<SearchDraft> & {
    maxPrice?: string;
  };
};

function formatLabel(value: string) {
  const uppercaseTokens = new Map([
    ["suv", "SUV"],
    ["mpv", "MPV"],
    ["ev", "EV"],
  ]);

  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();
      return uppercaseTokens.get(normalized) ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function rankValues(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function formatBodyShortcutLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "suv") return "SUVs";
  if (normalized === "mpv") return "MPVs";
  if (normalized === "ev") return "EVs";
  return `${formatLabel(value)}s`;
}

function formatFuelShortcutLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "electric") return "Electric cars";
  if (normalized === "hybrid") return "Hybrid cars";
  return `${formatLabel(value)} cars`;
}

function buildDynamicShortcuts(items: Listing[]): Shortcut[] {
  const shortcuts: Shortcut[] = [];
  const seen = new Set<string>();
  const makeCounts = rankValues(items.map((item) => item.make_name));
  const bodyCounts = rankValues(items.map((item) => item.body_type));
  const fuelCounts = rankValues(items.map((item) => item.fuel_type));
  const budgetCount = items.filter((item) => Number(item.asking_price) <= 500_000_000).length;

  function pushShortcut(shortcut: Shortcut | null) {
    if (!shortcut || seen.has(shortcut.key)) return;
    seen.add(shortcut.key);
    shortcuts.push(shortcut);
  }

  if (makeCounts[0]) {
    pushShortcut({
      key: `make:${makeCounts[0].value}`,
      label: makeCounts[0].value,
      description: `${makeCounts[0].count} active ${makeCounts[0].value} listings available now.`,
      filters: { make: makeCounts[0].value },
    });
  }

  if (bodyCounts[0]) {
    pushShortcut({
      key: `body:${bodyCounts[0].value}`,
      label: formatBodyShortcutLabel(bodyCounts[0].value),
      description: `${bodyCounts[0].count} ${formatBodyShortcutLabel(
        bodyCounts[0].value
      ).toLowerCase()} currently on the marketplace.`,
      filters: { bodyType: bodyCounts[0].value },
    });
  }

  const preferredFuel =
    fuelCounts.find((item) => ["hybrid", "electric"].includes(item.value.toLowerCase())) ??
    fuelCounts[0];

  if (preferredFuel) {
    pushShortcut({
      key: `fuel:${preferredFuel.value}`,
      label: formatFuelShortcutLabel(preferredFuel.value),
      description: `${preferredFuel.count} active listings match this fuel type right now.`,
      filters: { fuelType: preferredFuel.value },
    });
  }

  if (budgetCount > 0) {
    pushShortcut({
      key: "budget:500m",
      label: "Under 500M",
      description: `${budgetCount} active listings currently fall under this budget.`,
      filters: { maxPrice: "500000000" },
    });
  }

  if (shortcuts.length < 4 && makeCounts[1]) {
    pushShortcut({
      key: `make:${makeCounts[1].value}`,
      label: makeCounts[1].value,
      description: `${makeCounts[1].count} active ${makeCounts[1].value} listings ready to browse.`,
      filters: { make: makeCounts[1].value },
    });
  }

  if (shortcuts.length < 4 && bodyCounts[1]) {
    pushShortcut({
      key: `body:${bodyCounts[1].value}`,
      label: formatBodyShortcutLabel(bodyCounts[1].value),
      description: `${bodyCounts[1].count} ${formatBodyShortcutLabel(
        bodyCounts[1].value
      ).toLowerCase()} currently available.`,
      filters: { bodyType: bodyCounts[1].value },
    });
  }

  return shortcuts.slice(0, 4);
}

function CatalogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAssistant } = useAiAssistant();
  const [availableListings, setAvailableListings] = useState<Listing[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const searchQuery = searchParams.get("query") || searchParams.get("q") || "";
  const searchMake = searchParams.get("make") || "";
  const searchBodyType = searchParams.get("bodyType") || "";
  const searchFuelType = searchParams.get("fuelType") || searchParams.get("fuel") || "";

  const [draft, setDraft] = useState<SearchDraft>({
    query: searchQuery,
    make: searchMake,
    bodyType: searchBodyType,
    fuelType: searchFuelType,
  });

  useEffect(() => {
    setDraft({
      query: searchQuery,
      make: searchMake,
      bodyType: searchBodyType,
      fuelType: searchFuelType,
    });
  }, [searchBodyType, searchFuelType, searchMake, searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setLoadingInventory(true);
      setInventoryError("");

      try {
        const response = await apiFetch<{ items: Listing[] }>("/listings?status=active&limit=1000");
        if (cancelled) return;
        setAvailableListings(response.items);
      } catch (error) {
        if (cancelled) return;
        setInventoryError(
          error instanceof Error
            ? error.message
            : "Could not load live marketplace data right now."
        );
        setAvailableListings([]);
      } finally {
        if (!cancelled) {
          setLoadingInventory(false);
        }
      }
    }

    void loadInventory();

    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(
    () => buildListingFilterOptions(availableListings),
    [availableListings]
  );

  const shortcuts = useMemo(
    () => buildDynamicShortcuts(availableListings),
    [availableListings]
  );

  const availabilityMessage = useMemo(() => {
    if (loadingInventory) {
      return {
        title: "Checking live inventory",
        description: "Loading the brands and categories that are actually available right now.",
      };
    }

    if (inventoryError) {
      return {
        title: "Live suggestions are unavailable right now",
        description: inventoryError,
      };
    }

    if (availableListings.length === 0) {
      return {
        title: "No live listings to feature yet",
        description:
          "Featured filters stay hidden until there are active marketplace cars to back them up.",
      };
    }

    return {
      title: `${availableListings.length} active listings ready to browse`,
      description: `Showing ${filterOptions.makes.length} brands, ${filterOptions.bodyTypes.length} body styles, and ${filterOptions.fuelTypes.length} fuel types backed by live inventory.`,
    };
  }, [availableListings, filterOptions, inventoryError, loadingInventory]);

  function buildListingsHref(nextDraft: SearchDraft, extra?: { maxPrice?: string }) {
    const params = new URLSearchParams();

    if (nextDraft.query.trim()) params.set("query", nextDraft.query.trim());
    if (nextDraft.make) params.set("make", nextDraft.make);
    if (nextDraft.bodyType) params.set("bodyType", nextDraft.bodyType);
    if (nextDraft.fuelType) params.set("fuelType", nextDraft.fuelType);
    if (extra?.maxPrice) params.set("maxPrice", extra.maxPrice);

    const serialized = params.toString();
    return serialized ? `/listings?${serialized}` : "/listings";
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    router.push(buildListingsHref(draft));
  }

  function applyShortcut(shortcut: Shortcut) {
    const nextDraft: SearchDraft = {
      query: shortcut.filters.query ?? "",
      make: shortcut.filters.make ?? "",
      bodyType: shortcut.filters.bodyType ?? "",
      fuelType: shortcut.filters.fuelType ?? "",
    };

    setDraft(nextDraft);
    router.push(buildListingsHref(nextDraft, { maxPrice: shortcut.filters.maxPrice }));
  }

  return (
    <main className="container-cars py-6 sm:py-8">
      <section className="section-shell overflow-hidden border-white/10 bg-[linear-gradient(135deg,rgba(14,20,31,0.98),rgba(12,18,27,0.98),rgba(18,27,42,0.94))] p-5 sm:p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8fb4ff]">
              Search by model
            </p>
            <h1 className="mt-2 text-3xl font-apercu-bold text-slate-50 sm:text-4xl">
              Catalog
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Search by make, model, or keyword, then jump straight into cars that are currently
              for sale.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7de2ff]">
              Live right now
            </p>
            <p className="mt-2 text-lg font-apercu-bold text-slate-50">
              {availabilityMessage.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {availabilityMessage.description}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.35fr_repeat(3,minmax(0,0.7fr))]"
        >
          <input
            className="h-12 rounded-full border border-white/10 bg-[#0d141f] px-5 text-sm text-white outline-none transition focus:border-[#8fb4ff] focus:ring-2 focus:ring-[#8fb4ff]/20 placeholder:text-slate-500 md:col-span-2 xl:col-span-1"
            placeholder="Search make, model, trim, or keyword"
            value={draft.query}
            onChange={(event) => setDraft((current) => ({ ...current, query: event.target.value }))}
          />
          <select
            value={draft.make}
            onChange={(event) => setDraft((current) => ({ ...current, make: event.target.value }))}
            disabled={loadingInventory || filterOptions.makes.length === 0}
            className="h-12 rounded-full border border-white/10 bg-[#0d141f] px-5 text-sm text-white outline-none transition focus:border-[#8fb4ff] focus:ring-2 focus:ring-[#8fb4ff]/20"
          >
            <option value="">Any brand</option>
            {filterOptions.makes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
          <select
            value={draft.bodyType}
            onChange={(event) =>
              setDraft((current) => ({ ...current, bodyType: event.target.value }))
            }
            disabled={loadingInventory || filterOptions.bodyTypes.length === 0}
            className="h-12 rounded-full border border-white/10 bg-[#0d141f] px-5 text-sm text-white outline-none transition focus:border-[#8fb4ff] focus:ring-2 focus:ring-[#8fb4ff]/20"
          >
            <option value="">Any body style</option>
            {filterOptions.bodyTypes.map((bodyType) => (
              <option key={bodyType} value={bodyType}>
                {formatLabel(bodyType)}
              </option>
            ))}
          </select>
          <select
            value={draft.fuelType}
            onChange={(event) =>
              setDraft((current) => ({ ...current, fuelType: event.target.value }))
            }
            disabled={loadingInventory || filterOptions.fuelTypes.length === 0}
            className="h-12 rounded-full border border-white/10 bg-[#0d141f] px-5 text-sm text-white outline-none transition focus:border-[#8fb4ff] focus:ring-2 focus:ring-[#8fb4ff]/20"
          >
            <option value="">Any fuel type</option>
            {filterOptions.fuelTypes.map((fuelType) => (
              <option key={fuelType} value={fuelType}>
                {formatLabel(fuelType)}
              </option>
            ))}
          </select>
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            className="editorial-button inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold text-slate-950"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              router.push(buildListingsHref(draft));
            }}
          >
            Search listings
          </button>
          <Link
            href="/listings"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
          >
            Browse all listings
          </Link>
          <button
            type="button"
            onClick={() => openAssistant()}
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10"
          >
            Ask AI for help
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-300">
          Results open in Listings so you always see cars that are actually available on the
          marketplace.
        </p>
      </section>

      {!loadingInventory && shortcuts.length > 0 ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              onClick={() => applyShortcut(shortcut)}
                className="section-shell flex h-full flex-col items-start border-white/10 bg-[linear-gradient(180deg,rgba(19,26,37,0.96),rgba(11,15,22,0.98))] p-4 text-left transition-transform hover:-translate-y-1 sm:p-5"
            >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8fb4ff]">
                Quick search
              </p>
                  <h2 className="mt-3 text-xl font-apercu-bold text-slate-50">
                {shortcut.label}
              </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{shortcut.description}</p>
                  <span className="mt-5 text-sm font-semibold text-slate-100">View listings</span>
            </button>
          ))}
        </section>
      ) : null}
    </main>
  );
}

export default function CatalogPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="container-cars py-6 text-sm text-cars-gray sm:py-8">
            Loading catalog...
          </main>
        }
      >
        <CatalogPageContent />
      </Suspense>
    </>
  );
}
