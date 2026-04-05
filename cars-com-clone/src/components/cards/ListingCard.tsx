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
  formatPhotoSource,
  formatTransmission,
  getListingImages,
} from "@/components/listings/listing-utils";
import { getMarketplaceSellerType } from "@/lib/seller-profile";
import type { Listing } from "@/lib/types";

type Props = {
  item: Listing;
  saved?: boolean;
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
  onToggleSave,
}: Props) {
  const href = `/listings/${item.listing_id}`;
  const images = getListingImages(item);
  const coverImage = images[0] || null;
  const title = buildListingTitle(item);
  const eyebrow = buildListingEyebrow(item);
  const specChips = buildSpecChips(item);
  const photoSourceLabel = formatPhotoSource(item.photo_source);
  const sellerType = getMarketplaceSellerType(item);
  const trustSignals = [
    sellerType,
    formatBodyType(item.body_type),
    item.status,
  ].filter(Boolean);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[30px] border border-cars-gray-light/70 bg-white shadow-[0_20px_44px_rgba(15,45,98,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_28px_54px_rgba(15,45,98,0.14)]">
      <div className="relative">
        <ListingImage
          href={href}
          title={buildListingMetaTitle(item)}
          image={coverImage}
          imageCount={item.image_count || images.length}
          photoSourceLabel={photoSourceLabel}
        />

        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(item.listing_id)}
            className={
              saved
                ? "absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-red-500 shadow-[0_12px_28px_rgba(15,45,98,0.18)] transition hover:scale-105"
                : "absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-cars-primary shadow-[0_12px_28px_rgba(15,45,98,0.18)] transition hover:scale-105 hover:text-red-500"
            }
            aria-label={saved ? "Remove from saved cars" : "Save car"}
          >
            <Heart className={saved ? "h-5 w-5 fill-current" : "h-5 w-5"} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-[1.75rem] font-apercu-bold leading-none text-cars-primary">
              {formatListingPrice(item.asking_price)}
            </h2>
          </div>
          <span className="rounded-full bg-cars-off-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cars-primary">
            {item.status}
          </span>
        </div>

        <Link href={href} className="mt-4 block transition hover:text-cars-accent">
          <h3 className="text-xl font-apercu-bold leading-7 text-cars-primary">{title}</h3>
          <p className="mt-1 text-sm font-medium text-cars-gray">
            {item.model_year ? `${item.model_year} - ` : ""}
            {formatBodyType(item.body_type)}
          </p>
        </Link>

        <div className="mt-5 flex flex-wrap gap-2">
          {specChips.map((chip) => (
            <span
              key={`${item.listing_id}-${chip.key}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-cars-off-white px-3 py-2 text-xs font-medium text-cars-primary"
            >
              <chip.icon className="h-3.5 w-3.5 text-cars-accent" />
              {chip.label}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {trustSignals.map((signal) => (
            <span
              key={`${item.listing_id}-${signal}`}
              className="rounded-full border border-cars-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-cars-gray"
            >
              {signal}
            </span>
          ))}
        </div>

        {item.description ? (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-cars-gray">{item.description}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <Link
            href={href}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-cars-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-cars-accent"
          >
            Check availability
          </Link>
        </div>
      </div>
    </article>
  );
}
