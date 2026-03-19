import { Camera, MoveLeft, MoveRight, Star, Trash2, UploadCloud } from "lucide-react";
import { getSafeImageSrc } from "./listing-image-upload-client";
import type { PhotoDraft, SellFieldErrors } from "./sell-utils";
import { photoTips } from "./sell-utils";

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
  return (
    <section className="section-shell p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">Step 2</p>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-apercu-bold text-cars-primary">Add photos early</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
            Buyers trust listings with strong photos. Aim for at least 5 to 10 clear images in daylight.
          </p>
        </div>
        <div className="rounded-[22px] bg-cars-off-white px-4 py-3 text-sm font-medium text-cars-primary">
          {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? "s" : ""} staged` : "No photos staged yet"}
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
            ? "mt-6 rounded-[28px] border-2 border-dashed border-cars-accent bg-[linear-gradient(135deg,rgba(233,241,255,0.9),rgba(255,255,255,1))] p-8 text-center"
            : "mt-6 rounded-[28px] border-2 border-dashed border-cars-primary/15 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(241,246,255,0.95))] p-8 text-center"
        }
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-cars-primary shadow-sm">
          <UploadCloud className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-xl font-apercu-bold text-cars-primary">Drag and drop photos here</h3>
        <p className="mt-2 text-sm leading-6 text-cars-gray">
          JPG, PNG, or WEBP. Up to 10 photos, max 5 MB each after optimization. We will use the first photo as cover by default.
        </p>
        <label className="mt-5 inline-flex cursor-pointer rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white">
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          {photos.length === 0 ? (
            <div className="rounded-[24px] border border-cars-primary/10 bg-cars-off-white px-5 py-4 text-sm leading-6 text-cars-gray">
              Listings without photos still work, but they usually attract less attention from buyers.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((photo, index) => (
                <div key={photo.id} className="overflow-hidden rounded-[24px] border border-cars-primary/10 bg-white shadow-[0_12px_28px_rgba(15,45,98,0.06)]">
                  <div className="relative h-44 overflow-hidden bg-cars-off-white">
                    {getSafeImageSrc(photo.previewUrl) ? (
                      <img
                        src={getSafeImageSrc(photo.previewUrl) || undefined}
                        alt={photo.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center text-xs font-medium text-cars-gray">
                        {photo.status === "error"
                          ? photo.error || "Preview unavailable"
                          : "Preparing preview..."}
                      </div>
                    )}
                    {photo.isCover ? (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-cars-primary shadow-sm">
                        <Star className="h-3.5 w-3.5 fill-current text-cars-accent" />
                        Cover photo
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="truncate text-sm font-semibold text-cars-primary">{photo.name}</p>
                      <p className="mt-1 text-xs text-cars-gray">
                        Photo {index + 1} - {Math.round(photo.size / 1024)} KB
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-cars-off-white">
                      <div
                        className="h-full rounded-full bg-cars-accent transition-all"
                        style={{ width: `${photo.progress}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSetCover(photo.id)}
                        disabled={photo.status !== "ready"}
                        className="rounded-full border border-cars-primary/15 px-3 py-1.5 text-xs font-semibold text-cars-primary disabled:opacity-40"
                      >
                        Set cover
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(photo.id, "left")}
                        disabled={index === 0}
                        className="inline-flex items-center gap-1 rounded-full border border-cars-primary/15 px-3 py-1.5 text-xs font-semibold text-cars-primary disabled:opacity-40"
                      >
                        <MoveLeft className="h-3.5 w-3.5" />
                        Move
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(photo.id, "right")}
                        disabled={index === photos.length - 1}
                        className="inline-flex items-center gap-1 rounded-full border border-cars-primary/15 px-3 py-1.5 text-xs font-semibold text-cars-primary disabled:opacity-40"
                      >
                        <MoveRight className="h-3.5 w-3.5" />
                        Move
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(photo.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-cars-primary/10 bg-white p-5 shadow-[0_12px_28px_rgba(15,45,98,0.05)]">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-cars-accent" />
            <h3 className="text-lg font-apercu-bold text-cars-primary">Photo checklist</h3>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-cars-gray">
            {photoTips.map((tip) => (
              <li key={tip} className="rounded-[18px] bg-cars-off-white px-4 py-3">
                {tip}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-[20px] bg-[linear-gradient(135deg,rgba(233,241,255,0.8),rgba(255,255,255,1))] p-4 text-sm leading-6 text-cars-gray">
            The staged upload uses local file conversion right now so you can preview and publish photos immediately. Later, this can be swapped to cloud storage without changing the seller UX.
          </div>
        </div>
      </div>
    </section>
  );
}
