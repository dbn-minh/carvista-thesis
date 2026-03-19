import CatalogVehiclePicker from "./CatalogVehiclePicker";
import CustomVehicleForm from "./CustomVehicleForm";
import type { Make, Model, VariantListItem } from "@/lib/types";
import {
  buildCustomVehicleTitle,
  type CustomVehicleDraft,
  type SellFieldErrors,
  type VehicleMode,
} from "./sell-utils";

type Props = {
  vehicleMode: VehicleMode;
  onModeChange: (mode: VehicleMode) => void;
  makes: Make[];
  models: Model[];
  variants: VariantListItem[];
  selectedMakeId: string;
  selectedModelId: string;
  selectedYear: string;
  selectedVariantId: string;
  customVehicle: CustomVehicleDraft;
  loadingModels: boolean;
  loadingVariants: boolean;
  onCatalogChange: (
    field: "selectedMakeId" | "selectedModelId" | "selectedYear" | "selectedVariantId",
    value: string
  ) => void;
  onCustomChange: (field: keyof CustomVehicleDraft, value: string) => void;
  errors: SellFieldErrors;
};

export default function VehicleSelector({
  vehicleMode,
  onModeChange,
  makes,
  models,
  variants,
  selectedMakeId,
  selectedModelId,
  selectedYear,
  selectedVariantId,
  customVehicle,
  loadingModels,
  loadingVariants,
  onCatalogChange,
  onCustomChange,
  errors,
}: Props) {
  return (
    <section className="section-shell p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
            Step 1
          </p>
          <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">Select the vehicle</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
            Choose the exact catalog car if possible so buyers see a cleaner title and more reliable vehicle details.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onModeChange("catalog")}
          className={
            vehicleMode === "catalog"
              ? "rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
              : "rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
          }
        >
          Choose from catalog
        </button>
        <button
          type="button"
          onClick={() => onModeChange("custom")}
          className={
            vehicleMode === "custom"
              ? "rounded-full bg-cars-primary px-5 py-2.5 text-sm font-semibold text-white"
              : "rounded-full border border-cars-primary/15 px-5 py-2.5 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
          }
        >
          Other / My car is not listed
        </button>
      </div>

      <div className="mt-6">
        {vehicleMode === "catalog" ? (
          <CatalogVehiclePicker
            makes={makes}
            models={models}
            variants={variants}
            selectedMakeId={selectedMakeId}
            selectedModelId={selectedModelId}
            selectedYear={selectedYear}
            selectedVariantId={selectedVariantId}
            loadingModels={loadingModels}
            loadingVariants={loadingVariants}
            onChange={onCatalogChange}
            errors={errors}
          />
        ) : (
          <CustomVehicleForm value={customVehicle} onChange={onCustomChange} errors={errors} />
        )}
      </div>

      {vehicleMode === "custom" && buildCustomVehicleTitle(customVehicle) ? (
        <div className="mt-5 rounded-[24px] border border-cars-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(233,241,255,0.8))] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
            Custom vehicle draft
          </p>
          <p className="mt-2 text-lg font-apercu-bold text-cars-primary">
            {buildCustomVehicleTitle(customVehicle)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
