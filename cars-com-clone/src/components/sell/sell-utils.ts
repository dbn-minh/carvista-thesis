import { toCurrency } from "@/lib/api-client";
import type { Make, Model, VariantListItem } from "@/lib/types";

export const conditionOptions = [
  "Excellent",
  "Good",
  "Fair",
  "Needs work",
] as const;

export const bodyTypeOptions = [
  { value: "sedan", label: "Sedan" },
  { value: "hatchback", label: "Hatchback" },
  { value: "suv", label: "SUV" },
  { value: "cuv", label: "CUV" },
  { value: "mpv", label: "MPV" },
  { value: "pickup", label: "Pickup" },
  { value: "coupe", label: "Coupe" },
  { value: "convertible", label: "Convertible" },
  { value: "wagon", label: "Wagon" },
  { value: "van", label: "Van" },
  { value: "other", label: "Other" },
] as const;

export const fuelTypeOptions = [
  { value: "gasoline", label: "Gasoline" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "phev", label: "Plug-in hybrid" },
  { value: "ev", label: "Electric" },
  { value: "other", label: "Other" },
] as const;

export type SellStepId =
  | "vehicle"
  | "photos"
  | "details"
  | "pricing"
  | "description"
  | "review";

export type SellStep = {
  id: SellStepId;
  title: string;
  description: string;
};

export const sellSteps: SellStep[] = [
  {
    id: "vehicle",
    title: "Vehicle",
    description: "Choose the car from the catalog or enter a custom vehicle.",
  },
  {
    id: "photos",
    title: "Photos",
    description: "Add strong, trust-building photos before buyers open the listing.",
  },
  {
    id: "details",
    title: "Details",
    description: "Add mileage, condition, and ownership context.",
  },
  {
    id: "pricing",
    title: "Price",
    description: "Set the price, city, and listing availability.",
  },
  {
    id: "description",
    title: "Description",
    description: "Tell buyers the story of the car and its history.",
  },
  {
    id: "review",
    title: "Review",
    description: "Check the preview and publish the listing.",
  },
];

export type VehicleMode = "catalog" | "custom";

export type CustomVehicleDraft = {
  make: string;
  model: string;
  year: string;
  trimName: string;
  bodyType: string;
  transmission: string;
  fuelType: string;
  drivetrain: string;
  engine: string;
  vin: string;
  licensePlate: string;
};

export type PhotoDraft = {
  id: string;
  name: string;
  size: number;
  file: File | null;
  previewUrl: string | null;
  mimeType: string | null;
  progress: number;
  isCover: boolean;
  status: "processing" | "ready" | "error";
  error?: string | null;
};

export type SellFormState = {
  vehicleMode: VehicleMode;
  selectedMakeId: string;
  selectedModelId: string;
  selectedYear: string;
  selectedVariantId: string;
  customVehicle: CustomVehicleDraft;
  mileageKm: string;
  condition: string;
  exteriorColor: string;
  interiorColor: string;
  ownersCount: string;
  askingPrice: string;
  negotiable: boolean;
  city: string;
  countryCode: string;
  availabilityStatus: "active" | "hidden";
  contactPreference: string;
  sellerDescription: string;
  maintenanceHistory: string;
  accidentHistory: string;
  upgradeNotes: string;
  reasonForSelling: string;
  photos: PhotoDraft[];
};

export type SellFieldErrors = Partial<Record<string, string>>;

export const initialCustomVehicle: CustomVehicleDraft = {
  make: "",
  model: "",
  year: "",
  trimName: "",
  bodyType: "",
  transmission: "",
  fuelType: "",
  drivetrain: "",
  engine: "",
  vin: "",
  licensePlate: "",
};

export const initialSellForm: SellFormState = {
  vehicleMode: "catalog",
  selectedMakeId: "",
  selectedModelId: "",
  selectedYear: "",
  selectedVariantId: "",
  customVehicle: initialCustomVehicle,
  mileageKm: "",
  condition: "Good",
  exteriorColor: "",
  interiorColor: "",
  ownersCount: "",
  askingPrice: "",
  negotiable: true,
  city: "",
  countryCode: "VN",
  availabilityStatus: "active",
  contactPreference: "Phone or email",
  sellerDescription: "",
  maintenanceHistory: "",
  accidentHistory: "",
  upgradeNotes: "",
  reasonForSelling: "",
  photos: [],
};

export const photoTips = [
  "Front exterior",
  "Rear exterior",
  "Side profile",
  "Dashboard",
  "Interior seats",
  "Odometer",
  "Engine bay",
  "Trunk",
] as const;

export function buildVariantYears(variants: VariantListItem[]): number[] {
  return Array.from(
    new Set(
      variants
        .map((variant) => variant.model_year)
        .filter((value): value is number => Number.isFinite(Number(value)))
    )
  ).sort((a, b) => b - a);
}

export function buildVariantTitle(variant: VariantListItem): string {
  return [variant.make_name, variant.model_name, variant.trim_name].filter(Boolean).join(" ");
}

export function buildVariantSubtitle(variant: VariantListItem): string {
  return [
    variant.model_year,
    formatOptionLabel(variant.body_type),
    formatOptionLabel(variant.fuel_type),
    variant.transmission || "Transmission pending",
  ]
    .filter(Boolean)
    .join(" - ");
}

export function findSelectedMake(makes: Make[], makeId: string): Make | null {
  const id = Number(makeId);
  return makes.find((make) => make.make_id === id) || null;
}

