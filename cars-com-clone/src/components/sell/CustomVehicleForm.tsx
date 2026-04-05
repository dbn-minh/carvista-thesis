import {
  bodyTypeOptions,
  fuelTypeOptions,
  type CustomVehicleDraft,
  type SellFieldErrors,
} from "./sell-utils";

type Props = {
  value: CustomVehicleDraft;
  onChange: (field: keyof CustomVehicleDraft, value: string) => void;
  errors: SellFieldErrors;
};

export default function CustomVehicleForm({ value, onChange, errors }: Props) {
  const fieldClass =
    "h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-400";
  return (
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-cars-primary/12 bg-cars-off-white p-4 text-sm leading-6 text-cars-gray dark:border-cars-gray-light/35 dark:bg-slate-950/45">
        Your car can still be listed even if it is missing from the current catalog. We will create
        a placeholder vehicle behind the scenes and keep the marketplace listing flow intact.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Make</label>
          <input
            value={value.make}
            onChange={(event) => onChange("make", event.target.value)}
            className={fieldClass}
            placeholder="Toyota"
          />
          {errors.customMake ? <p className="mt-2 text-xs font-medium text-red-600">{errors.customMake}</p> : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Model</label>
          <input
            value={value.model}
            onChange={(event) => onChange("model", event.target.value)}
            className={fieldClass}
            placeholder="Corolla Cross"
          />
          {errors.customModel ? <p className="mt-2 text-xs font-medium text-red-600">{errors.customModel}</p> : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Year</label>
          <input
            value={value.year}
            onChange={(event) => onChange("year", event.target.value)}
            inputMode="numeric"
            className={fieldClass}
            placeholder="2021"
          />
          {errors.customYear ? <p className="mt-2 text-xs font-medium text-red-600">{errors.customYear}</p> : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Variant / Trim</label>
          <input
            value={value.trimName}
            onChange={(event) => onChange("trimName", event.target.value)}
            className={fieldClass}
            placeholder="1.8V or Custom listing"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Body type</label>
          <select
            value={value.bodyType}
            onChange={(event) => onChange("bodyType", event.target.value)}
            className={fieldClass}
          >
            <option value="">Select body type</option>
            {bodyTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.customBodyType ? (
            <p className="mt-2 text-xs font-medium text-red-600">{errors.customBodyType}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Fuel type</label>
          <select
            value={value.fuelType}
            onChange={(event) => onChange("fuelType", event.target.value)}
            className={fieldClass}
          >
            <option value="">Select fuel type</option>
            {fuelTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.customFuelType ? (
            <p className="mt-2 text-xs font-medium text-red-600">{errors.customFuelType}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Transmission</label>
          <input
            value={value.transmission}
            onChange={(event) => onChange("transmission", event.target.value)}
            className={fieldClass}
            placeholder="Automatic"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Drivetrain</label>
          <input
            value={value.drivetrain}
            onChange={(event) => onChange("drivetrain", event.target.value)}
            className={fieldClass}
            placeholder="FWD, RWD, AWD"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Engine info</label>
          <input
            value={value.engine}
            onChange={(event) => onChange("engine", event.target.value)}
            className={fieldClass}
            placeholder="2.0L turbo"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">VIN (optional)</label>
          <input
            value={value.vin}
            onChange={(event) => onChange("vin", event.target.value)}
            className={fieldClass}
            placeholder="Optional but recommended"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">
            License plate (optional)
          </label>
          <input
            value={value.licensePlate}
            onChange={(event) => onChange("licensePlate", event.target.value)}
            className={fieldClass}
            placeholder="Private or partial plate"
          />
        </div>
      </div>
    </div>
  );
}
