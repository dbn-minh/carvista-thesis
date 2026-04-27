"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  function updateField<Key extends keyof ListingFilterState>(
    key: Key,
    value: ListingFilterState[Key]
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const activeFilterCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (key === "sort" || !value.trim()) return count;
    return count + 1;
  }, 0);

  const controlClassName =
    "h-11 rounded-[20px] border border-white/10 bg-[#0d141f] px-4 text-sm text-white outline-none transition focus:border-[#8fb4ff] focus:ring-2 focus:ring-[#8fb4ff]/20 placeholder:text-slate-500";

  function renderAdvancedFields(layoutClassName: string) {
    return (
      <div className={layoutClassName}>
        <input
          value={filters.minPrice}
          onChange={(event) => updateField("minPrice", event.target.value)}
          placeholder="Min price"
          inputMode="numeric"
          className={controlClassName}
        />
        <input
          value={filters.maxPrice}
          onChange={(event) => updateField("maxPrice", event.target.value)}
          placeholder="Max price"
          inputMode="numeric"
          className={controlClassName}
        />
        <select
          value={filters.make}
          onChange={(event) => updateField("make", event.target.value)}
          className={controlClassName}
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
          className={controlClassName}
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
          className={controlClassName}
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
          className={controlClassName}
        />
        <select
          value={filters.transmission}
          onChange={(event) => updateField("transmission", event.target.value)}
          className={controlClassName}
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
          className={controlClassName}
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
          className={controlClassName}
        >
          <option value="">All locations</option>
          {options.locations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,20,31,0.98),rgba(12,18,27,0.98),rgba(18,27,42,0.94))] p-4 shadow-[0_22px_56px_rgba(0,0,0,0.3)] sm:p-5 md:rounded-[32px] md:p-6">
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8fb4ff]">
              Used car marketplace
            </p>
            <h1 className="mt-2 text-3xl font-apercu-bold text-slate-50 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              Listings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Browse what is available now, then open each car to review the details and the
              seller before you inquire.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(111,145,221,0.22),rgba(125,226,255,0.08))] px-4 py-4 text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c5f6ff]">
              Buyer flow
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              Check availability first. Review the vehicle and the seller before you request a
              viewing.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <input
            value={filters.query}
            onChange={(event) => updateField("query", event.target.value)}
            placeholder="Search brand, model, trim, city, or keyword"
            className="h-12 rounded-full border border-white/10 bg-[#0d141f] px-5 text-sm text-white outline-none transition focus:border-[#8fb4ff] focus:ring-2 focus:ring-[#8fb4ff]/20 placeholder:text-slate-500"
          />
          <select
            value={filters.sort}
            onChange={(event) =>
              updateField("sort", event.target.value as ListingFilterState["sort"])
            }
            className="h-12 rounded-full border border-white/10 bg-[#0d141f] px-5 text-sm text-white outline-none transition focus:border-[#8fb4ff] focus:ring-2 focus:ring-[#8fb4ff]/20"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex h-12 w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 shadow-sm transition-colors hover:bg-white/10"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "All filters"}
            </span>
            <span className="max-w-[8.5rem] truncate text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              Price, year, fuel
            </span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickFilters.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, ...chip.update }))}
              className="min-h-10 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[#8fb4ff]/30 hover:bg-white/10"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {renderAdvancedFields("hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4")}
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-[#0b1017]/98 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12 text-left text-white md:hidden"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-white">Refine listings</SheetTitle>
            <SheetDescription>
              Narrow the marketplace by budget, brand, body type, mileage, fuel, and location.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5">
            {activeFilterCount > 0 ? (
              <p className="mb-4 text-sm text-slate-300">
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
              </p>
            ) : null}
            {renderAdvancedFields("grid gap-3 sm:grid-cols-2")}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
