import {
  buildReadinessChecklist,
  composeListingDescription,
  computeReadinessScore,
  readinessLabel,
  type SellFormState,
} from "./sell-utils";
import ListingPreviewCard from "./ListingPreviewCard";
import type { VariantListItem } from "@/lib/types";

type Props = {
  form: SellFormState;
  selectedVariant: VariantListItem | null;
  currentStepTitle: string;
};

export default function ListingReviewPanel({
  form,
  selectedVariant,
  currentStepTitle,
}: Props) {
  const score = computeReadinessScore(form, selectedVariant);
  const checklist = buildReadinessChecklist(form, selectedVariant);
  const composedDescription = composeListingDescription(form, selectedVariant);

  return (
    <aside className="space-y-5 lg:sticky lg:top-24">
      <div className="rounded-[28px] bg-cars-primary p-5 text-white shadow-[0_18px_44px_rgba(15,45,98,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
          Current step
        </p>
        <h3 className="mt-2 text-2xl font-apercu-bold">{currentStepTitle}</h3>
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <span>Listing readiness</span>
            <span className="font-semibold">{score}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-cars-accent" style={{ width: `${score}%` }} />
          </div>
          <p className="mt-3 text-sm text-white/85">{readinessLabel(score)}</p>
        </div>
      </div>

      <ListingPreviewCard form={form} selectedVariant={selectedVariant} />

      <div className="rounded-[28px] border border-cars-gray-light/70 bg-white p-5 shadow-[0_12px_28px_rgba(15,45,98,0.05)] dark:border-cars-gray-light/35 dark:bg-slate-950/55">
        <h3 className="text-lg font-apercu-bold text-cars-primary">Listing quality checklist</h3>
        <div className="mt-4 space-y-3">
          {checklist.map((item) => (
            <div
              key={item.label}
              className={
                item.done
                  ? "rounded-[20px] border border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-500/12"
                  : "rounded-[20px] border border-cars-primary/8 bg-cars-off-white px-4 py-3 dark:border-cars-gray-light/25 dark:bg-slate-900/65"
              }
            >
              <p className="text-sm font-semibold text-cars-primary">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-cars-gray">{item.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-cars-gray-light/70 bg-white p-5 shadow-[0_12px_28px_rgba(15,45,98,0.05)] dark:border-cars-gray-light/35 dark:bg-slate-950/55">
        <h3 className="text-lg font-apercu-bold text-cars-primary">What will be published</h3>
        <p className="mt-3 text-sm leading-6 text-cars-gray">
          The current backend still stores the extra seller notes inside the listing description so the publish flow stays compatible while the richer data model catches up.
        </p>
        <div className="mt-4 rounded-[20px] bg-cars-off-white p-4 text-sm leading-6 text-cars-gray dark:bg-slate-900/65">
          {composedDescription || "No description content yet."}
        </div>
      </div>
    </aside>
  );
}
