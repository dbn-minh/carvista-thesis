"use client";

import { toCurrency } from "@/lib/api-client";
import type { CatalogOwnershipSummary } from "@/lib/types";

type EstimatedTcoPanelProps = {
  ownershipSummary: CatalogOwnershipSummary | null;
  ownershipError?: string;
  ownershipYears: string;
  onOwnershipYearsChange?: (value: string) => void;
  className?: string;
};

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sumNumbers(values: unknown[]) {
  return values.reduce<number>(
    (total, value) => total + (toNumber(value) ?? 0),
    0,
  );
}

function getRuleRate(summary: CatalogOwnershipSummary | null, costType: string) {
  const rule = summary?.estimate?.rules_applied?.find(
    (item) => String(item.cost_type || "") === costType,
  );
  const rate = toNumber(rule?.rate);
  if (rate == null) return null;
  return `${(rate * 100).toFixed(rate * 100 >= 10 ? 0 : 1)}%`;
}

function sourceLabel(source?: string | null) {
  if (source === "listing_asking_price") return "the seller's asking price";
  if (source === "sold_listing_price") return "the recorded sold price";
  if (source === "avg_market_latest") return "latest market price";
  if (source === "msrp_base") return "catalog MSRP";
  return "available vehicle price";
}

function buildTaxSummary(summary: CatalogOwnershipSummary | null) {
  const parts = [
    ["registration_tax", "registration fee"],
    ["vat", "VAT"],
    ["excise_tax", "excise tax"],
    ["import_duty", "import duty"],
    ["other", "other configured fees"],
  ]
    .map(([costType, label]) => {
      const rate = getRuleRate(summary, costType);
      return rate ? `${label} ${rate}` : null;
    })
    .filter(Boolean);

  return parts.length
    ? `Includes ${parts.join(", ")} from the configured Vietnam market rules.`
    : "Tax and fee details depend on the configured Vietnam market rules.";
}

export default function EstimatedTcoPanel({
  ownershipSummary,
  ownershipError = "",
  ownershipYears,
  onOwnershipYearsChange,
  className = "",
}: EstimatedTcoPanelProps) {
  const estimate = ownershipSummary?.estimate ?? null;
  const costs = estimate?.costs ?? null;
  const driveAway =
    estimate && costs
      ? sumNumbers([
          estimate.base_price,
          costs.registration_tax,
          costs.excise_tax,
          costs.vat,
          costs.import_duty,
          costs.other,
        ])
      : null;
  const recurring =
    costs != null
      ? sumNumbers([
          costs.insurance_total,
          costs.maintenance_total,
          costs.energy_total,
        ])
      : null;
  const depreciation = costs ? toNumber(costs.depreciation_total) : null;

  const cards = [
    {
      label: "Drive-away",
      value: driveAway,
      detail: "Vehicle price plus VAT, registration, and configured one-time fees.",
    },
    {
      label: "Running costs",
      value: recurring,
      detail: "Insurance, maintenance, and fuel or charging.",
    },
    {
      label: "Depreciation",
      value: depreciation,
      detail: "Estimated value loss over the selected ownership period.",
    },
  ];

  return (
    <section className={`section-shell overflow-hidden p-4 sm:p-5 md:p-6 ${className}`.trim()}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
            Estimated TCO
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
            Compact ownership estimate from vehicle price, Vietnam tax rules, running costs,
            and depreciation.
          </p>
        </div>

        {onOwnershipYearsChange ? (
          <select
            value={ownershipYears}
            onChange={(event) => onOwnershipYearsChange(event.target.value)}
            className="h-10 w-full rounded-full border border-cars-primary/10 bg-white px-3 text-sm text-cars-primary shadow-sm outline-none focus:border-cars-accent dark:border-white/10 dark:bg-white/5 dark:text-slate-100 sm:w-auto"
          >
            <option value="3">3 years</option>
            <option value="5">5 years</option>
            <option value="7">7 years</option>
          </select>
        ) : null}
      </div>

      {estimate ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))]">
            <article className="rounded-[20px] border border-cars-primary/10 bg-white/90 px-4 py-4 shadow-[0_12px_28px_rgba(15,45,98,0.04)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                {ownershipYears}-year total
              </p>
              <div className="mt-2 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                <p className="break-words text-2xl font-apercu-bold text-cars-primary dark:text-slate-50">
                  {toCurrency(estimate.total_cost)}
                </p>
                {estimate.monthly_cost_avg != null ? (
                  <p className="text-sm text-cars-gray dark:text-slate-300">
                    Avg. {toCurrency(estimate.monthly_cost_avg)} / month
                  </p>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-cars-gray dark:text-slate-300">
                Base price uses {sourceLabel(ownershipSummary?.base_price_source)}.
              </p>
            </article>
            {cards.map((card) => (
              <article
                key={card.label}
                className="rounded-[20px] border border-cars-primary/10 bg-white/90 px-4 py-4 shadow-[0_12px_28px_rgba(15,45,98,0.04)] dark:border-white/10 dark:bg-white/5 dark:shadow-none"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
                  {card.label}
                </p>
                <p className="mt-2 break-words text-lg font-apercu-bold text-cars-primary dark:text-slate-50">
                  {card.value != null ? toCurrency(card.value) : "-"}
                </p>
                <p className="mt-2 text-sm leading-5 text-cars-gray dark:text-slate-300">
                  {card.detail}
                </p>
              </article>
            ))}
          </div>

          <p className="rounded-full bg-cars-off-white px-4 py-3 text-xs leading-5 text-cars-gray dark:bg-white/5 dark:text-slate-300">
            {buildTaxSummary(ownershipSummary)}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-[22px] border border-dashed border-cars-primary/12 bg-white px-4 py-4 text-sm leading-7 text-cars-gray dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {ownershipError || "Ownership estimate is not available for this market yet."}
        </div>
      )}
    </section>
  );
}
