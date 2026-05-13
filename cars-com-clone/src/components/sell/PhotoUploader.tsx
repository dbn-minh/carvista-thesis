import { AlertCircle, CheckCircle2, MoveLeft, MoveRight, Star, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getSafeImageSrc,
  LISTING_IMAGE_CLIENT_LIMITS,
} from "./listing-image-upload-client";
import type { PhotoDraft, SellFieldErrors } from "./sell-utils";

type Props = {
  photos: PhotoDraft[];
  isDragging: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
  onDragStateChange: (dragging: boolean) => void;
  onSetCover: (photoId: string) => void;
  onRemove: (photoId: string) => void;
  onMove: (photoId: string, direction: "left" | "right") => void;
  errors: SellFieldErrors;
};

export default function PhotoUploader({
  photos,
  isDragging,
  onFilesSelected,
  onDragStateChange,
  onSetCover,
  onRemove,
  onMove,
  errors,
}: Props) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const originalLimitMb = Math.round(
    LISTING_IMAGE_CLIENT_LIMITS.maxOriginalFileSizeBytes / (1024 * 1024)
  );
  const uploadedLimitMb = Math.round(
    LISTING_IMAGE_CLIENT_LIMITS.maxUploadedFileSizeBytes / (1024 * 1024)
  );
  const selectedPhoto = useMemo(
    () => photos.find((photo) => photo.id === selectedPhotoId) || photos[0] || null,
    [photos, selectedPhotoId]
  );
  const selectedIndex = selectedPhoto
    ? photos.findIndex((photo) => photo.id === selectedPhoto.id)
    : -1;

  useEffect(() => {
    if (photos.length === 0) {
      setSelectedPhotoId(null);
      return;
    }
    if (!selectedPhotoId || !photos.some((photo) => photo.id === selectedPhotoId)) {
      setSelectedPhotoId(photos[0].id);
    }
  }, [photos, selectedPhotoId]);

  function getPhotoStatusLabel(photo: PhotoDraft) {
    if (photo.status === "error") return "Upload issue";
    if (photo.status === "processing") return "Preparing preview";
    return "Ready to publish";
  }

  return (
    <section className="section-shell p-4 sm:p-5 md:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">Step 2</p>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-apercu-bold text-cars-primary sm:text-3xl">
            Add photos early
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
            Buyers trust listings with strong photos. Aim for at least 5 to 10 clear images in
            daylight.
          </p>
        </div>
        <div className="rounded-[22px] bg-cars-off-white px-4 py-3 text-sm font-medium text-cars-primary dark:bg-slate-950/45 dark:text-white">
          {photos.length > 0
            ? `${photos.length} photo${photos.length > 1 ? "s" : ""} staged`
            : "0 photo"}
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          onDragStateChange(true);
        }}
        onDragLeave={() => onDragStateChange(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDragStateChange(false);
          onFilesSelected(event.dataTransfer.files);
        }}
        className={
          isDragging
            ? "mt-6 rounded-[28px] border-2 border-dashed border-cars-accent bg-[linear-gradient(135deg,rgba(233,241,255,0.9),rgba(255,255,255,1))] p-5 text-center dark:bg-[linear-gradient(135deg,rgba(15,26,44,0.98),rgba(8,17,31,0.94))] sm:p-8"
            : "mt-6 rounded-[28px] border-2 border-dashed border-cars-primary/15 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(241,246,255,0.95))] p-5 text-center dark:border-cars-gray-light/35 dark:bg-[linear-gradient(135deg,rgba(8,17,31,0.98),rgba(13,21,37,0.94))] sm:p-8"
        }
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-cars-primary shadow-sm dark:bg-slate-900/85 dark:text-white sm:h-16 sm:w-16">
          <UploadCloud className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <h3 className="mt-4 text-lg font-apercu-bold text-cars-primary sm:text-xl">
          Drag and drop photos here
        </h3>
        <p className="mt-2 text-sm leading-6 text-cars-gray">
          JPG, PNG, or WEBP. Up to {LISTING_IMAGE_CLIENT_LIMITS.maxCount} photos. Originals can
          be up to {originalLimitMb} MB each, then we optimize them before secure cloud upload.
          Published uploads stay within {uploadedLimitMb} MB per photo.
        </p>
        <label className="mt-5 inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-cars-primary px-5 text-sm font-semibold text-white sm:w-auto">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) onFilesSelected(event.target.files);
              event.target.value = "";
            }}
          />
          Choose photos
        </label>
      </div>

      {errors.photos ? <p className="mt-3 text-sm font-medium text-red-600">{errors.photos}</p> : null}

      <div className="mt-6">
        {photos.length === 0 ? (
          <div className="rounded-[24px] border border-cars-primary/10 bg-cars-off-white px-5 py-4 text-sm leading-6 text-cars-gray dark:border-cars-gray-light/35 dark:bg-slate-950/45">
            Listings without photos still work, but they usually attract less attention from buyers.
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="overflow-hidden rounded-[24px] border border-cars-primary/10 bg-white p-4 shadow-[0_12px_28px_rgba(15,45,98,0.05)] dark:border-cars-gray-light/35 dark:bg-slate-950/55 sm:rounded-[28px] sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-xl font-apercu-bold text-cars-primary sm:text-2xl">
                    Listing gallery
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-cars-gray">
                    Review each uploaded photo the same way a buyer will see it before you publish.
                  </p>
                </div>
                {selectedPhoto ? (
                  <div className="inline-flex items-center gap-2 self-start rounded-full bg-cars-off-white px-3 py-2 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
                    {selectedPhoto.status === "ready" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : selectedPhoto.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <UploadCloud className="h-4 w-4 text-cars-accent" />
                    )}
                    {getPhotoStatusLabel(selectedPhoto)}
                  </div>
                ) : null}
              </div>

              {selectedPhoto ? (
                <>
                  <div className="mt-5 overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(143,180,255,0.16),transparent_48%),linear-gradient(180deg,rgba(16,22,32,0.96),rgba(10,14,20,0.98))] sm:rounded-[28px]">
                    <div className="relative aspect-[16/10] sm:aspect-[16/9]">
                      {getSafeImageSrc(selectedPhoto.previewUrl) ? (
                        <img
                          src={getSafeImageSrc(selectedPhoto.previewUrl) || undefined}
                          alt={selectedPhoto.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm font-medium text-slate-300">
                          {selectedPhoto.status === "error"
                            ? selectedPhoto.error || "Preview unavailable"
                            : "Preparing preview..."}
                        </div>
                      )}
                      {selectedPhoto.isCover ? (
                        <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-cars-primary shadow-sm dark:bg-slate-950/85 dark:text-white">
                          <Star className="h-3.5 w-3.5 fill-current text-cars-accent" />
                          Cover photo
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {photos.length > 1 ? (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
                      {photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setSelectedPhotoId(photo.id)}
                          className={
                            photo.id === selectedPhoto.id
                              ? "overflow-hidden rounded-[18px] ring-2 ring-cars-accent"
                              : "overflow-hidden rounded-[18px] border border-cars-gray-light/70"
                          }
                        >
                          <div className="relative aspect-[4/3] bg-cars-off-white dark:bg-slate-900/80">
                            {getSafeImageSrc(photo.previewUrl) ? (
                              <img
                                src={getSafeImageSrc(photo.previewUrl) || undefined}
                                alt={photo.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-3 text-center text-[11px] font-medium text-cars-gray">
                                {photo.status === "error" ? "Preview unavailable" : "Processing"}
                              </div>
                            )}
                            {photo.isCover ? (
                              <span className="absolute left-2 top-2 rounded-full bg-white/92 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cars-primary shadow-sm dark:bg-slate-950/85 dark:text-white">
                                Cover
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-cars-primary">
                        {selectedPhoto.name}
                      </p>
                      <p className="mt-1 text-sm text-cars-gray">
                        Photo {selectedIndex + 1} of {photos.length} · {Math.round(selectedPhoto.size / 1024)} KB
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-cars-off-white dark:bg-slate-900/80">
                        <div
                          className={`h-full rounded-full transition-all ${
                            selectedPhoto.status === "error" ? "bg-red-500" : "bg-cars-accent"
                          }`}
                          style={{ width: `${selectedPhoto.progress}%` }}
                        />
                      </div>
                      {selectedPhoto.status === "error" && selectedPhoto.error ? (
                        <p className="mt-3 text-sm font-medium text-red-600">
                          {selectedPhoto.error}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <button
                        type="button"
                        onClick={() => onSetCover(selectedPhoto.id)}
                        disabled={selectedPhoto.status !== "ready"}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-cars-primary/15 px-4 py-2 text-xs font-semibold text-cars-primary disabled:opacity-40"
                      >
                        Set cover
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(selectedPhoto.id, "left")}
                        disabled={selectedIndex <= 0}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full border border-cars-primary/15 px-4 py-2 text-xs font-semibold text-cars-primary disabled:opacity-40"
                      >
                        <MoveLeft className="h-3.5 w-3.5" />
                        Move left
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(selectedPhoto.id, "right")}
                        disabled={selectedIndex === photos.length - 1}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full border border-cars-primary/15 px-4 py-2 text-xs font-semibold text-cars-primary disabled:opacity-40"
                      >
                        <MoveRight className="h-3.5 w-3.5" />
                        Move right
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(selectedPhoto.id)}
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-cars-primary/10 bg-[linear-gradient(135deg,rgba(233,241,255,0.8),rgba(255,255,255,1))] p-4 text-sm leading-6 text-cars-gray shadow-[0_12px_28px_rgba(15,45,98,0.05)] dark:border-cars-gray-light/35 dark:bg-[linear-gradient(135deg,rgba(15,26,44,0.92),rgba(8,17,31,0.98))] sm:p-5">
              Photos are optimized locally so previews stay fast, then uploaded to secure cloud
              storage when you publish the listing.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
