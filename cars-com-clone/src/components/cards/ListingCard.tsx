import Link from "next/link";
import { CalendarDays, Fuel, Gauge, Heart, MapPin, Settings2 } from "lucide-react";
import ListingImage from "@/components/listings/ListingImage";
import {
  buildListingEyebrow,
  buildListingMetaTitle,
  buildListingTitle,
  formatBodyType,
  formatFuelType,
  formatListingPrice,
  formatLocation,
  formatMileage,
  formatTransmission,
  getListingImages,
} from "@/components/listings/listing-utils";
import type { Listing } from "@/lib/types";

type Props = {
  item: Listing;
  saved?: boolean;
  showStatusBadge?: boolean;
  onToggleSave?: (listingId: number) => void;
};

function buildSpecChips(item: Listing) {
  return [
    {
      key: "year",
      icon: CalendarDays,
      label: item.model_year ? String(item.model_year) : "Year pending",
    },
    {
      key: "mileage",
      icon: Gauge,
      label: formatMileage(item.mileage_km),
    },
    {
      key: "transmission",
      icon: Settings2,
      label: formatTransmission(item.transmission),
    },
    {
      key: "fuel",
      icon: Fuel,
      label: formatFuelType(item.fuel_type),
    },
    {
      key: "location",
      icon: MapPin,
      label: formatLocation(item.location_city, item.location_country_code),
    },
  ];
}

export default function ListingCard({
  item,
  saved = false,
  showStatusBadge = false,
  onToggleSave,
}: Props) {
  const href = `/listings/${item.listing_id}`;
  const images = getListingImages(item);
  const coverImage = images[0] || null;
  const title = buildListingTitle(item);
  const eyebrow = buildListingEyebrow(item);
  const specChips = buildSpecChips(item);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,26,36,0.98),rgba(10,14,20,0.99))] shadow-[0_24px_54px_rgba(0,0,0,0.28)] transition-all duration-300 hover:-translate-y-1 hover:border-[#8fb4ff]/30 hover:shadow-[0_28px_70px_rgba(0,0,0,0.38)] sm:rounded-[30px]">
      <div className="relative">
        <ListingImage
          href={href}
          title={buildListingMetaTitle(item)}
          image={coverImage}
          imageCount={item.image_count || images.length}
        />

        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(item.listing_id)}
            className={
              saved
                ? "absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white bg-white text-rose-600 shadow-[0_16px_36px_rgba(0,0,0,0.3)] ring-2 ring-cars-primary/12 transition hover:scale-105"
                : "absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white bg-white text-cars-primary shadow-[0_16px_36px_rgba(0,0,0,0.28)] ring-2 ring-cars-primary/12 transition hover:scale-105 hover:text-rose-600"
            }
            aria-label={saved ? "Remove from saved cars" : "Save car"}
          >
            <Heart className={saved ? "h-5 w-5 fill-current" : "h-5 w-5"} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8fb4ff]">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-apercu-bold leading-tight text-slate-50 sm:text-[1.75rem]">
              {formatListingPrice(item.asking_price)}
            </h2>
          </div>
          {showStatusBadge && item.status ? (
            <span className="self-start rounded-full border border-cars-primary/10 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cars-primary shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-[#c5f6ff]">
              {item.status}
            </span>
          ) : null}
        </div>

        <Link href={href} className="mt-4 block min-w-0 transition hover:text-[#7de2ff]">
          <h3 className="line-clamp-2 text-lg font-apercu-bold leading-6 text-slate-50 sm:text-xl sm:leading-7">
            {title}
          </h3>
          <p className="mt-1 break-words text-sm font-medium text-slate-400">
            {item.model_year ? `${item.model_year} - ` : ""}
            {formatBodyType(item.body_type)}
          </p>
        </Link>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {specChips.map((chip) => (
            <span
              key={`${item.listing_id}-${chip.key}`}
              className="inline-flex min-w-0 items-start gap-1.5 rounded-[18px] border border-white/8 bg-white/5 px-3 py-2.5 text-xs font-medium text-slate-200"
            >
              <chip.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8fb4ff]" />
              <span className="min-w-0 break-words leading-5">{chip.label}</span>
            </span>
          ))}
        </div>

        {item.description ? (
          <p className="mt-4 line-clamp-3 break-words text-sm leading-6 text-slate-300">
            {item.description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <Link
            href={href}
            className="editorial-button inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 sm:h-12"
          >
            Check availability
          </Link>
        </div>
      </div>
    </article>
  );
}
