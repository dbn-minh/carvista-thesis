import type { SellFieldErrors } from "./sell-utils";

type Props = {
  askingPrice: string;
  negotiable: boolean;
  city: string;
  countryCode: string;
  availabilityStatus: "active" | "hidden";
  contactPreference: string;
  onChange: (
    field:
      | "askingPrice"
      | "city"
      | "countryCode"
      | "availabilityStatus"
      | "contactPreference",
    value: string
  ) => void;
  onToggleNegotiable: (value: boolean) => void;
  errors: SellFieldErrors;
};

export default function PriceLocationForm({
  askingPrice,
  negotiable,
  city,
  countryCode,
  availabilityStatus,
  contactPreference,
  onChange,
  onToggleNegotiable,
  errors,
}: Props) {
  return (
    <section className="section-shell p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">Step 4</p>
      <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">Price and selling details</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
        This is the part buyers scan first, so keep the price and location clear and trustworthy.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Asking price</label>
          <input
            value={askingPrice}
            onChange={(event) => onChange("askingPrice", event.target.value)}
            inputMode="numeric"
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="650000000"
          />
          {errors.askingPrice ? <p className="mt-2 text-xs font-medium text-red-600">{errors.askingPrice}</p> : null}
        </div>

        <div className="flex items-end">
          <label className="inline-flex h-12 items-center gap-3 rounded-[20px] border border-cars-gray-light px-4 text-sm font-medium text-cars-primary">
            <input
              type="checkbox"
              checked={negotiable}
              onChange={(event) => onToggleNegotiable(event.target.checked)}
              className="h-4 w-4 rounded border-cars-gray-light"
            />
            Price is negotiable
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">City</label>
          <input
            value={city}
            onChange={(event) => onChange("city", event.target.value)}
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="Ho Chi Minh City"
          />
          {errors.city ? <p className="mt-2 text-xs font-medium text-red-600">{errors.city}</p> : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Country code</label>
          <input
            value={countryCode}
            onChange={(event) => onChange("countryCode", event.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="VN"
          />
          {errors.countryCode ? <p className="mt-2 text-xs font-medium text-red-600">{errors.countryCode}</p> : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Availability</label>
          <select
            value={availabilityStatus}
            onChange={(event) => onChange("availabilityStatus", event.target.value)}
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
          >
            <option value="active">Publish now</option>
            <option value="hidden">Save as hidden draft</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-primary">Contact preference</label>
          <input
            value={contactPreference}
            onChange={(event) => onChange("contactPreference", event.target.value)}
            className="h-12 w-full rounded-[20px] border border-cars-gray-light px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15"
            placeholder="Phone or email"
          />
        </div>
      </div>
    </section>
  );
}
