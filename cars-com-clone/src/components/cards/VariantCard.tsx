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
    <article className="section-shell flex h-full flex-col border-white/10 bg-[linear-gradient(180deg,rgba(19,26,37,0.96),rgba(11,15,22,0.98))] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8fb4ff]">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-xl font-apercu-bold text-slate-50 sm:text-2xl">{title}</h2>
        </div>
        <span className="self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-[#c5f6ff]">
          {item.model_year}
        </span>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8fb4ff]">
          Vehicle profile
        </p>
        <p className="mt-2 text-sm text-slate-100">
          {item.body_type || "Body type unavailable"} / {item.fuel_type || "Fuel info unavailable"}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          {item.engine || "Engine pending"} / {item.transmission || "Transmission pending"} /{" "}
          {item.drivetrain || "Drivetrain pending"}
        </p>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-100 sm:grid-cols-2">
        <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8fb4ff]">
            Base MSRP
          </p>
          <p className="mt-2 text-lg font-semibold">{toCurrency(item.msrp_base)}</p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8fb4ff]">
            Next step
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Open the details page, then compare or save it.
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:flex-wrap">
        <Link
          href={`/catalog/${item.variant_id}`}
          className="editorial-button inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-slate-950 sm:w-auto"
        >
          View details
        </Link>
        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(item.variant_id)}
            className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 sm:w-auto"
          >
            {saved ? "Saved" : "Save"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
