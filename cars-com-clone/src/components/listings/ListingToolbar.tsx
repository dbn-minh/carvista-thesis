type Props = {
  totalCount: number;
  filteredCount: number;
  activeFilters: string[];
  onClearFilters: () => void;
};

export default function ListingToolbar({
  totalCount,
  filteredCount,
  activeFilters,
  onClearFilters,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-cars-gray-light/70 bg-white p-5 shadow-[0_18px_40px_rgba(15,45,98,0.06)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
            Results
          </p>
          <h2 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
            {filteredCount} listing{filteredCount === 1 ? "" : "s"}
          </h2>
          <p className="mt-1 text-sm text-cars-gray">
            {activeFilters.length > 0
              ? `Filtered from ${totalCount} active marketplace cars.`
              : "Browse the newest active marketplace listings."}
          </p>
        </div>

        {activeFilters.length > 0 ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <span
              key={filter}
              className="rounded-full bg-cars-primary px-3 py-1.5 text-xs font-semibold text-white"
            >
              {filter}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
