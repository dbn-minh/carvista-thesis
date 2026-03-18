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
    <article className="section-shell flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
            Listing #{item.listing_id}
          </p>
          <h2 className="mt-3 text-2xl font-apercu-bold text-cars-primary">
            {toCurrency(item.asking_price)}
          </h2>
        </div>
        <span className="rounded-full bg-cars-off-white px-3 py-1 text-sm font-semibold capitalize text-cars-primary">
          {item.status}
        </span>
      </div>

      <div className="mt-5 rounded-[24px] bg-[linear-gradient(135deg,rgba(233,241,255,0.85),rgba(255,255,255,1))] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cars-accent">
          Listing summary
        </p>
        <p className="mt-2 text-sm text-cars-primary">
          Variant #{item.variant_id} • {item.location_city || "Location pending"} •{" "}
          {item.location_country_code || "--"}
        </p>
        <p className="mt-2 text-sm text-cars-gray">Mileage: {item.mileage_km ?? "-"} km</p>
      </div>

      <p className="mt-5 text-sm leading-6 text-cars-gray">
        {item.description || "Seller has not added a description yet."}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          href={`/listings/${item.listing_id}`}
          className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
        >
          View details
        </Link>
        {onRequest ? (
          <button
            type="button"
            onClick={() => onRequest(item.listing_id)}
            className="rounded-full bg-cars-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Request viewing
          </button>
        ) : null}
        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(item.listing_id)}
            className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
          >
            {saved ? "Saved" : "Save"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
