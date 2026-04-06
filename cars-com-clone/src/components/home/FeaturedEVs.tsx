"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { catalogApi } from "@/lib/carvista-api";
import { toCurrency } from "@/lib/api-client";
import type { VariantListItem } from "@/lib/types";

type FeaturedCard = {
  variantId: number;
  title: string;
  subtitle: string;
  image: string | null;
  href: string;
};

type FeaturedTarget = {
  make: string;
  model: string;
  trimIncludes?: string[];
};

const FEATURED_CARD_LIMIT = 6;
const CURATED_FEATURED_TARGETS: FeaturedTarget[] = [
  { make: "Ferrari", model: "F8 Tributo" },
  { make: "McLaren", model: "720S" },
  { make: "Lamborghini", model: "Huracan", trimIncludes: ["EVO"] },
  { make: "Porsche", model: "911", trimIncludes: ["Turbo S"] },
  { make: "Audi", model: "R8", trimIncludes: ["V10 Performance"] },
  { make: "Lamborghini", model: "Urus" },
  { make: "Aston Martin", model: "Vantage" },
  { make: "Mercedes-Benz", model: "AMG GT", trimIncludes: ["R"] },
  { make: "BMW", model: "M4", trimIncludes: ["Competition"] },
  { make: "Nissan", model: "GT-R" },
  { make: "Chevrolet", model: "Corvette", trimIncludes: ["Z06"] },
  { make: "Lexus", model: "LC", trimIncludes: ["500"] },
];

function getImageUrl(image: Record<string, unknown>): string | null {
  const value = image.url ?? image.image_url ?? image.src ?? image.image;
  return typeof value === "string" && value ? value : null;
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFamilyKey(item: VariantListItem) {
  return `${normalizeText(item.make_name)}::${normalizeText(item.model_name)}`;
}

function formatLabel(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;

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

function compareFeaturedVariants(left: VariantListItem, right: VariantListItem) {
  const leftPrice = Number(left.msrp_base ?? 0);
  const rightPrice = Number(right.msrp_base ?? 0);

  return (
    rightPrice - leftPrice ||
    (right.model_year ?? 0) - (left.model_year ?? 0) ||
    (right.variant_id ?? 0) - (left.variant_id ?? 0)
  );
}

function matchesTarget(item: VariantListItem, target: FeaturedTarget) {
  if (normalizeText(item.make_name) !== normalizeText(target.make)) return false;
  if (normalizeText(item.model_name) !== normalizeText(target.model)) return false;
  if (!target.trimIncludes?.length) return true;

  const normalizedTrim = normalizeText(item.trim_name);
  return target.trimIncludes.some((token) => normalizedTrim.includes(normalizeText(token)));
}

function pickCuratedVariants(items: VariantListItem[]) {
  const selected: VariantListItem[] = [];
  const usedFamilies = new Set<string>();

  for (const target of CURATED_FEATURED_TARGETS) {
    const bestMatch = items
      .filter((item) => !usedFamilies.has(buildFamilyKey(item)) && matchesTarget(item, target))
      .sort(compareFeaturedVariants)[0];

    if (!bestMatch) continue;

    selected.push(bestMatch);
    usedFamilies.add(buildFamilyKey(bestMatch));

    if (selected.length === FEATURED_CARD_LIMIT) {
      return selected;
    }
  }

  const fallback = [...items]
    .filter((item) => !usedFamilies.has(buildFamilyKey(item)))
    .sort(compareFeaturedVariants);

  for (const item of fallback) {
    const familyKey = buildFamilyKey(item);
    if (usedFamilies.has(familyKey)) continue;

    selected.push(item);
    usedFamilies.add(familyKey);

    if (selected.length === FEATURED_CARD_LIMIT) {
      break;
    }
  }

  return selected;
}

function buildTitle(item: VariantListItem) {
  return `${item.make_name} ${item.model_name} ${item.trim_name || ""}`.trim();
}

function buildSubtitle(item: VariantListItem) {
  const meta = [
    item.model_year ? String(item.model_year) : null,
    formatLabel(item.body_type, "Body type pending"),
    item.msrp_base ? toCurrency(item.msrp_base) : formatLabel(item.fuel_type, "Fuel pending"),
  ].filter(Boolean);

  return meta.join(" • ");
}

export default function FeaturedEVs() {
  const [cards, setCards] = useState<FeaturedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await catalogApi.variants();
        const source = pickCuratedVariants(response.items);

        const enriched = await Promise.all(
          source.map(async (item) => {
            try {
              const detail = await catalogApi.variantDetail(item.variant_id);
              const image =
                detail.images.map(getImageUrl).find((value): value is string => Boolean(value)) ||
                null;

              return {
                variantId: item.variant_id,
                title: buildTitle(item),
                subtitle: buildSubtitle(item),
                image,
                href: `/catalog/${item.variant_id}`,
              };
            } catch {
              return {
                variantId: item.variant_id,
                title: buildTitle(item),
                subtitle: buildSubtitle(item),
                image: null,
                href: `/catalog/${item.variant_id}`,
              };
            }
          })
        );

        setCards(enriched);
      } catch (error) {
        setCards([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Featured vehicles are temporarily unavailable."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <section className="py-10">
      <div className="container-cars">
        <div className="section-shell p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Featured showroom
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                Curated standout cars
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                A fixed lineup of halo cars, supercars, and premium performance models currently
                backed by the CarVista catalog.
              </p>
            </div>

            <Link
              href="/catalog"
              className="inline-flex rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
            >
              Browse catalog
            </Link>
          </div>

          {loading ? <p className="text-sm text-cars-gray">Loading featured cars...</p> : null}

          {!loading && errorMessage ? (
            <div className="rounded-[24px] border border-cars-accent/15 bg-white px-5 py-4 text-sm leading-6 text-cars-gray shadow-[0_16px_34px_rgba(15,45,98,0.08)]">
              <p className="font-semibold text-cars-primary">
                Featured vehicles are unavailable right now.
              </p>
              <p className="mt-2">{errorMessage}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((item) => (
              <Link
                key={item.variantId}
                href={item.href}
                className="group overflow-hidden rounded-[28px] border border-cars-gray-light/80 bg-white transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_18px_42px_rgba(15,45,98,0.12)]"
              >
                {item.image ? (
                  <div className="h-52 w-full overflow-hidden bg-[linear-gradient(180deg,rgba(233,241,255,0.9),rgba(255,255,255,1))]">
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-52 w-full items-center justify-center bg-[linear-gradient(180deg,rgba(233,241,255,0.9),rgba(255,255,255,1))] px-8 text-center text-sm font-semibold text-cars-primary">
                    Catalog placeholder image
                  </div>
                )}
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                    Curated performance pick
                  </p>
                  <h3 className="mt-3 text-xl font-apercu-bold text-cars-primary">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-cars-gray">{item.subtitle}</p>
                  <span className="mt-5 inline-flex text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                    View details
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
