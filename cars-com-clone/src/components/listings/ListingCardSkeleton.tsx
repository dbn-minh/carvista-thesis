export default function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,26,36,0.98),rgba(10,14,20,0.99))] shadow-[0_24px_54px_rgba(0,0,0,0.28)] sm:rounded-[30px]">
      <div className="relative aspect-[4/3] animate-pulse bg-[linear-gradient(90deg,rgba(18,24,36,0.96),rgba(30,42,58,0.98),rgba(18,24,36,0.96))] sm:aspect-[16/10]">
        <div className="absolute right-4 top-4 h-11 w-11 rounded-full bg-white/10" />
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
        <div className="h-8 w-40 animate-pulse rounded-full bg-white/10" />
        <div className="h-6 w-3/4 animate-pulse rounded-full bg-white/10" />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="h-10 animate-pulse rounded-[18px] bg-white/8" />
          <div className="h-10 animate-pulse rounded-[18px] bg-white/8" />
          <div className="h-10 animate-pulse rounded-[18px] bg-white/8" />
          <div className="h-10 animate-pulse rounded-[18px] bg-white/8" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-full animate-pulse rounded-full bg-white/10 sm:h-12" />
        </div>
      </div>
    </div>
  );
}
