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
    <div className="flex flex-col gap-4 rounded-[28px] border border-cars-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,247,255,0.96))] p-4 shadow-[0_22px_50px_rgba(15,45,98,0.1)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(19,26,36,0.98),rgba(11,15,22,0.99))] dark:shadow-[0_22px_50px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8fb4ff]">
            Results
          </p>
          <h2 className="mt-2 text-[1.75rem] font-apercu-bold leading-tight text-cars-primary dark:text-slate-50 sm:text-2xl">
            {filteredCount} listing{filteredCount === 1 ? "" : "s"}
          </h2>
          <p className="mt-1 text-sm text-cars-gray dark:text-slate-300">
            {activeFilters.length > 0
              ? `Filtered from ${totalCount} active marketplace cars.`
              : "Browse the newest active marketplace listings."}
          </p>
        </div>

        {activeFilters.length > 0 ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-cars-primary/12 bg-white px-4 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 sm:w-auto"
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
              className="max-w-full rounded-full border border-cars-primary/12 bg-cars-off-white px-3 py-2 text-xs font-semibold text-cars-primary dark:border-[#8fb4ff]/25 dark:bg-[#8fb4ff]/16 dark:text-[#dce7ff]"
            >
              <span className="block max-w-full break-words leading-5">{filter}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
