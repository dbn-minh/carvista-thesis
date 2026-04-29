import { sellSteps, type SellStepId } from "./sell-utils";

type Props = {
  currentStep: SellStepId;
};

export default function SellProgress({ currentStep }: Props) {
  const currentIndex = sellSteps.findIndex((step) => step.id === currentStep);

  return (
    <div className="rounded-[28px] border border-cars-gray-light/70 bg-white p-4 shadow-[0_12px_28px_rgba(15,45,98,0.05)] dark:border-cars-gray-light/35 dark:bg-slate-950/55 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {sellSteps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isComplete = index < currentIndex;

          return (
            <div
              key={step.id}
              className={
                isActive
                  ? "rounded-[22px] bg-cars-primary px-4 py-3 text-primary-foreground"
                  : isComplete
                    ? "rounded-[22px] bg-cars-off-white px-4 py-3 text-cars-primary dark:bg-slate-900/70 dark:text-white"
                    : "rounded-[22px] border border-cars-primary/10 px-4 py-3 text-cars-gray dark:border-cars-gray-light/30 dark:bg-slate-950/25"
              }
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                {index + 1}
              </p>
              <p className="mt-2 text-sm font-semibold leading-5">{step.title}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
