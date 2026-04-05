import type { Dispatch, SetStateAction } from "react";
import {
  formatBodyType,
  formatFuelType,
  formatTransmission,
  type ListingFilterOptions,
  type ListingFilterState,
} from "./listing-utils";

type Props = {
  filters: ListingFilterState;
  setFilters: Dispatch<SetStateAction<ListingFilterState>>;
  options: ListingFilterOptions;
};

const quickFilters = [
  { label: "SUV", update: { bodyType: "suv" } },
  { label: "Sedan", update: { bodyType: "sedan" } },
  { label: "Hatchback", update: { bodyType: "hatchback" } },
  { label: "Under 500M", update: { maxPrice: "500000000" } },
  { label: "Low mileage", update: { maxMileage: "30000" } },
] as const;

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price low to high" },
  { value: "price-desc", label: "Price high to low" },
  { value: "mileage-asc", label: "Mileage low to high" },
] as const;

export default function ListingFilters({
  filters,
  setFilters,
  options,
}: Props) {
  function updateField<Key extends keyof ListingFilterState>(key: Key, value: ListingFilterState[Key]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <section className="rounded-[32px] border border-cars-gray-light/70 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(241,246,255,0.96))] p-5 shadow-[0_18px_44px_rgba(15,45,98,0.08)] dark:border-cars-gray-light/40 dark:bg-[linear-gradient(135deg,rgba(8,17,31,0.96),rgba(15,26,44,0.92))] md:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
              Used car marketplace
            </p>
            <h1 className="mt-2 text-4xl font-apercu-bold text-cars-primary">Listings</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
              Browse what is available now, then open each car to review the details and the seller before you inquire.
            </p>
          </div>

          <div className="rounded-[24px] bg-cars-primary px-5 py-4 text-white shadow-[0_16px_34px_rgba(15,45,98,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              Buyer flow
            </p>
            <p className="mt-2 text-sm leading-6 text-white/85">
              Check availability first. Review the vehicle and the seller before you request a viewing.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <input
            value={filters.query}
            onChange={(event) => updateField("query", event.target.value)}
            placeholder="Search brand, model, trim, city, or keyword"
            className="h-12 rounded-full border border-cars-gray-light bg-white px-5 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-400"
          />
          <select
            value={filters.sort}
            onChange={(event) =>
              updateField("sort", event.target.value as ListingFilterState["sort"])
            }
            className="h-12 rounded-full border border-cars-gray-light bg-white px-5 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickFilters.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, ...chip.update }))}
              className="rounded-full border border-cars-primary/12 bg-white px-4 py-2 text-sm font-semibold text-cars-primary transition hover:border-cars-accent/30 hover:bg-cars-off-white dark:bg-slate-950/60 dark:text-white"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={filters.minPrice}
            onChange={(event) => updateField("minPrice", event.target.value)}
            placeholder="Min price"
            inputMode="numeric"
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-400"
          />
          <input
            value={filters.maxPrice}
            onChange={(event) => updateField("maxPrice", event.target.value)}
            placeholder="Max price"
            inputMode="numeric"
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-400"
          />
          <select
            value={filters.make}
            onChange={(event) => updateField("make", event.target.value)}
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white"
          >
            <option value="">All brands</option>
            {options.makes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
          <select
            value={filters.bodyType}
            onChange={(event) => updateField("bodyType", event.target.value)}
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white"
          >
            <option value="">All body types</option>
            {options.bodyTypes.map((bodyType) => (
              <option key={bodyType} value={bodyType}>
                {formatBodyType(bodyType)}
              </option>
            ))}
          </select>
          <select
            value={filters.year}
            onChange={(event) => updateField("year", event.target.value)}
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white"
          >
            <option value="">All years</option>
            {options.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <input
            value={filters.maxMileage}
            onChange={(event) => updateField("maxMileage", event.target.value)}
            placeholder="Max mileage (km)"
            inputMode="numeric"
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-400"
          />
          <select
            value={filters.transmission}
            onChange={(event) => updateField("transmission", event.target.value)}
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white"
          >
            <option value="">All transmissions</option>
            {options.transmissions.map((transmission) => (
              <option key={transmission} value={transmission}>
                {formatTransmission(transmission)}
              </option>
            ))}
          </select>
          <select
            value={filters.fuelType}
            onChange={(event) => updateField("fuelType", event.target.value)}
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white"
          >
            <option value="">All fuel types</option>
            {options.fuelTypes.map((fuelType) => (
              <option key={fuelType} value={fuelType}>
                {formatFuelType(fuelType)}
              </option>
            ))}
          </select>
          <select
            value={filters.location}
            onChange={(event) => updateField("location", event.target.value)}
            className="h-11 rounded-[20px] border border-cars-gray-light bg-white px-4 text-sm text-cars-primary outline-none transition focus:border-cars-accent focus:ring-2 focus:ring-cars-accent/15 dark:bg-slate-950/70 dark:text-white"
          >
            <option value="">All locations</option>
            {options.locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>

      </div>
    </section>
  );
}
