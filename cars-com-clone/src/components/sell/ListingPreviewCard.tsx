import {
  buildListingPreviewSubtitle,
  buildListingPreviewTitle,
  formatPriceLabel,
  type SellFormState,
} from "./sell-utils";
import { getSafeImageSrc } from "./listing-image-upload-client";
import type { VariantListItem } from "@/lib/types";

type Props = {
  form: SellFormState;
  selectedVariant: VariantListItem | null;
};

export default function ListingPreviewCard({ form, selectedVariant }: Props) {
  const coverPhoto = form.photos.find((photo) => photo.isCover) || form.photos[0] || null;
  const safeCoverSrc = getSafeImageSrc(coverPhoto?.previewUrl);

  return (
    <article className="overflow-hidden rounded-[30px] border border-cars-gray-light/70 bg-white shadow-[0_18px_40px_rgba(15,45,98,0.08)] dark:border-cars-gray-light/35 dark:bg-slate-950/55">
      <div className="relative h-56 overflow-hidden bg-[linear-gradient(135deg,rgba(233,241,255,0.9),rgba(255,255,255,1))] dark:bg-[linear-gradient(135deg,rgba(13,21,37,0.94),rgba(8,17,31,0.98))]">
        {coverPhoto && safeCoverSrc ? (
          <img src={safeCoverSrc} alt={coverPhoto.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm font-medium text-cars-gray dark:text-slate-300">
            Add photos to make the listing feel more trustworthy to buyers.
          </div>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
            Listing preview
          </p>
          <h3 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
            {formatPriceLabel(form.askingPrice)}
          </h3>
        </div>

        <div>
          <p className="text-lg font-apercu-bold text-cars-primary">
            {buildListingPreviewTitle(form, selectedVariant)}
          </p>
          <p className="mt-2 text-sm leading-6 text-cars-gray">
            {buildListingPreviewSubtitle(form, selectedVariant) || "Vehicle details will appear here."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {form.mileageKm ? (
            <span className="rounded-full bg-cars-off-white px-3 py-1.5 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
              {form.mileageKm} km
            </span>
          ) : null}
          {form.condition ? (
            <span className="rounded-full bg-cars-off-white px-3 py-1.5 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
              {form.condition}
            </span>
          ) : null}
          {form.city ? (
            <span className="rounded-full bg-cars-off-white px-3 py-1.5 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
              {form.city}, {form.countryCode}
            </span>
          ) : null}
          <span className="rounded-full bg-cars-off-white px-3 py-1.5 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
            {form.negotiable ? "Negotiable" : "Firm price"}
          </span>
        </div>

        <p className="line-clamp-4 text-sm leading-6 text-cars-gray">
          {form.sellerDescription.trim() ||
            "Your seller description will appear here once you tell buyers more about the car."}
        </p>
      </div>
    </article>
  );
}