export function findSelectedModel(models: Model[], modelId: string): Model | null {
  const id = Number(modelId);
  return models.find((model) => model.model_id === id) || null;
}

export function findSelectedVariant(
  variants: VariantListItem[],
  variantId: string
): VariantListItem | null {
  const id = Number(variantId);
  return variants.find((variant) => variant.variant_id === id) || null;
}

export function composeListingDescription(form: SellFormState, selectedVariant: VariantListItem | null): string {
  const sections: string[] = [];

  if (form.sellerDescription.trim()) {
    sections.push(form.sellerDescription.trim());
  }

  const overview = [
    form.condition ? `Condition: ${form.condition}` : null,
    form.exteriorColor ? `Exterior color: ${form.exteriorColor}` : null,
    form.interiorColor ? `Interior color: ${form.interiorColor}` : null,
    form.ownersCount ? `Owners: ${form.ownersCount}` : null,
    form.negotiable ? "Price: Negotiable" : "Price: Firm",
    form.contactPreference ? `Contact preference: ${form.contactPreference}` : null,
  ].filter(Boolean);

  if (overview.length > 0) {
    sections.push(overview.join("\n"));
  }

  if (form.maintenanceHistory.trim()) {
    sections.push(`Maintenance history:\n${form.maintenanceHistory.trim()}`);
  }

  if (form.accidentHistory.trim()) {
    sections.push(`Accident history:\n${form.accidentHistory.trim()}`);
  }

  if (form.upgradeNotes.trim()) {
    sections.push(`Upgrades and accessories:\n${form.upgradeNotes.trim()}`);
  }

  if (form.reasonForSelling.trim()) {
    sections.push(`Reason for selling:\n${form.reasonForSelling.trim()}`);
  }

  const disclosures = [
    form.customVehicle.vin.trim() ? `VIN: ${form.customVehicle.vin.trim()}` : null,
    form.customVehicle.licensePlate.trim()
      ? `License plate: ${form.customVehicle.licensePlate.trim()}`
      : null,
    selectedVariant
      ? `Catalog vehicle: ${buildVariantTitle(selectedVariant)}`
      : form.vehicleMode === "custom"
        ? `Custom vehicle entry: ${buildCustomVehicleTitle(form.customVehicle)}`
        : null,
  ].filter(Boolean);

  if (disclosures.length > 0) {
    sections.push(disclosures.join("\n"));
  }

  return sections.filter(Boolean).join("\n\n").trim();
}

export function buildCustomVehicleTitle(vehicle: CustomVehicleDraft): string {
  return [vehicle.make, vehicle.model, vehicle.trimName || vehicle.year]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function buildListingPreviewTitle(
  form: SellFormState,
  selectedVariant: VariantListItem | null
): string {
  if (selectedVariant) return buildVariantTitle(selectedVariant);
  return buildCustomVehicleTitle(form.customVehicle) || "Your listing preview";
}

export function buildListingPreviewSubtitle(
  form: SellFormState,
  selectedVariant: VariantListItem | null
): string {
  if (selectedVariant) return buildVariantSubtitle(selectedVariant);

  return [
    form.customVehicle.year,
    formatOptionLabel(form.customVehicle.bodyType),
    formatOptionLabel(form.customVehicle.fuelType),
    form.customVehicle.transmission || "Transmission pending",
  ]
    .filter(Boolean)
    .join(" - ");
}

export function buildReadinessChecklist(
  form: SellFormState,
  selectedVariant: VariantListItem | null
): Array<{ label: string; done: boolean; hint: string }> {
  return [
    {
      label: "Vehicle selected",
      done:
        Boolean(selectedVariant) ||
        (form.vehicleMode === "custom" &&
          Boolean(form.customVehicle.make && form.customVehicle.model && form.customVehicle.year)),
      hint: "Choose the exact catalog car or complete the custom vehicle path.",
    },
    {
      label: "Photos added",
      done: form.photos.length >= 1,
      hint: "Listings with at least 5 photos usually feel more trustworthy.",
    },
    {
      label: "Pricing ready",
      done: Number(form.askingPrice) > 0,
      hint: "Enter a realistic asking price in VND.",
    },
    {
      label: "Location complete",
      done: Boolean(form.city.trim() && form.countryCode.trim()),
      hint: "City and country are required so buyers know where the car is.",
    },
    {
      label: "Description quality",
      done:
        form.sellerDescription.trim().length >= 50 ||
        form.maintenanceHistory.trim().length >= 30 ||
        form.upgradeNotes.trim().length >= 30,
      hint: "Mention condition, service history, and notable features.",
    },
  ];
}

export function computeReadinessScore(
  form: SellFormState,
  selectedVariant: VariantListItem | null
): number {
  const checklist = buildReadinessChecklist(form, selectedVariant);
  const completed = checklist.filter((item) => item.done).length;
  const base = Math.round((completed / checklist.length) * 70);

  const photoBonus = Math.min(form.photos.length, 6) * 5;
  return Math.min(100, base + photoBonus);
}

export function readinessLabel(score: number): string {
  if (score >= 85) return "Ready to publish";
  if (score >= 65) return "Almost ready";
  if (score >= 40) return "Needs more detail";
  return "Just getting started";
}

export function formatOptionLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPriceLabel(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "-";
  return `${toCurrency(numeric)} VND`;
}
