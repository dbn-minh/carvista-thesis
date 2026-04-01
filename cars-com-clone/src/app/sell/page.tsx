"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import ListingDetailsForm from "@/components/sell/ListingDetailsForm";
import ListingReviewPanel from "@/components/sell/ListingReviewPanel";
import PhotoUploader from "@/components/sell/PhotoUploader";
import PriceLocationForm from "@/components/sell/PriceLocationForm";
import SellerDescriptionForm from "@/components/sell/SellerDescriptionForm";
import SellProgress from "@/components/sell/SellProgress";
import VehicleSelector from "@/components/sell/VehicleSelector";
import {
  createObjectPreviewUrl,
  optimizeListingImageFile,
  revokeObjectPreviewUrl,
  validatePreparedListingImages,
  validateSelectedImageFiles,
} from "@/components/sell/listing-image-upload-client";
import {
  composeListingDescription,
  findSelectedMake,
  findSelectedModel,
  findSelectedVariant,
  initialSellForm,
  sellSteps,
  type PhotoDraft,
  type SellFieldErrors,
  type SellStepId,
  type VehicleMode,
} from "@/components/sell/sell-utils";
import { catalogApi, listingsApi } from "@/lib/carvista-api";
import { useRequireLogin } from "@/lib/auth-guard";
import type { Make, Model, VariantListItem } from "@/lib/types";

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function SellPage() {
  const router = useRouter();
  const ready = useRequireLogin("/sell");
  const [form, setForm] = useState(initialSellForm);
  const [currentStep, setCurrentStep] = useState<SellStepId>("vehicle");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SellFieldErrors>({});
  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [variants, setVariants] = useState<VariantListItem[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const photoUrlsRef = useRef<string[]>([]);

  const currentStepIndex = sellSteps.findIndex((step) => step.id === currentStep);
  const currentStepMeta = sellSteps[currentStepIndex];
  const selectedMake = useMemo(
    () => findSelectedMake(makes, form.selectedMakeId),
    [makes, form.selectedMakeId]
  );
  const selectedModel = useMemo(
    () => findSelectedModel(models, form.selectedModelId),
    [models, form.selectedModelId]
  );
  const selectedVariant = useMemo(
    () => findSelectedVariant(variants, form.selectedVariantId),
    [variants, form.selectedVariantId]
  );

  useEffect(() => {
    async function loadMakes() {
      setLoadingMakes(true);
      try {
        const response = await catalogApi.makes();
        setMakes(response.items);
      } catch (error) {
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Could not load makes");
      } finally {
        setLoadingMakes(false);
      }
    }

    void loadMakes();
  }, []);

  useEffect(() => {
    async function loadModels() {
      if (!form.selectedMakeId) {
        setModels([]);
        return;
      }

      setLoadingModels(true);
      try {
        const response = await catalogApi.models(Number(form.selectedMakeId));
        setModels(response.items);
      } catch (error) {
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Could not load models");
      } finally {
        setLoadingModels(false);
      }
    }

    if (form.vehicleMode === "catalog") {
      void loadModels();
    }
  }, [form.selectedMakeId, form.vehicleMode]);

  useEffect(() => {
    async function loadVariants() {
      if (!selectedMake || !selectedModel) {
        setVariants([]);
        return;
      }

      setLoadingVariants(true);
      try {
        const response = await catalogApi.variants({
          make: selectedMake.name,
          model: selectedModel.name,
        });
        setVariants(response.items);
      } catch (error) {
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Could not load variants");
      } finally {
        setLoadingVariants(false);
      }
    }

    if (form.vehicleMode === "catalog") {
      void loadVariants();
    }
  }, [form.vehicleMode, selectedMake, selectedModel]);

  useEffect(() => {
    photoUrlsRef.current = form.photos
      .map((photo) => photo.previewUrl)
      .filter((value): value is string => Boolean(value));
  }, [form.photos]);

  useEffect(() => {
    return () => {
      photoUrlsRef.current.forEach((url) => revokeObjectPreviewUrl(url));
    };
  }, []);

  if (!ready) return null;

  function updateForm<Key extends keyof typeof form>(field: Key, value: (typeof form)[Key]) {
    const errorKeyMap: Partial<Record<keyof typeof form, string>> = {
      mileageKm: "mileageKm",
      askingPrice: "askingPrice",
      city: "city",
      countryCode: "countryCode",
    };

    const errorKey = errorKeyMap[field];
    if (errorKey) {
      setFieldErrors((current) => ({ ...current, [errorKey]: undefined }));
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateCatalogField(
    field: "selectedMakeId" | "selectedModelId" | "selectedYear" | "selectedVariantId",
    value: string
  ) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));

    setForm((current) => {
      if (field === "selectedMakeId") {
        return {
          ...current,
          selectedMakeId: value,
          selectedModelId: "",
          selectedYear: "",
          selectedVariantId: "",
        };
      }

      if (field === "selectedModelId") {
        return {
          ...current,
          selectedModelId: value,
          selectedYear: "",
          selectedVariantId: "",
        };
      }

      if (field === "selectedYear") {
        return {
          ...current,
          selectedYear: value,
          selectedVariantId: "",
        };
      }

      return {
        ...current,
        selectedVariantId: value,
      };
    });
  }

  function handleVehicleModeChange(mode: VehicleMode) {
    setFieldErrors({});
    setForm((current) => {
      if (mode === "custom" && current.customVehicle.make === "" && selectedMake) {
        return {
          ...current,
          vehicleMode: mode,
          customVehicle: {
            ...current.customVehicle,
            make: selectedMake.name,
            model: selectedModel?.name || "",
            year: current.selectedYear,
            trimName: selectedVariant?.trim_name || "",
            bodyType: selectedVariant?.body_type || "",
            transmission: selectedVariant?.transmission || "",
            fuelType: selectedVariant?.fuel_type || "",
            drivetrain: selectedVariant?.drivetrain || "",
            engine: selectedVariant?.engine || "",
          },
        };
      }

      return {
        ...current,
        vehicleMode: mode,
      };
    });
  }

  function updateCustomVehicle(field: keyof typeof form.customVehicle, value: string) {
    setFieldErrors((current) => ({ ...current, [`custom${field[0].toUpperCase()}${field.slice(1)}`]: undefined }));
    setForm((current) => ({
      ...current,
      customVehicle: {
        ...current.customVehicle,
        [field]: value,
      },
    }));
  }

  async function handlePhotoSelection(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    const validationErrors = validateSelectedImageFiles(list, form.photos.length);
    if (validationErrors.length > 0) {
      setTone("error");
      setMessage(validationErrors[0].message);
      setFieldErrors((current) => ({ ...current, photos: validationErrors[0].message }));
      return;
    }

    const drafts: PhotoDraft[] = list.map((file, index) => ({
      id: buildId(`photo-${index}`),
      name: file.name,
      size: file.size,
      file: null,
      previewUrl: null,
      mimeType: file.type,
      progress: 5,
      isCover: form.photos.length === 0 && index === 0,
      status: "processing",
      error: null,
    }));

    setForm((current) => ({
      ...current,
      photos: [...current.photos, ...drafts],
    }));

    for (let index = 0; index < list.length; index += 1) {
      const originalFile = list[index];
      const draft = drafts[index];

      try {
        setForm((current) => ({
          ...current,
          photos: current.photos.map((photo) =>
            photo.id === draft.id ? { ...photo, progress: 30 } : photo
          ),
        }));

        const optimizedFile = await optimizeListingImageFile(originalFile);
        const optimizedFileErrors = validatePreparedListingImages([optimizedFile]).filter(
          (issue) => issue.code === "file_too_large"
        );

        if (optimizedFileErrors.length > 0) {
          throw new Error(optimizedFileErrors[0].message);
        }

        const previewUrl = createObjectPreviewUrl(optimizedFile);

        setForm((current) => ({
          ...current,
          photos: current.photos.map((photo) => {
            if (photo.id !== draft.id) return photo;

            revokeObjectPreviewUrl(photo.previewUrl);

            return {
              ...photo,
              name: optimizedFile.name,
              size: optimizedFile.size,
              file: optimizedFile,
              previewUrl,
              mimeType: optimizedFile.type,
              progress: 100,
              status: "ready",
              error: null,
            };
          }),
        }));
      } catch (error) {
        setForm((current) => ({
          ...current,
          photos: current.photos.map((photo) =>
            photo.id === draft.id
              ? {
                  ...photo,
                  progress: 100,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "This image could not be processed.",
                }
              : photo
          ),
        }));
        setTone("error");
        setMessage(
          error instanceof Error ? error.message : "One image could not be processed."
        );
      }
    }

    setFieldErrors((current) => ({ ...current, photos: undefined }));
  }

  function setCoverPhoto(photoId: string) {
    setForm((current) => ({
      ...current,
      photos: current.photos.map((photo) => ({
        ...photo,
        isCover: photo.id === photoId,
      })),
    }));
  }

  function removePhoto(photoId: string) {
    setForm((current) => {
      const removed = current.photos.find((photo) => photo.id === photoId);
      revokeObjectPreviewUrl(removed?.previewUrl);
      const remaining = current.photos.filter((photo) => photo.id !== photoId);
      const hasCover = remaining.some((photo) => photo.isCover);
      return {
        ...current,
        photos: remaining.map((photo, index) => ({
          ...photo,
          isCover: hasCover ? photo.isCover : index === 0,
        })),
      };
    });
  }

  function movePhoto(photoId: string, direction: "left" | "right") {
    setForm((current) => {
      const next = [...current.photos];
      const index = next.findIndex((photo) => photo.id === photoId);
      if (index === -1) return current;

      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return current;

      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);

      return {
        ...current,
        photos: next,
      };
    });
  }

  function validateStep(step: SellStepId) {
    const errors: SellFieldErrors = {};

    if (step === "vehicle" || step === "review") {
      if (form.vehicleMode === "catalog") {
        if (!form.selectedMakeId) errors.selectedMakeId = "Choose the make first.";
        if (!form.selectedModelId) errors.selectedModelId = "Choose the model.";
        if (!form.selectedYear) errors.selectedYear = "Choose the year.";
        if (!form.selectedVariantId) errors.selectedVariantId = "Choose the exact variant.";
      } else {
        if (!form.customVehicle.make.trim()) errors.customMake = "Make is required.";
        if (!form.customVehicle.model.trim()) errors.customModel = "Model is required.";
        if (!/^\d{4}$/.test(form.customVehicle.year.trim())) {
          errors.customYear = "Enter a valid 4-digit year.";
        }
        if (!form.customVehicle.bodyType) errors.customBodyType = "Choose a body type.";
        if (!form.customVehicle.fuelType) errors.customFuelType = "Choose a fuel type.";
      }
    }

    if (step === "details" || step === "review") {
      if (!form.mileageKm.trim()) {
        errors.mileageKm = "Mileage is required.";
      } else if (!Number.isFinite(Number(form.mileageKm)) || Number(form.mileageKm) < 0) {
        errors.mileageKm = "Mileage must be a non-negative number.";
      }
    }

    if (step === "pricing" || step === "review") {
      if (!form.askingPrice.trim()) {
        errors.askingPrice = "Asking price is required.";
      } else if (!Number.isFinite(Number(form.askingPrice)) || Number(form.askingPrice) <= 0) {
        errors.askingPrice = "Enter a realistic asking price.";
      }

      if (!form.city.trim()) errors.city = "City is required.";
      if (!/^[A-Za-z]{2}$/.test(form.countryCode.trim())) {
        errors.countryCode = "Use a 2-letter country code such as VN.";
      }
    }

    if (step === "photos" && form.photos.length === 0) {
      errors.photos = "At least one photo is strongly recommended before you publish.";
    }

    return errors;
  }

  function goToStep(nextStep: SellStepId) {
    const stepPosition = sellSteps.findIndex((step) => step.id === nextStep);
    const currentPosition = sellSteps.findIndex((step) => step.id === currentStep);

    if (stepPosition > currentPosition) {
      const errors = validateStep(currentStep);
      setFieldErrors(errors);

      const blockingErrors =
        currentStep === "photos"
          ? Object.fromEntries(Object.entries(errors).filter(([key]) => key !== "photos"))
          : errors;

      if (Object.keys(blockingErrors).length > 0) {
        setTone("error");
        setMessage("Please fix the highlighted fields before moving on.");
        return;
      }

      if (errors.photos) {
        setTone("info");
        setMessage(errors.photos);
      } else {
        setMessage("");
      }
    }

    setCurrentStep(nextStep);
  }

  async function publishListing() {
    const errors = validateStep("review");
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setTone("error");
      setMessage("Please finish the required fields before publishing.");
      return;
    }

    if (form.photos.some((photo) => photo.status === "processing")) {
      setTone("info");
      setMessage("Please wait for your photos to finish processing before publishing.");
      return;
    }

    if (form.photos.some((photo) => photo.status === "error")) {
      setTone("error");
      setMessage("Remove or replace any photo that failed before publishing the listing.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const orderedPhotos = [
        ...form.photos.filter((photo) => photo.isCover),
        ...form.photos.filter((photo) => !photo.isCover),
      ].filter((photo) => photo.file && photo.status === "ready");

      const preparedFiles = orderedPhotos
        .map((photo) => photo.file)
        .filter((file): file is File => Boolean(file));
      const uploadErrors = validatePreparedListingImages(preparedFiles);

      if (uploadErrors.length > 0) {
        setTone("error");
        setMessage(uploadErrors[0].message);
        return;
      }

      const formData = new FormData();
      formData.set("asking_price", form.askingPrice);
      formData.set("mileage_km", form.mileageKm);
      formData.set("location_city", form.city.trim());
      formData.set("location_country_code", form.countryCode.trim().toUpperCase());
      formData.set("description", composeListingDescription(form, selectedVariant));
      formData.set("status", form.availabilityStatus);

      if (form.vehicleMode === "catalog") {
        formData.set("variant_id", form.selectedVariantId);
      } else {
        formData.set(
          "custom_vehicle",
          JSON.stringify({
            make: form.customVehicle.make.trim(),
            model: form.customVehicle.model.trim(),
            year: Number(form.customVehicle.year),
            trim_name: form.customVehicle.trimName.trim() || undefined,
            body_type: form.customVehicle.bodyType || undefined,
            transmission: form.customVehicle.transmission.trim() || undefined,
            fuel_type: form.customVehicle.fuelType || undefined,
            drivetrain: form.customVehicle.drivetrain.trim() || undefined,
            engine: form.customVehicle.engine.trim() || undefined,
            vin: form.customVehicle.vin.trim() || undefined,
          })
        );
      }

      preparedFiles.forEach((file) => {
        formData.append("images", file, file.name);
      });

      const response = await listingsApi.create(formData);
      const detailPath = response.detail_path || `/listings/${response.listing_id}`;
      setTone("success");
      setMessage("Listing published successfully. Redirecting to your listing...");
      router.replace(detailPath);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Create listing failed");
    } finally {
      setLoading(false);
    }
  }

  function renderStep() {
    if (currentStep === "vehicle") {
      return (
        <VehicleSelector
          vehicleMode={form.vehicleMode}
          onModeChange={handleVehicleModeChange}
          makes={makes}
          models={models}
          variants={
            form.selectedYear
              ? variants.filter((variant) => String(variant.model_year) === form.selectedYear)
              : variants
          }
          selectedMakeId={form.selectedMakeId}
          selectedModelId={form.selectedModelId}
          selectedYear={form.selectedYear}
          selectedVariantId={form.selectedVariantId}
          customVehicle={form.customVehicle}
          loadingModels={loadingModels || loadingMakes}
          loadingVariants={loadingVariants}
          onCatalogChange={updateCatalogField}
          onCustomChange={updateCustomVehicle}
          errors={fieldErrors}
        />
      );
    }

    if (currentStep === "photos") {
      return (
        <PhotoUploader
          photos={form.photos}
          isDragging={isDraggingPhotos}
          onFilesSelected={handlePhotoSelection}
          onDragStateChange={setIsDraggingPhotos}
          onSetCover={setCoverPhoto}
          onRemove={removePhoto}
          onMove={movePhoto}
          errors={fieldErrors}
        />
      );
    }

    if (currentStep === "details") {
      return (
        <ListingDetailsForm
          mileageKm={form.mileageKm}
          condition={form.condition}
          exteriorColor={form.exteriorColor}
          interiorColor={form.interiorColor}
          ownersCount={form.ownersCount}
          onChange={(field, value) => updateForm(field, value)}
          errors={fieldErrors}
        />
      );
    }

    if (currentStep === "pricing") {
      return (
        <PriceLocationForm
          askingPrice={form.askingPrice}
          negotiable={form.negotiable}
          city={form.city}
          countryCode={form.countryCode}
          availabilityStatus={form.availabilityStatus}
          contactPreference={form.contactPreference}
          onChange={(field, value) => updateForm(field, value)}
          onToggleNegotiable={(value) => updateForm("negotiable", value)}
          errors={fieldErrors}
        />
      );
    }

    if (currentStep === "description") {
      return (
        <SellerDescriptionForm
          sellerDescription={form.sellerDescription}
          maintenanceHistory={form.maintenanceHistory}
          accidentHistory={form.accidentHistory}
          upgradeNotes={form.upgradeNotes}
          reasonForSelling={form.reasonForSelling}
          onChange={(field, value) => updateForm(field, value)}
        />
      );
    }

    return (
      <section className="section-shell p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">Step 6</p>
        <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">Review before publishing</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
          Check the preview, confirm the essentials, and then publish the listing to the marketplace.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-cars-primary/10 bg-cars-off-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
              Publish summary
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-cars-gray">
              <li>Vehicle source: {form.vehicleMode === "catalog" ? "Catalog match" : "Custom vehicle path"}</li>
              <li>Photos staged: {form.photos.length}</li>
              <li>Availability: {form.availabilityStatus === "active" ? "Publish now" : "Hidden draft"}</li>
              <li>Location: {form.city || "City pending"}, {form.countryCode || "--"}</li>
            </ul>
          </div>

          <div className="rounded-[24px] border border-cars-primary/10 bg-white p-5 shadow-[0_12px_28px_rgba(15,45,98,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
              Before you publish
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-cars-gray">
              <li>Make sure the mileage and price are accurate.</li>
              <li>Use the best exterior shot as the cover photo.</li>
              <li>Mention service history and any major repairs clearly.</li>
              <li>Listings with stronger photos and notes usually earn more buyer trust.</li>
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="rounded-[32px] border border-cars-gray-light/70 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(241,246,255,0.96))] p-6 shadow-[0_18px_44px_rgba(15,45,98,0.08)] md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Seller workflow
              </p>
              <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Sell your car</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Build a listing the way real sellers expect to: pick the vehicle clearly, add photos early, review the listing, and publish with confidence.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalog"
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-white"
              >
                Browse catalog
              </Link>
              <Link
                href="/my-listings"
                className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Manage my listings
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <StatusBanner tone={tone}>{message}</StatusBanner>
        </div>

        <div className="mt-6">
          <SellProgress currentStep={currentStep} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            {renderStep()}

            <div className="section-shell flex flex-wrap items-center justify-between gap-3 p-6">
              <button
                type="button"
                onClick={() => goToStep(sellSteps[Math.max(0, currentStepIndex - 1)].id)}
                disabled={currentStepIndex === 0}
                className="rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary disabled:opacity-40"
              >
                Back
              </button>

              <div className="flex flex-wrap gap-3">
                {currentStep !== "review" ? (
                  <button
                    type="button"
                    onClick={() => goToStep(sellSteps[Math.min(sellSteps.length - 1, currentStepIndex + 1)].id)}
                    className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void publishListing()}
                    disabled={loading}
                    className="rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {loading ? "Publishing..." : "Publish listing"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <ListingReviewPanel
            form={form}
            selectedVariant={selectedVariant}
            currentStepTitle={currentStepMeta.title}
          />
        </div>
      </main>
    </>
  );
}
