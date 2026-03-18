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

  return (
    <article className="rounded-2xl border p-4">
      <p className="mb-2 text-xs text-slate-500">variant_id: {item.variant_id}</p>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {item.model_year} • {item.body_type || "-"} • {item.fuel_type || "-"}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {item.engine || "-"} • {item.transmission || "-"} • {item.drivetrain || "-"}
      </p>
      <p className="mt-3 text-sm font-medium">MSRP: {toCurrency(item.msrp_base)}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/catalog/${item.variant_id}`}
          className="rounded border px-3 py-2 text-sm hover:bg-slate-50"
        >
          View detail
        </Link>
        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(item.variant_id)}
            className="rounded border px-3 py-2 text-sm hover:bg-slate-50"
          >
            {saved ? "Unsave" : "Save"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
