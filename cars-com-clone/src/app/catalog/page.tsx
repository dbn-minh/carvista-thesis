"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import Header from "@/components/layout/Header";

type SearchDraft = {
  query: string;
  make: string;
  bodyType: string;
  fuelType: string;
};

type Shortcut = {
  label: string;
  description: string;
  filters: Partial<SearchDraft> & {
    maxPrice?: string;
  };
};

const brandOptions = ["Toyota", "Honda", "Mazda", "Hyundai", "Ford", "BMW", "Mercedes-Benz"];
const bodyTypeOptions = ["suv", "sedan", "hatchback", "pickup", "mpv"];
const fuelTypeOptions = ["gasoline", "hybrid", "electric", "diesel"];

const shortcuts: Shortcut[] = [
  {
    label: "Family SUVs",
    description: "Space, comfort, and easy daily usability.",
    filters: { query: "family", bodyType: "suv" },
  },
  {
    label: "City commuters",
    description: "Smaller cars that are easy to park and run.",
    filters: { query: "commuter", bodyType: "hatchback" },
  },
  {
    label: "Hybrid picks",
    description: "Lower fuel bills without going fully electric.",
    filters: { fuelType: "hybrid" },
  },
  {
    label: "Under 500M",
    description: "Browse active listings in a tighter budget band.",
    filters: { maxPrice: "500000000" },
  },
];

function formatLabel(value: string) {
  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function CatalogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { openAssistant } = useAiAssistant();

  const initialDraft = useMemo<SearchDraft>(
    () => ({
      query: searchParams.get("query") || searchParams.get("q") || "",
      make: searchParams.get("make") || "",
      bodyType: searchParams.get("bodyType") || "",
      fuelType: searchParams.get("fuelType") || searchParams.get("fuel") || "",
    }),
    [searchKey]
  );

  const [draft, setDraft] = useState<SearchDraft>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

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
      query: shortcut.filters.query ?? draft.query,
      make: shortcut.filters.make ?? draft.make,
      bodyType: shortcut.filters.bodyType ?? draft.bodyType,
      fuelType: shortcut.filters.fuelType ?? draft.fuelType,
    };

    setDraft(nextDraft);
    router.push(buildListingsHref(nextDraft, { maxPrice: shortcut.filters.maxPrice }));
  }

  return (
    <main className="container-cars py-8">
      <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(233,241,255,0.9),rgba(255,255,255,1))] p-6 md:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
              Search by model
            </p>
            <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Catalog</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
              Search by make, model, or keyword, then jump straight into cars that are currently for sale.
            </p>
          </div>

          <div className="rounded-[24px] bg-white px-5 py-4 shadow-[0_18px_40px_rgba(15,45,98,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
              How it works
            </p>
            <p className="mt-2 text-lg font-apercu-bold text-cars-primary">
              Search here. Shop in Listings.
            </p>
            <p className="mt-2 text-sm leading-6 text-cars-gray">
              Catalog is now a quick way into the live marketplace, not a second results page.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-3 xl:grid-cols-[1.35fr_repeat(3,minmax(0,0.7fr))]">
          <input
            className="h-12 rounded-full border border-cars-gray-light bg-white px-5 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="Search make, model, trim, or keyword"
            value={draft.query}
            onChange={(event) => setDraft((current) => ({ ...current, query: event.target.value }))}
          />
          <select
            value={draft.make}
            onChange={(event) => setDraft((current) => ({ ...current, make: event.target.value }))}
            className="h-12 rounded-full border border-cars-gray-light bg-white px-5 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
          >
            <option value="">Any brand</option>
            {brandOptions.map((make) => (
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
            className="h-12 rounded-full border border-cars-gray-light bg-white px-5 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
          >
            <option value="">Any body style</option>
            {bodyTypeOptions.map((bodyType) => (
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
            className="h-12 rounded-full border border-cars-gray-light bg-white px-5 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
          >
            <option value="">Any fuel type</option>
            {fuelTypeOptions.map((fuelType) => (
              <option key={fuelType} value={fuelType}>
                {formatLabel(fuelType)}
              </option>
            ))}
          </select>
        </form>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="h-12 rounded-full bg-cars-primary px-6 text-sm font-semibold text-white"
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
            className="inline-flex h-12 items-center justify-center rounded-full border border-cars-primary/15 px-6 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
          >
            Browse all listings
          </Link>
          <button
            type="button"
            onClick={() => openAssistant()}
            className="inline-flex h-12 items-center justify-center rounded-full border border-cars-primary/15 px-6 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
          >
            Ask AI for help
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-cars-gray">
          Results open in Listings so you always see cars that are actually available on the marketplace.
        </p>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-4">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() => applyShortcut(shortcut)}
            className="section-shell flex flex-col items-start p-5 text-left transition-transform hover:-translate-y-1"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
              Quick search
            </p>
            <h2 className="mt-3 text-xl font-apercu-bold text-cars-primary">{shortcut.label}</h2>
            <p className="mt-2 text-sm leading-6 text-cars-gray">{shortcut.description}</p>
            <span className="mt-5 text-sm font-semibold text-cars-primary">View listings</span>
          </button>
        ))}
      </section>
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
