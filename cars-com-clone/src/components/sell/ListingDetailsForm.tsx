import { conditionOptions, type SellFieldErrors } from "./sell-utils";

type Props = {
  mileageKm: string;
  condition: string;
  exteriorColor: string;
  interiorColor: string;
  ownersCount: string;
  onChange: (
    field: "mileageKm" | "condition" | "exteriorColor" | "interiorColor" | "ownersCount",
    value: string
  ) => void;
  errors: SellFieldErrors;
};

export default function ListingDetailsForm({
  mileageKm,
  condition,
  exteriorColor,
  interiorColor,
  ownersCount,
  onChange,
  errors,
}: Props) {
  return (
    <section className="section-shell p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">Step 3</p>
      <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">Vehicle details</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
        Add the practical details buyers care about most when comparing used cars.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Mileage (km)</label>
          <input
            value={mileageKm}
            onChange={(event) => onChange("mileageKm", event.target.value)}
            inputMode="numeric"
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="32000"
          />
          {errors.mileageKm ? <p className="mt-2 text-xs font-medium text-red-600">{errors.mileageKm}</p> : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Condition</label>
          <select
            value={condition}
            onChange={(event) => onChange("condition", event.target.value)}
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
          >
            {conditionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Exterior color</label>
          <input
            value={exteriorColor}
            onChange={(event) => onChange("exteriorColor", event.target.value)}
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="White pearl"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Interior color</label>
          <input
            value={interiorColor}
            onChange={(event) => onChange("interiorColor", event.target.value)}
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="Black"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">
            Number of owners (optional)
          </label>
          <input
            value={ownersCount}
            onChange={(event) => onChange("ownersCount", event.target.value)}
            inputMode="numeric"
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="1"
          />
        </div>
      </div>
    </section>
  );
}
