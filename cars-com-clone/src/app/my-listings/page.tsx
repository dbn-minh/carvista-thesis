"use client";

import Link from "next/link";
import { Camera, ImagePlus, LoaderCircle, MapPin, MoveHorizontal, PencilLine, Trash2 } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/common/EmptyState";
import StatusBanner from "@/components/common/StatusBanner";
import Header from "@/components/layout/Header";
import ListingImage from "@/components/listings/ListingImage";
import {
  buildListingEyebrow,
  buildListingMetaTitle,
  buildListingTitle,
  formatLabel,
  formatListingPrice,
  formatLocation,
  formatMileage,
  getListingImages,
} from "@/components/listings/listing-utils";
import {
  LISTING_IMAGE_CLIENT_LIMITS,
  optimizeListingImageFile,
  validatePreparedListingImages,
  validateSelectedImageFiles,
} from "@/components/sell/listing-image-upload-client";
import { authApi, listingsApi } from "@/lib/carvista-api";
import { useRequireLogin } from "@/lib/auth-guard";
import type { Listing, ListingImage as ListingImageRecord, User } from "@/lib/types";

type ListingStatus = "active" | "reserved" | "sold" | "hidden";

type ListingFormState = {
  askingPrice: string;
  mileageKm: string;
  locationCity: string;
  countryCode: string;
  description: string;
  status: ListingStatus;
};

const SELLER_LISTING_STATUSES: ListingStatus[] = ["active", "reserved", "sold", "hidden"];

function buildEditState(item: Listing): ListingFormState {
  return {
    askingPrice: String(item.asking_price ?? ""),
    mileageKm: item.mileage_km != null ? String(item.mileage_km) : "",
    locationCity: item.location_city || "",
    countryCode: item.location_country_code || "VN",
    description: item.description || "",
    status: (item.status as ListingStatus) || "active",
  };
}

function mergeSellerListings(groups: Listing[][]): Listing[] {
  const map = new Map<number, Listing>();

  groups.flat().forEach((item) => {
    map.set(item.listing_id, item);
  });

  return [...map.values()].sort(
    (left, right) =>
      new Date(String(right.created_at || 0)).getTime() -
      new Date(String(left.created_at || 0)).getTime()
  );
}

