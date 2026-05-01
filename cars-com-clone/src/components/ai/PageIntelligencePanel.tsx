"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Gauge, Medal, TriangleAlert } from "lucide-react";
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
  showCompactSourceSummary?: boolean;
  allowedActionPathTypes?: string[];
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

function compactText(value: string, maxLength = 170) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function getFitScoreTone(sectionKey: string, card: { title: string; value?: string | number | null; description?: string | null }) {
  if (sectionKey !== "fit_for_you" || card.title.toLowerCase() !== "fit score") return null;

  const numericScore = typeof card.value === "number" ? card.value : Number(card.value);
  const label = String(card.description || "").toLowerCase();

  if (numericScore >= 80 || label.includes("excellent")) {
    return {
      shell:
        "border border-emerald-200 bg-[linear-gradient(180deg,#f5fff8_0%,#edf9f1_100%)] dark:border-emerald-400/20 dark:bg-none dark:bg-emerald-500/10",
      value: "text-[#216b45] dark:text-emerald-100",
      description: "text-[#477458] dark:text-emerald-100/80",
      label: "Excellent fit",
      iconShell: "bg-emerald-100 dark:bg-emerald-400/18",
      iconColor: "text-emerald-700 dark:text-emerald-100",
      Icon: Medal,
    };
  }

  if (numericScore >= 60 || label.includes("good")) {
    return {
      shell:
        "border border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fff4dc_100%)] dark:border-amber-400/20 dark:bg-none dark:bg-amber-500/10",
      value: "text-[#7f5f00] dark:text-amber-100",
      description: "text-[#8f7642] dark:text-amber-100/80",
      label: "Good fit",
      iconShell: "bg-amber-100 dark:bg-amber-400/18",
      iconColor: "text-amber-700 dark:text-amber-100",
      Icon: Gauge,
    };
  }

  if (numericScore >= 40 || label.includes("fair") || label.includes("mixed")) {
    return {
      shell:
        "border border-orange-200 bg-[linear-gradient(180deg,#fff5eb_0%,#ffedde_100%)] dark:border-orange-400/20 dark:bg-none dark:bg-orange-500/10",
      value: "text-[#9a4f1a] dark:text-orange-100",
      description: "text-[#9c6a48] dark:text-orange-100/80",
      label: "Average fit",
      iconShell: "bg-orange-100 dark:bg-orange-400/18",
      iconColor: "text-orange-700 dark:text-orange-100",
      Icon: Gauge,
    };
  }

  return {
    shell:
      "border border-rose-200 bg-[linear-gradient(180deg,#fff4f4_0%,#ffeaea_100%)] dark:border-rose-400/20 dark:bg-none dark:bg-rose-500/10",
    value: "text-[#a13d3d] dark:text-rose-100",
    description: "text-[#8b5a5a] dark:text-rose-100/80",
    label: "Weak fit",
    iconShell: "bg-rose-100 dark:bg-rose-400/18",
    iconColor: "text-rose-700 dark:text-rose-100",
    Icon: TriangleAlert,
  };
}

