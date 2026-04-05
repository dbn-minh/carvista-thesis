import type { Make, Model, VariantListItem } from "@/lib/types";
import {
  buildVariantSubtitle,
  buildVariantTitle,
  formatOptionLabel,
  type SellFieldErrors,
} from "./sell-utils";

type Props = {
  makes: Make[];
  models: Model[];
  variants: VariantListItem[];
  selectedMakeId: string;
  selectedModelId: string;
  selectedYear: string;
  selectedVariantId: string;
  loadingModels: boolean;
  loadingVariants: boolean;
  onChange: (field: "selectedMakeId" | "selectedModelId" | "selectedYear" | "selectedVariantId", value: string) => void;
  errors: SellFieldErrors;
};

export default function CatalogVehiclePicker({
  makes,
  models,
  variants,
  selectedMakeId,
  selectedModelId,
  selectedYear,
  selectedVariantId,
  loadingModels,
  loadingVariants,
  onChange,
  errors,
}: Props) {
  const fieldClass =
    "h-12 w-full rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/60 dark:text-white";
  const years = Array.from(new Set(variants.map((variant) => variant.model_year))).sort(
    (a, b) => b - a
  );
  const visibleVariants = selectedYear
    ? variants.filter((variant) => String(variant.model_year) === selectedYear)
    : variants;
  const selectedVariant =
    visibleVariants.find((variant) => variant.variant_id === Number(selectedVariantId)) || null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Make</label>
          <select
            value={selectedMakeId}
            onChange={(event) => onChange("selectedMakeId", event.target.value)}
            className={fieldClass}
          >
            <option value="">Select a make</option>
            {makes.map((make) => (
              <option key={make.make_id} value={make.make_id}>
                {make.name}
              </option>
            ))}
          </select>
          {errors.selectedMakeId ? (
            <p className="mt-2 text-xs font-medium text-red-600">{errors.selectedMakeId}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Model</label>
          <select
            value={selectedModelId}
            onChange={(event) => onChange("selectedModelId", event.target.value)}
            disabled={!selectedMakeId || loadingModels}
            className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-cars-off-white dark:disabled:bg-slate-900/60`}
          >
            <option value="">{loadingModels ? "Loading models..." : "Select a model"}</option>
            {models.map((model) => (
              <option key={model.model_id} value={model.model_id}>
                {model.name}
              </option>
            ))}
          </select>
          {errors.selectedModelId ? (
            <p className="mt-2 text-xs font-medium text-red-600">{errors.selectedModelId}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Year</label>
          <select
            value={selectedYear}
            onChange={(event) => onChange("selectedYear", event.target.value)}
            disabled={!selectedModelId || loadingVariants}
            className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-cars-off-white dark:disabled:bg-slate-900/60`}
          >
            <option value="">{loadingVariants ? "Loading years..." : "Select a year"}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {errors.selectedYear ? (
            <p className="mt-2 text-xs font-medium text-red-600">{errors.selectedYear}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Variant / Trim</label>
          <select
            value={selectedVariantId}
            onChange={(event) => onChange("selectedVariantId", event.target.value)}
            disabled={!selectedModelId || loadingVariants}
            className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-cars-off-white dark:disabled:bg-slate-900/60`}
          >
            <option value="">{loadingVariants ? "Loading variants..." : "Select a variant"}</option>
            {visibleVariants.map((variant) => (
              <option key={variant.variant_id} value={variant.variant_id}>
                {variant.trim_name || buildVariantTitle(variant)}
              </option>
            ))}
          </select>
          {errors.selectedVariantId ? (
            <p className="mt-2 text-xs font-medium text-red-600">{errors.selectedVariantId}</p>
          ) : null}
        </div>
      </div>

      {selectedVariant ? (
        <div className="rounded-[24px] border border-cars-primary/10 bg-cars-off-white p-5 dark:border-cars-gray-light/35 dark:bg-slate-950/45">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
            Selected catalog vehicle
          </p>
          <h3 className="mt-3 text-xl font-apercu-bold text-cars-primary">
            {buildVariantTitle(selectedVariant)}
          </h3>
          <p className="mt-2 text-sm leading-6 text-cars-gray">{buildVariantSubtitle(selectedVariant)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedVariant.body_type ? (
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
                {formatOptionLabel(selectedVariant.body_type)}
              </span>
            ) : null}
            {selectedVariant.fuel_type ? (
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
                {formatOptionLabel(selectedVariant.fuel_type)}
              </span>
            ) : null}
            {selectedVariant.transmission ? (
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
                {selectedVariant.transmission}
              </span>
            ) : null}
            {selectedVariant.drivetrain ? (
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cars-primary dark:bg-slate-900/80 dark:text-white">
                {selectedVariant.drivetrain}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
