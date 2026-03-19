"use client";

import Image from "next/image";
import Link from "next/link";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { Button } from "@/components/ui/button";

export default function AutoTariffsSection() {
  const { openAssistant } = useAiAssistant();

  return (
    <section className="py-10">
      <div className="container-cars">
        <div className="section-shell overflow-hidden">
          <div className="grid gap-8 px-6 py-8 md:grid-cols-[1fr_0.9fr] md:items-center md:px-8 md:py-10">
            <div>
              <div className="mb-2 flex items-center">
                <span className="rounded-full bg-cars-off-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Ownership planning
                </span>
              </div>
              <h2 className="text-3xl font-apercu-bold text-cars-primary">
                Understand taxes, insurance, and long-term car cost before you commit
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-cars-gray">
                This block now routes into live CarVista flows. Buyers can jump into AI tools to
                estimate total cost of ownership, compare models, and validate whether a listing
                matches their real budget.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => openAssistant()}
                  className="h-11 rounded-full border-cars-primary text-cars-primary hover:bg-cars-primary hover:text-white"
                >
                  Open AI TCO tools
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="h-11 rounded-full border-cars-primary text-cars-primary hover:bg-cars-primary hover:text-white"
                >
                  <Link href="/catalog?fuel=hybrid">Browse efficient cars</Link>
                </Button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] bg-cars-off-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Compare
                  </p>
                  <p className="mt-2 text-sm font-medium text-cars-primary">
                    See strengths and tradeoffs between variants.
                  </p>
                </div>
                <div className="rounded-[22px] bg-cars-off-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Predict
                  </p>
                  <p className="mt-2 text-sm font-medium text-cars-primary">
                    Estimate future pricing before you buy or sell.
                  </p>
                </div>
                <div className="rounded-[22px] bg-cars-off-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Plan
                  </p>
                  <p className="mt-2 text-sm font-medium text-cars-primary">
                    Calculate TCO using profile-based ownership inputs.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[320px]">
              <Image
                src="https://ext.same-assets.com/569242764/2943101928.webp"
                alt="Ownership cost planning"
                fill
                className="rounded-[32px] object-cover shadow-[0_18px_48px_rgba(15,45,98,0.12)]"
              />
              <div className="absolute bottom-5 left-5 max-w-[240px] rounded-[24px] bg-white/92 p-4 text-cars-primary shadow-lg backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                  Buyer decision support
                </p>
                <p className="mt-2 text-sm leading-6">
                  One polished flow from catalog research into AI-assisted ownership analysis.
                </p>
              </div>
              <div className="absolute -bottom-6 -right-6 hidden h-20 w-20 rounded-full bg-cars-accent md:block" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
