import Link from "next/link";
import { Camera, CarFront } from "lucide-react";

type Props = {
  href: string;
  title: string;
  image: string | null;
  imageCount: number;
  photoSourceLabel?: string | null;
};

export default function ListingImage({
  href,
  title,
  image,
  imageCount,
  photoSourceLabel,
}: Props) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(235,242,255,1),rgba(247,250,255,1))]"
    >
      {image ? (
        <img
          src={image}
          alt={title}
          className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-60 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-cars-primary shadow-sm">
            <CarFront className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-cars-primary">No photo uploaded yet</p>
            <p className="mt-1 text-xs leading-5 text-cars-gray">
              This listing is live, but the seller has not added vehicle photos yet.
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            <Camera className="h-3.5 w-3.5" />
            {imageCount > 0 ? `${imageCount} photo${imageCount > 1 ? "s" : ""}` : "Photos pending"}
          </span>
          {photoSourceLabel ? (
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cars-primary shadow-sm">
              {photoSourceLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
    </Link>
  );
}
