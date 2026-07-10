import Link from "next/link";
import { Camera, CarFront } from "lucide-react";

type Props = {
  href: string;
  title: string;
  image: string | null;
  imageCount: number;
};

export default function ListingImage({
  href,
  title,
  image,
  imageCount,
}: Props) {
  return (
    <Link
      href={href}
      className="group relative block aspect-[4/3] overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(143,180,255,0.18),transparent_40%),linear-gradient(180deg,rgba(16,21,31,0.98),rgba(8,12,18,0.98))] sm:aspect-[16/10] sm:rounded-[28px]"
    >
      {image ? (
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center sm:px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/10 text-slate-100 shadow-sm">
            <CarFront className="h-7 w-7" />
          </div>
          <div className="max-w-[18rem]">
            <p className="text-sm font-semibold text-slate-50">No photo uploaded yet</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              This listing is live, but the seller has not added vehicle photos yet.
            </p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-white bg-white px-3 py-1.5 text-xs font-semibold text-cars-primary shadow-[0_14px_34px_rgba(0,0,0,0.34)] ring-2 ring-cars-primary/12">
            <Camera className="h-3.5 w-3.5 text-cars-primary" />
            {imageCount > 0 ? `${imageCount} photo${imageCount > 1 ? "s" : ""}` : "Photos pending"}
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
    </Link>
  );
}
