"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { catalogApi } from "@/lib/carvista-api";
import type { VariantListItem } from "@/lib/types";

type FeaturedCard = {
  variantId: number;
  title: string;
  subtitle: string;
  image: string | null;
  href: string;
};

function getImageUrl(image: Record<string, unknown>): string | null {
  const value = image.url ?? image.image_url ?? image.src ?? image.image;
  return typeof value === "string" && value ? value : null;
}

function buildTitle(item: VariantListItem) {
  return `${item.make_name} ${item.model_name} ${item.trim_name || ""}`.trim();
}

function buildSubtitle(item: VariantListItem) {
  return `${item.model_year} - ${item.body_type || "Body type pending"} - ${
    item.fuel_type || "Fuel pending"
  }`;
}

export default function FeaturedEVs() {
  const { openAssistant } = useAiAssistant();
  const [cards, setCards] = useState<FeaturedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasElectricCars, setHasElectricCars] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage("");
      setHasElectricCars(false);

      try {
        const electric = await catalogApi.variants({ fuel: "electric" });
        let source = electric.items.slice(0, 6);

        if (source.length === 0) {
          const fallback = await catalogApi.variants();
          source = fallback.items.slice(0, 6);
        } else {
          setHasElectricCars(true);
        }

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

  const heading = useMemo(
    () =>
      hasElectricCars
        ? {
            eyebrow: "Live EV spotlight",
            title: "Featured electric cars already present in the current catalog",
            description:
              "This section now prioritizes real EV records from your database and falls back to other catalog vehicles only when EV data has not been seeded yet.",
            cta: "/catalog?fuel=electric",
            ctaLabel: "Browse EV research",
          }
        : {
            eyebrow: "Featured research picks",
            title: "Real vehicles from the current CarVista database",
            description:
              "Instead of showing hard-coded models that may not exist in the database, Home now surfaces catalog entries that actually exist today.",
            cta: "/catalog",
            ctaLabel: "Browse the catalog",
          },
    [hasElectricCars]
  );

  return (
    <section className="py-10">
      <div className="container-cars">
        <div className="section-shell p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                {heading.eyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">{heading.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                {heading.description}
              </p>
            </div>

            <Link
              href={heading.cta}
              className="inline-flex rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
            >
              {heading.ctaLabel}
            </Link>
          </div>

          {loading ? <p className="text-sm text-cars-gray">Loading featured vehicles...</p> : null}

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
                    Image not seeded yet for this featured car
                  </div>
                )}
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                    Variant #{item.variantId}
                  </p>
                  <h3 className="mt-3 text-xl font-apercu-bold text-cars-primary">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-cars-gray">{item.subtitle}</p>
                  <span className="mt-5 inline-flex text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                    Open vehicle details
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={heading.cta}
              className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
            >
              {heading.ctaLabel}
            </Link>
            <button
              type="button"
              onClick={() => {
                openAssistant();
              }}
              className="rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
            >
              Use AI compare and TCO
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
