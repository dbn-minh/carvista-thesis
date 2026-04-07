"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ADVISOR_PROFILE_EVENT, getStoredAdvisorProfile } from "@/lib/advisor-profile";
import { catalogApi, listingsApi } from "@/lib/carvista-api";
import { toCurrency } from "@/lib/api-client";
import type {
  AiActionPath,
  AiPageIntelligenceResponse,
  AdvisorProfile,
} from "@/lib/types";

type PageIntelligencePanelProps = {
  subjectType: "variant" | "listing";
  subjectId: number;
  marketId?: number;
  ownershipYears?: number;
  kmPerYear?: number | null;
  title?: string;
  className?: string;
  hiddenSectionKeys?: string[];
  compactLayout?: boolean;
  showActionPaths?: boolean;
  showSectionCaveats?: boolean;
  showSectionSources?: boolean;
};

function formatCardValue(title: string, value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value !== "number") return value;

  const normalizedTitle = title.toLowerCase();
  if (
    /cost|price|value|estimate|monthly|yearly|depreciation|insurance|maintenance|tax|tco|fair|ask/i.test(
      normalizedTitle
    )
  ) {
    return toCurrency(value);
  }

  return new Intl.NumberFormat("vi-VN").format(value);
}

function ActionLink({ path }: { path: AiActionPath }) {
  const href = path.url;
  if (!href) return null;

  const className =
    "inline-flex items-center rounded-full border border-cars-primary/15 px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-cars-off-white";

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {path.label}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {path.label}
    </a>
  );
}