function FitSignalGroup({
  title,
  items,
  tone = "good",
}: {
  title: string;
  items?: string[];
  tone?: "good" | "bad";
}) {
  if (!items?.length) return null;

  const dotTone = tone === "good" ? "bg-emerald-500 dark:bg-emerald-300" : "bg-rose-400 dark:bg-rose-300";
  const shellTone =
    tone === "good"
      ? "bg-[#f5f9ff] dark:bg-slate-900/70"
      : "border border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10";

  return (
    <div className={`h-full rounded-[18px] px-4 py-3 ${shellTone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cars-accent">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-6 text-cars-primary dark:text-white/88">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotTone}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  showCompactSourceSummary = true,
  allowedActionPathTypes,
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

  const visibleSections = useMemo(
    () => (data?.sections ?? []).filter((section) => !hiddenSectionKeys.includes(section.key)),
    [data?.sections, hiddenSectionKeys]
  );
  const compactActionPaths = useMemo(() => {
    const seen = new Set<string>();
    return visibleSections
      .flatMap((section) => section.action_paths ?? [])
      .filter((path) => !allowedActionPathTypes || allowedActionPathTypes.includes(path.type))
      .filter((path) => {
        const key = `${path.type}-${path.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }, [allowedActionPathTypes, visibleSections]);
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
  }, [subjectType, subjectId, marketId, ownershipYears, kmPerYear, profile]);

  return (
    <section className={`section-shell ${compactLayout ? "p-5 md:p-6" : "p-6"} ${className}`.trim()}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
            Embedded intelligence
          </p>
          <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-cars-gray">
            {compactLayout
              ? "Short, buyer-friendly signals from CarVista's pricing and ownership engines."
              : "Helpful previews from the same recommendation, pricing, and ownership engines used by the CarVista advisor."}
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
          {Array.from({ length: compactLayout ? 2 : 3 }, (_, index) => `skeleton-${index}`).map((key) => (
            <div
              key={key}
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
          <div className={`mt-6 grid gap-4 ${compactLayout ? "lg:grid-cols-2" : "xl:grid-cols-3"}`}>
            {visibleSections.map((section) => (
            (() => {
              const isHorizontalCompactFit = compactLayout && section.key === "fit_for_you";
              const topCard = section.insight_cards?.[0] ?? null;
              const topHighlight = section.highlights?.[0] ?? null;
              const topCardTone = topCard
                ? getFitScoreTone(section.key, {
                    title: topCard.title,
                    value: topCard.value,
                    description: topCard.description,
                  })
                : null;

              return (
            <article
              key={section.key}
              className={`rounded-[26px] border border-cars-gray-light/70 bg-white px-5 py-5 shadow-sm dark:border-cars-gray-light/25 dark:bg-slate-950/45 ${
                compactLayout ? "flex h-full flex-col" : ""
              } ${
                isHorizontalCompactFit ? "lg:col-span-2" : ""
              }`}
            >
              {isHorizontalCompactFit ? (
                <div className="min-w-0">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        {section.title}
                      </p>
                      {section.confidence?.label ? (
                        <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold text-cars-primary dark:bg-white/10 dark:text-white/80">
                          {section.confidence.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-cars-primary">
                      {compactText(section.assistant_message, 150)}
                    </p>
                  </div>
                  {section.highlights?.length || section.caveats?.length || topCard ? (
                    <div className="mt-4 grid items-stretch gap-3 lg:grid-cols-3">
                      <div className="h-full">
                        <FitSignalGroup
                          title="The good"
                          items={section.highlights?.slice(0, 3)}
                          tone="good"
                        />
                      </div>
                      <div className="h-full">
                        <FitSignalGroup
                          title="Watch-outs"
                          items={section.caveats?.slice(0, 2)}
                          tone="bad"
                        />
                      </div>
                      {topCard ? (
                        <div
                          className={`flex h-full min-h-[168px] flex-col items-center justify-center rounded-[18px] px-5 py-5 text-center ${
                            topCardTone ? topCardTone.shell : "bg-cars-off-white dark:bg-slate-900/70"
                          }`}
                        >
                          {topCardTone?.Icon ? (
                            <span
                              className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                                topCardTone.iconShell
                              }`}
                            >
                              <topCardTone.Icon className={`h-6 w-6 ${topCardTone.iconColor}`} />
                            </span>
                          ) : null}
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                              topCardTone ? topCardTone.description : "text-cars-accent"
                            }`}
                          >
                            {topCard.title}
                          </p>
                          {topCard.value != null ? (
                            <p
                              className={`mt-3 text-5xl font-apercu-bold leading-none ${
                                topCardTone ? topCardTone.value : "text-cars-primary"
                              }`}
                            >
                              {formatCardValue(topCard.title, topCard.value)}
                            </p>
                          ) : null}
                          <p
                            className={`mt-3 text-sm font-semibold ${
                              topCardTone ? topCardTone.value : "text-cars-primary"
                            }`}
                          >
                            {topCardTone?.label || compactText(topCard.description || "", 40)}
                          </p>
                          {(topCard.description || section.assistant_message) ? (
                            <p
                              className={`mt-2 max-w-[14rem] text-xs leading-5 ${
                                topCardTone ? topCardTone.description : "text-cars-gray"
                              }`}
                            >
                              {compactText(
                                topCard.description &&
                                  topCardTone?.label &&
                                  topCard.description.trim().toLowerCase() !==
                                    topCardTone.label.trim().toLowerCase()
                                  ? topCard.description
                                  : section.assistant_message,
                                88
                              )}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {!section.highlights?.length && topHighlight && !topCard ? (
                        <span className="inline-flex h-full items-center justify-center rounded-[18px] bg-cars-off-white px-4 py-3 text-center text-xs font-medium text-cars-primary dark:bg-slate-900/70">
                          {compactText(topHighlight, 56)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {!section.highlights?.length && topHighlight && !topCard ? (
                    <span className="mt-4 inline-flex items-center rounded-full bg-cars-off-white px-3 py-2 text-xs font-medium text-cars-primary dark:bg-slate-900/70">
                      {compactText(topHighlight, 56)}
                    </span>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                        {section.title}
                      </p>
                      {!compactLayout && section.confidence?.label ? (
                        <div className="mt-3 inline-flex rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold text-cars-primary dark:bg-white/10 dark:text-white/80">
                          {section.confidence.label}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <p className={`mt-4 text-sm text-cars-primary ${compactLayout ? "leading-6" : "leading-7"}`}>
                    {compactLayout ? compactText(section.assistant_message) : section.assistant_message}
                  </p>

                  {section.key === "fit_for_you" && (section.highlights?.length || section.caveats?.length) ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <FitSignalGroup
                        title="The good"
                        items={section.highlights?.slice(0, 3)}
                        tone="good"
                      />
                      <FitSignalGroup
                        title="Watch-outs"
                        items={section.caveats?.slice(0, 2)}
                        tone="bad"
                      />
                    </div>
                  ) : null}

                  {section.insight_cards?.length ? (
                    <div className={`mt-4 grid gap-3 ${compactLayout ? "md:grid-cols-2" : ""}`}>
                      {section.insight_cards.slice(0, compactLayout ? 1 : 2).map((card, index) => {
                        const cardTone = getFitScoreTone(section.key, {
                          title: card.title,
                          value: card.value,
                          description: card.description,
                        });

                        return (
                          <div
                            key={`${card.title}-${index}`}
                            className={`rounded-[20px] px-4 py-4 ${
                              cardTone
                                ? cardTone.shell
                                : "bg-cars-off-white dark:bg-slate-900/70"
                            }`}
                          >
                            <p
                              className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                                cardTone ? cardTone.description : "text-cars-accent"
                              }`}
                            >
                              {card.title}
                            </p>
                            {card.value != null ? (
                              <p
                                className={`mt-2 text-lg font-apercu-bold ${
                                  cardTone ? cardTone.value : "text-cars-primary"
                                }`}
                              >
                                {formatCardValue(card.title, card.value)}
                              </p>
                            ) : null}
                            <p
                              className={`mt-2 text-sm leading-6 ${
                                cardTone ? cardTone.description : "text-cars-gray"
                              }`}
                            >
                              {compactLayout ? compactText(card.description, 130) : card.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {section.highlights?.length && section.key !== "fit_for_you" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {section.highlights.slice(0, compactLayout ? 1 : 3).map((highlight) => (
                        <span
                          key={highlight}
                          className="rounded-full bg-cars-off-white px-3 py-2 text-xs font-medium text-cars-primary dark:bg-slate-900/70"
                        >
                          {compactLayout ? compactText(highlight, 90) : highlight}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              )}

              {showActionPaths && !compactLayout && section.action_paths?.length ? (
                (() => {
                  const actionPaths = allowedActionPathTypes
                    ? section.action_paths.filter((path) => allowedActionPathTypes.includes(path.type))
                    : section.action_paths;

                  if (!actionPaths.length) return null;

                  return (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {actionPaths.slice(0, 3).map((path) => (
                        <ActionLink key={`${path.type}-${path.url}`} path={path} />
                      ))}
                    </div>
                  );
                })()
              ) : null}

              {showSectionCaveats && section.caveats?.length && section.key !== "fit_for_you" ? (
                <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  {section.caveats[0]}
                </div>
              ) : null}

              {showSectionSources && section.freshness_note ? (
                <p className="mt-4 text-xs leading-5 text-cars-gray">{section.freshness_note}</p>
              ) : null}
            </article>
              );
            })()
            ))}
          </div>

          {compactLayout && showActionPaths && compactActionPaths.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {compactActionPaths.map((path) => (
                <ActionLink key={`${path.type}-${path.url}`} path={path} />
              ))}
            </div>
          ) : null}

          {compactLayout && showCompactSourceSummary && compactSourceSummary ? (
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
