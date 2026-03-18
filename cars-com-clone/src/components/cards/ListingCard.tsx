import Link from "next/link";
import { toCurrency } from "@/lib/api-client";
import type { Listing } from "@/lib/types";

type Props = {
  item: Listing;
  saved?: boolean;
  onRequest?: (listingId: number) => void;
  onToggleSave?: (listingId: number) => void;
};

export default function ListingCard({
  item,
  saved = false,
  onRequest,
  onToggleSave,
}: Props) {
  return (
    <article className="rounded-2xl border p-4">
      <p className="mb-2 text-xs text-slate-500">
        listing_id: {item.listing_id} • variant_id: {item.variant_id}
      </p>
      <h2 className="text-lg font-semibold">Asking price: {toCurrency(item.asking_price)}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {item.location_city || "-"} • {item.location_country_code || "-"}
      </p>
      <p className="mt-1 text-sm text-slate-600">Mileage: {item.mileage_km ?? "-"} km</p>
      <p className="mt-3 text-sm">{item.description || "No description"}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/listings/${item.listing_id}`}
          className="rounded border px-3 py-2 text-sm hover:bg-slate-50"
        >
          View detail
        </Link>
        {onRequest ? (
          <button
            type="button"
            onClick={() => onRequest(item.listing_id)}
            className="rounded bg-purple-800 px-3 py-2 text-sm text-white"
          >
            Request viewing
          </button>
        ) : null}
        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(item.listing_id)}
            className="rounded border px-3 py-2 text-sm"
          >
            {saved ? "Unsave" : "Save"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
