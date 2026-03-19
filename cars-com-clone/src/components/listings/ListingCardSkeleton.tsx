export default function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-cars-gray-light/70 bg-white shadow-[0_18px_40px_rgba(15,45,98,0.06)]">
      <div className="h-60 animate-pulse bg-[linear-gradient(90deg,rgba(233,241,255,0.85),rgba(247,250,255,1),rgba(233,241,255,0.85))]" />
      <div className="space-y-4 p-5">
        <div className="h-4 w-24 animate-pulse rounded-full bg-cars-off-white" />
        <div className="h-8 w-40 animate-pulse rounded-full bg-cars-off-white" />
        <div className="h-6 w-3/4 animate-pulse rounded-full bg-cars-off-white" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-10 animate-pulse rounded-[18px] bg-cars-off-white" />
          <div className="h-10 animate-pulse rounded-[18px] bg-cars-off-white" />
          <div className="h-10 animate-pulse rounded-[18px] bg-cars-off-white" />
          <div className="h-10 animate-pulse rounded-[18px] bg-cars-off-white" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 flex-1 animate-pulse rounded-full bg-cars-off-white" />
          <div className="h-11 w-11 animate-pulse rounded-full bg-cars-off-white" />
        </div>
      </div>
    </div>
  );
}
