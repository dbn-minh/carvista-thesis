import Link from "next/link";
import { toCurrency } from "@/lib/api-client";
import type { VariantListItem } from "@/lib/types";

type Props = {
  item: VariantListItem;
  saved?: boolean;
  onToggleSave?: (variantId: number) => void;
};

export default function VariantCard({ item, saved = false, onToggleSave }: Props) {
  const title = `${item.make_name} ${item.model_name} ${item.trim_name || ""}`.trim();
  const eyebrow = item.body_type || item.fuel_type ? "Catalog model" : `${item.model_year}`;

  return (
    <article className="section-shell flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-apercu-bold text-cars-primary">{title}</h2>
        </div>
        <span className="rounded-full bg-cars-off-white px-3 py-1 text-sm font-semibold text-cars-primary">
          {item.model_year}
        </span>
      </div>

      <div className="mt-5 rounded-[24px] bg-[linear-gradient(135deg,rgba(233,241,255,0.9),rgba(255,255,255,1))] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
          Vehicle profile
        </p>
        <p className="mt-2 text-sm text-cars-primary">
          {item.body_type || "Body type unavailable"} • {item.fuel_type || "Fuel info unavailable"}
        </p>
        <p className="mt-2 text-sm text-cars-gray">
          {item.engine || "Engine pending"} • {item.transmission || "Transmission pending"} •{" "}
          {item.drivetrain || "Drivetrain pending"}
        </p>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-cars-primary sm:grid-cols-2">
        <div className="rounded-[20px] border border-cars-gray-light/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
            Base MSRP
          </p>
          <p className="mt-2 text-lg font-semibold">{toCurrency(item.msrp_base)}</p>
        </div>
        <div className="rounded-[20px] border border-cars-gray-light/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
            Next step
          </p>
          <p className="mt-2 text-sm text-cars-gray">Open the details page, then compare or save it.</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          href={`/catalog/${item.variant_id}`}
          className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
        >
          View details
        </Link>
        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(item.variant_id)}
            className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
          >
            {saved ? "Saved" : "Save"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