function formatPhotoCount(count: number): string {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

function buildImageSummary(image: ListingImageRecord): string {
  if (image.width && image.height) {
    return `${image.width} x ${image.height}`;
  }

  if (image.format) {
    return image.format.toUpperCase();
  }

  return "Listing photo";
}

export default function MyListingsPage() {
  const ready = useRequireLogin("/my-listings");
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Listing[]>([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Listing | null>(null);
  const [editingImages, setEditingImages] = useState<ListingImageRecord[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [photoActionKey, setPhotoActionKey] = useState<string | null>(null);
  const [formState, setFormState] = useState<ListingFormState | null>(null);
  const [formSnapshot, setFormSnapshot] = useState<ListingFormState | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    if (!formState || !formSnapshot) return false;
    return JSON.stringify(formState) !== JSON.stringify(formSnapshot);
  }, [formSnapshot, formState]);

  const sellerStats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.status === "active").length,
      photos: items.reduce(
        (sum, item) => sum + Number(item.image_count || getListingImages(item).length || 0),
        0
      ),
    }),
    [items]
  );

  if (!ready) return null;

  async function load(options: { preserveMessage?: boolean; showSpinner?: boolean } = {}) {
    const { preserveMessage = false, showSpinner = true } = options;

    if (showSpinner) setLoading(true);
    if (!preserveMessage) setMessage("");

    try {
      const me = await authApi.me();
      setUser(me.user);

      const results = await Promise.allSettled(
        SELLER_LISTING_STATUSES.map((status) =>
          listingsApi.list({ status, ownerId: me.user.user_id })
        )
      );

      const fulfilled = results
        .filter(
          (
            result
          ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof listingsApi.list>>> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value.items);

      if (fulfilled.length === 0) {
        const firstError = results.find(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        throw firstError?.reason || new Error("Could not load your listings.");
      }

      const merged = mergeSellerListings(fulfilled);
      setItems(merged);
      return merged;
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load my listings");
      return [] as Listing[];
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  async function refreshListingCards(listingId?: number) {
    const updated = await load({ preserveMessage: true, showSpinner: false });
    if (listingId) {
      const nextEditingItem = updated.find((item) => item.listing_id === listingId) || null;
      setEditingItem(nextEditingItem);
    }
    return updated;
  }

  async function loadImages(listingId: number) {
    setLoadingImages(true);
    try {
      const response = await listingsApi.listImages(listingId);
      setEditingImages(response.items);
      return response.items;
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load listing photos.");
      setEditingImages([]);
      return [] as ListingImageRecord[];
    } finally {
      setLoadingImages(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function confirmDiscardChanges() {
    if (!hasUnsavedChanges || typeof window === "undefined") return true;
    return window.confirm("You have unsaved listing changes. Leave this editor anyway?");
  }

  async function openEditor(item: Listing) {
    if (editingItem?.listing_id !== item.listing_id && !confirmDiscardChanges()) {
      return;
    }

    const nextForm = buildEditState(item);
    setEditingItem(item);
    setFormState(nextForm);
    setFormSnapshot(nextForm);
    await loadImages(item.listing_id);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("listing-editor")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  function closeEditor() {
    if (!confirmDiscardChanges()) return;
    setEditingItem(null);
    setEditingImages([]);
    setFormState(null);
    setFormSnapshot(null);
  }

  function updateForm<K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) {
    setFormState((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingItem || !formState) return;

    setSaving(true);
    try {
      await listingsApi.update(editingItem.listing_id, {
        asking_price: Number(formState.askingPrice),
        mileage_km: formState.mileageKm ? Number(formState.mileageKm) : undefined,
        location_city: formState.locationCity,
        location_country_code: formState.countryCode.trim().toUpperCase(),
        description: formState.description,
        status: formState.status,
      });

      setFormSnapshot(formState);
      setTone("success");
      setMessage("Listing details updated successfully.");
      await refreshListingCards(editingItem.listing_id);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!editingItem || files.length === 0) return;

    const selectionErrors = validateSelectedImageFiles(files, editingImages.length);
    if (selectionErrors.length > 0) {
      setTone("error");
      setMessage(selectionErrors[0].message);
      return;
    }

    setPhotoActionKey("upload");

    try {
      const optimized = await Promise.all(files.map((file) => optimizeListingImageFile(file)));
      const preparedErrors = validatePreparedListingImages(optimized);

      if (preparedErrors.length > 0) {
        setTone("error");
        setMessage(preparedErrors[0].message);
        return;
      }

      await listingsApi.uploadImages(editingItem.listing_id, optimized);
      await loadImages(editingItem.listing_id);
      await refreshListingCards(editingItem.listing_id);
      setTone("success");
      setMessage("Listing photos uploaded.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not upload listing photos.");
    } finally {
      setPhotoActionKey(null);
    }
  }

  async function handleDeleteImage(imageId: number) {
    if (!editingItem) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this listing photo?")) {
      return;
    }

    setPhotoActionKey(`delete-${imageId}`);

    try {
      await listingsApi.deleteImage(editingItem.listing_id, imageId);
      await loadImages(editingItem.listing_id);
      await refreshListingCards(editingItem.listing_id);
      setTone("success");
      setMessage("Listing photo removed.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not remove this photo.");
    } finally {
      setPhotoActionKey(null);
    }
  }

  async function reorderImages(imageIds: number[], successMessage: string) {
    if (!editingItem) return;

    setPhotoActionKey("reorder");

    try {
      const response = await listingsApi.reorderImages(editingItem.listing_id, imageIds);
      setEditingImages(response.items);
      await refreshListingCards(editingItem.listing_id);
      setTone("success");
      setMessage(successMessage);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not update photo order.");
    } finally {
      setPhotoActionKey(null);
    }
  }

  async function moveImage(imageId: number, direction: "left" | "right") {
    const orderedIds = editingImages
      .map((image) => image.listing_image_id)
      .filter((value): value is number => Number.isFinite(value));

    const currentIndex = orderedIds.indexOf(imageId);
    if (currentIndex < 0) return;

    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedIds.length) return;

    const nextIds = [...orderedIds];
    [nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]];

    await reorderImages(
      nextIds,
      direction === "left" ? "Photo moved earlier." : "Photo moved later."
    );
  }

  async function setCoverImage(imageId: number) {
    const orderedIds = editingImages
      .map((image) => image.listing_image_id)
      .filter((value): value is number => Number.isFinite(value));

    const remainingIds = orderedIds.filter((id) => id !== imageId);
    await reorderImages([imageId, ...remainingIds], "Cover photo updated.");
  }

  async function handleReplaceImage(
    image: ListingImageRecord,
    index: number,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!editingItem || !file || !image.listing_image_id) return;

    const selectionErrors = validateSelectedImageFiles(
      [file],
      Math.max(editingImages.length - 1, 0)
    );

    if (selectionErrors.length > 0) {
      setTone("error");
      setMessage(selectionErrors[0].message);
      return;
    }

    setPhotoActionKey(`replace-${image.listing_image_id}`);

    try {
      const optimized = await optimizeListingImageFile(file);
      const preparedErrors = validatePreparedListingImages([optimized]);

      if (preparedErrors.length > 0) {
        setTone("error");
        setMessage(preparedErrors[0].message);
        return;
      }

      const upload = await listingsApi.uploadImages(editingItem.listing_id, [optimized]);
      const replacementId = upload.items[0]?.listing_image_id;

      if (!replacementId) {
        throw new Error("Could not create a replacement photo.");
      }

      try {
        await listingsApi.deleteImage(editingItem.listing_id, image.listing_image_id);
      } catch (error) {
        await listingsApi.deleteImage(editingItem.listing_id, replacementId).catch(() => null);
        throw error;
      }

      const refreshed = await listingsApi.listImages(editingItem.listing_id);
      const orderedIds = refreshed.items
        .map((item) => item.listing_image_id)
        .filter((value): value is number => Number.isFinite(value))
        .filter((id) => id !== replacementId);

      orderedIds.splice(index, 0, replacementId);
      const reordered = await listingsApi.reorderImages(editingItem.listing_id, orderedIds);
      setEditingImages(reordered.items);
      await refreshListingCards(editingItem.listing_id);
      setTone("success");
      setMessage("Listing photo replaced.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not replace this photo.");
    } finally {
      setPhotoActionKey(null);
    }
  }

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.9))] p-6 md:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Seller control
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">My listings</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Keep your cars sale-ready with pricing updates, richer notes, status changes, and
                a photo gallery buyers can trust.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] bg-cars-primary p-5 text-white shadow-[0_18px_44px_rgba(15,45,98,0.18)] sm:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                  Account owner
                </p>
                <p className="mt-2 text-2xl font-apercu-bold">{user?.name || "Loading..."}</p>
                <p className="mt-1 text-sm text-white/80">{user?.email || "Fetching account"}</p>
              </div>
              <div className="rounded-[24px] border border-cars-primary/10 bg-white px-4 py-4 text-cars-primary shadow-[0_16px_34px_rgba(15,45,98,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Total listings
                </p>
                <p className="mt-2 text-2xl font-apercu-bold">{sellerStats.total}</p>
              </div>
              <div className="rounded-[24px] border border-cars-primary/10 bg-white px-4 py-4 text-cars-primary shadow-[0_16px_34px_rgba(15,45,98,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Live now
                </p>
                <p className="mt-2 text-2xl font-apercu-bold">{sellerStats.active}</p>
              </div>
              <div className="rounded-[24px] border border-cars-primary/10 bg-white px-4 py-4 text-cars-primary shadow-[0_16px_34px_rgba(15,45,98,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Photos added
                </p>
                <p className="mt-2 text-2xl font-apercu-bold">{sellerStats.photos}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-cars-gray">
            {loading
              ? "Loading your listings..."
              : `${items.length} listing${items.length === 1 ? "" : "s"} across active, reserved, sold, and hidden statuses`}
          </p>
          <Link
            href="/sell"
            className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary"
          >
            Create another listing
          </Link>
        </div>

        {!loading && items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No listings yet"
              description="Create your first marketplace listing to start managing price, photos, and buyer-ready details."
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.listing_id}
              className="section-shell overflow-hidden p-4 text-sm md:p-5"
            >
              <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
                <div>
                  <ListingImage
                    href={`/listings/${item.listing_id}`}
                    title={buildListingMetaTitle(item)}
                    image={getListingImages(item)[0] || null}
                    imageCount={item.image_count || getListingImages(item).length}
                    photoSourceLabel={
                      item.photo_source === "listing"
                        ? "Seller photos"
                        : item.photo_source === "catalog"
                          ? "Catalog photos"
                          : null
                    }
                  />
                </div>

                <div className="flex flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                        {buildListingEyebrow(item)}
                      </p>
                      <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
                        {buildListingTitle(item)}
                      </h2>
                      <p className="mt-3 text-2xl font-apercu-bold text-cars-primary">
                        {formatListingPrice(item.asking_price)}
                      </p>
                    </div>
                    <span className="rounded-full bg-cars-off-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cars-primary">
                      {formatLabel(item.status)}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-cars-off-white px-3 py-2 text-xs font-medium text-cars-primary">
                      <Camera className="h-3.5 w-3.5 text-cars-accent" />
                      {formatPhotoCount(item.image_count || getListingImages(item).length)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-cars-off-white px-3 py-2 text-xs font-medium text-cars-primary">
                      <MapPin className="h-3.5 w-3.5 text-cars-accent" />
                      {formatLocation(item.location_city, item.location_country_code)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-cars-off-white px-3 py-2 text-xs font-medium text-cars-primary">
                      <PencilLine className="h-3.5 w-3.5 text-cars-accent" />
                      {formatMileage(item.mileage_km)}
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-3 leading-6 text-cars-gray">
                    {item.description ||
                      "Add seller notes to highlight condition, service history, and anything a buyer should know before they contact you."}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    <button
                      type="button"
                      onClick={() => void openEditor(item)}
                      className="rounded-full bg-cars-primary px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Manage listing
                    </button>
                    <Link
                      href={`/listings/${item.listing_id}`}
                      className="rounded-full border border-cars-primary/15 px-4 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                    >
                      View live
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {editingItem && formState ? (
          <section id="listing-editor" className="section-shell mt-8 overflow-hidden p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Listing management
                </p>
                <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                  {buildListingTitle(editingItem)}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                  Update the listing details buyers care about most, then manage the photo gallery
                  that appears on your live listing.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/listings/${editingItem.listing_id}`}
                  className="rounded-full border border-cars-primary/15 px-4 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                >
                  Preview live listing
                </Link>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-full border border-cars-primary/15 px-4 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
                >
                  Close editor
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <form
                onSubmit={saveEdit}
                className="rounded-[28px] border border-cars-gray-light/70 bg-white p-5 shadow-[0_20px_44px_rgba(15,45,98,0.06)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                      Listing details
                    </p>
                    <p className="mt-2 text-sm text-cars-gray">
                      Price, mileage, location, notes, and sale status.
                    </p>
                  </div>
                  <span className="rounded-full bg-cars-off-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cars-primary">
                    {formatLabel(formState.status)}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-cars-primary">
                    Asking price
                    <input
                      className="mt-2 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                      value={formState.askingPrice}
                      onChange={(event) => updateForm("askingPrice", event.target.value)}
                      placeholder="Enter asking price"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="text-sm font-medium text-cars-primary">
                    Mileage (km)
                    <input
                      className="mt-2 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                      value={formState.mileageKm}
                      onChange={(event) => updateForm("mileageKm", event.target.value)}
                      placeholder="Mileage"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="text-sm font-medium text-cars-primary">
                    City
                    <input
                      className="mt-2 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                      value={formState.locationCity}
                      onChange={(event) => updateForm("locationCity", event.target.value)}
                      placeholder="City"
                    />
                  </label>

                  <label className="text-sm font-medium text-cars-primary">
                    Country code
                    <input
                      className="mt-2 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm uppercase"
                      value={formState.countryCode}
                      onChange={(event) =>
                        updateForm("countryCode", event.target.value.toUpperCase())
                      }
                      placeholder="VN"
                      maxLength={2}
                    />
                  </label>

                  <label className="text-sm font-medium text-cars-primary md:col-span-2">
                    Listing status
                    <select
                      className="mt-2 h-11 w-full rounded-full border border-cars-gray-light px-4 text-sm"
                      value={formState.status}
                      onChange={(event) =>
                        updateForm("status", event.target.value as ListingStatus)
                      }
                    >
                      {SELLER_LISTING_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {formatLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-medium text-cars-primary md:col-span-2">
                    Seller notes & condition
                    <textarea
                      className="mt-2 min-h-[180px] w-full rounded-[24px] border border-cars-gray-light px-4 py-3 text-sm"
                      value={formState.description}
                      onChange={(event) => updateForm("description", event.target.value)}
                      placeholder="Highlight ownership history, service work, condition details, or anything a serious buyer should know."
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={saving || !hasUnsavedChanges}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary"
                  >
                    Cancel
                  </button>
                  <span className="text-sm text-cars-gray">
                    {hasUnsavedChanges
                      ? "You have unsaved changes."
                      : "All listing details are up to date."}
                  </span>
                </div>
              </form>

              <div className="rounded-[28px] border border-cars-gray-light/70 bg-white p-5 shadow-[0_20px_44px_rgba(15,45,98,0.06)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                      Photos
                    </p>
                    <h3 className="mt-2 text-xl font-apercu-bold text-cars-primary">
                      {editingImages.length > 0
                        ? `${formatPhotoCount(editingImages.length)} ready`
                        : "Build your gallery"}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-cars-gray">
                      The first photo becomes your cover image. Upload up to{" "}
                      {LISTING_IMAGE_CLIENT_LIMITS.maxCount} JPG, PNG, or WEBP files and
                      rearrange them to control the order buyers see.
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-cars-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cars-primary/20 transition hover:bg-cars-accent">
                    {photoActionKey === "upload" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    Add photos
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(event) => void handleAddImages(event)}
                      disabled={Boolean(photoActionKey)}
                    />
                  </label>
                </div>

                <p className="mt-3 text-xs leading-5 text-cars-gray">
                  Up to {LISTING_IMAGE_CLIENT_LIMITS.maxCount} photos per listing, optimized before
                  upload. Large originals are compressed automatically so buyers still get a fast
                  gallery.
                </p>

                {loadingImages ? (
                  <div className="mt-6 flex items-center gap-2 rounded-[24px] bg-cars-off-white px-4 py-4 text-sm text-cars-gray">
                    <LoaderCircle className="h-4 w-4 animate-spin text-cars-accent" />
                    Loading listing photos...
                  </div>
                ) : null}

                {!loadingImages && editingImages.length === 0 ? (
                  <div className="mt-6">
                    <EmptyState
                      title="No seller photos yet"
                      description="Add photos now so buyers can recognize the car at a glance and feel more confident reaching out."
                    />
                  </div>
                ) : null}

                {!loadingImages && editingImages.length > 0 ? (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {editingImages.map((image, index) => {
                      const imageId = image.listing_image_id;
                      const busy = Boolean(photoActionKey);

                      return (
                        <article
                          key={imageId || `${image.url}-${index}`}
                          className="overflow-hidden rounded-[24px] border border-cars-gray-light/70 bg-cars-off-white/40"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(180deg,rgba(235,242,255,1),rgba(247,250,255,1))]">
                            {image.url ? (
                              <img
                                src={image.url}
                                alt={`${buildListingTitle(editingItem)} photo ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-cars-primary">
                                <Camera className="h-8 w-8" />
                              </div>
                            )}
                            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                              <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
                                Photo {index + 1}
                              </span>
                              {index === 0 ? (
                                <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cars-primary shadow-sm">
                                  Cover
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-cars-primary">
                                {buildImageSummary(image)}
                              </p>
                              {image.bytes ? (
                                <p className="text-xs text-cars-gray">
                                  {Math.max(1, Math.round(image.bytes / 1024 / 1024))} MB
                                </p>
                              ) : null}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {index > 0 && imageId ? (
                                <button
                                  type="button"
                                  onClick={() => void setCoverImage(imageId)}
                                  disabled={busy}
                                  className="rounded-full border border-cars-primary/15 px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Set cover
                                </button>
                              ) : null}

                              {imageId ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void moveImage(imageId, "left")}
                                    disabled={busy || index === 0}
                                    className="inline-flex items-center gap-1 rounded-full border border-cars-primary/15 px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <MoveHorizontal className="h-3.5 w-3.5" />
                                    Move earlier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void moveImage(imageId, "right")}
                                    disabled={busy || index === editingImages.length - 1}
                                    className="inline-flex items-center gap-1 rounded-full border border-cars-primary/15 px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <MoveHorizontal className="h-3.5 w-3.5" />
                                    Move later
                                  </button>
                                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-cars-primary/15 px-3 py-2 text-xs font-semibold text-cars-primary transition-colors hover:bg-white">
                                    Replace
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      className="hidden"
                                      disabled={busy}
                                      onChange={(event) =>
                                        void handleReplaceImage(image, index, event)
                                      }
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteImage(imageId)}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