export default function PageIntelligencePanel({
  subjectType,
  subjectId,
  marketId = 1,
  ownershipYears = 5,
  kmPerYear,
  title = "AI shopping intelligence",
  className = "",
  hiddenSectionKeys = [],
  compactLayout = false,
  showActionPaths = true,
  showSectionCaveats = true,
  showSectionSources = true,
}: PageIntelligencePanelProps) {
  const [data, setData] = useState<AiPageIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<AdvisorProfile>({});

  useEffect(() => {
    const syncProfile = () => setProfile(getStoredAdvisorProfile());
    syncProfile();

    window.addEventListener(ADVISOR_PROFILE_EVENT, syncProfile);
    return () => window.removeEventListener(ADVISOR_PROFILE_EVENT, syncProfile);
  }, []);

  const profileSignature = useMemo(() => JSON.stringify(profile || {}), [profile]);
  const visibleSections = useMemo(
    () => (data?.sections ?? []).filter((section) => !hiddenSectionKeys.includes(section.key)),
    [data?.sections, hiddenSectionKeys]
  );
  const compactSourceSummary = useMemo(() => {
    const sourceProviders = [
      ...new Set(
        visibleSections
          .flatMap((section) => section.sources ?? [])
          .map((source) => source.provider)
          .filter(Boolean)
      ),
    ];
    const pillars = [
      visibleSections.some((section) => section.key === "price_outlook")
        ? "market price history"
        : null,
      visibleSections.some((section) => section.key === "ownership_cost")
        ? "ownership-cost modeling"
        : null,
      data?.subject?.profile_snapshot ? "your saved buyer profile" : null,
    ].filter(Boolean);

    if (!pillars.length && !sourceProviders.length) return null;

    return {
      title: "What this is based on",
      description: pillars.length
        ? `Built from ${pillars.join(", ")}${sourceProviders.length ? ` and sources like ${sourceProviders.slice(0, 2).join(", ")}` : ""}.`
        : `Built from sources like ${sourceProviders.slice(0, 3).join(", ")}.`,
      freshness: visibleSections.map((section) => section.freshness_note).find(Boolean) ?? null,
    };
  }, [data?.subject?.profile_snapshot, visibleSections]);

  useEffect(() => {
    if (!Number.isFinite(subjectId)) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const payload = {
          marketId,
          ownershipYears,
          ...(kmPerYear ? { kmPerYear } : {}),
          profile,
        };

        const response =
          subjectType === "variant"
            ? await catalogApi.variantInsights(subjectId, payload)
            : await listingsApi.insights(subjectId, payload);

        if (cancelled) return;
        setData(response);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "AI insights are temporarily unavailable for this vehicle."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [subjectType, subjectId, marketId, ownershipYears, kmPerYear, profileSignature]);

  return (
    <section className={`section-shell p-6 ${className}`.trim()}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
            Embedded intelligence
          </p>
          <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-cars-gray">
            Helpful previews from the same recommendation, pricing, and ownership engines used by
            the CarVista advisor.
          </p>
        </div>

        {data?.subject?.profile_snapshot ? (
          <div className="rounded-[18px] bg-cars-off-white px-4 py-3 text-sm leading-6 text-cars-primary">
            <span className="font-semibold">Using your saved profile:</span>{" "}
            {data.subject.profile_snapshot}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className={`mt-6 grid gap-4 ${compactLayout ? "md:grid-cols-2" : "xl:grid-cols-3"}`}>
          {Array.from({ length: compactLayout ? 2 : 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[26px] border border-cars-gray-light/70 bg-white px-5 py-5"
            >
              <div className="h-4 w-28 animate-pulse rounded-full bg-cars-gray-light/70" />
              <div className="mt-4 h-16 animate-pulse rounded-[20px] bg-cars-off-white" />
              <div className="mt-4 h-20 animate-pulse rounded-[20px] bg-cars-off-white" />
            </div>
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-cars-primary/20 bg-cars-off-white px-5 py-5 text-sm leading-6 text-cars-gray">
          {error}
        </div>
      ) : null}

      {!loading && !error && visibleSections.length ? (
        <>
          <div className={`mt-6 grid gap-4 ${compactLayout ? "md:grid-cols-2 xl:grid-cols-2" : "xl:grid-cols-3"}`}>
            {visibleSections.map((section) => (
            <article
              key={section.key}
              className={`rounded-[26px] border border-cars-gray-light/70 bg-white px-5 py-5 shadow-sm ${
                compactLayout ? "h-full" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                    {section.title}
                  </p>
                  {!compactLayout && section.confidence?.label ? (
                    <div className="mt-3 inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold text-cars-primary">
                      {section.confidence.label}
                    </div>
                  ) : null}
                </div>
              </div>

              <p className={`mt-4 text-sm text-cars-primary ${compactLayout ? "line-clamp-3 leading-6" : "leading-7"}`}>
                {section.assistant_message}
              </p>

              {section.insight_cards?.length ? (
                <div className={`mt-4 grid gap-3 ${compactLayout ? "md:grid-cols-2" : ""}`}>
                  {section.insight_cards.slice(0, compactLayout ? 1 : 2).map((card, index) => (
                    <div key={`${card.title}-${index}`} className="rounded-[20px] bg-cars-off-white px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        {card.title}
                      </p>
                      {card.value != null ? (
                        <p className="mt-2 text-lg font-apercu-bold text-cars-primary">
                          {formatCardValue(card.title, card.value)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm leading-6 text-cars-gray">{card.description}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {section.highlights?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {section.highlights.slice(0, compactLayout ? 2 : 3).map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-full bg-cars-off-white px-3 py-2 text-xs font-medium text-cars-primary"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              ) : null}

              {showActionPaths && section.action_paths?.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {section.action_paths.slice(0, 3).map((path) => (
                    <ActionLink key={`${path.type}-${path.url}`} path={path} />
                  ))}
                </div>
              ) : null}

              {showSectionCaveats && section.caveats?.length ? (
                <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  {section.caveats[0]}
                </div>
              ) : null}

              {showSectionSources && section.freshness_note ? (
                <p className="mt-4 text-xs leading-5 text-cars-gray">{section.freshness_note}</p>
              ) : null}
            </article>
            ))}
          </div>

          {compactLayout && compactSourceSummary ? (
            <div className="mt-4 rounded-[22px] border border-cars-primary/12 bg-cars-off-white px-5 py-4 text-sm leading-6 text-cars-gray">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                {compactSourceSummary.title}
              </p>
              <p className="mt-2 text-cars-primary">{compactSourceSummary.description}</p>
              {compactSourceSummary.freshness ? (
                <p className="mt-2 text-xs text-cars-gray">{compactSourceSummary.freshness}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
