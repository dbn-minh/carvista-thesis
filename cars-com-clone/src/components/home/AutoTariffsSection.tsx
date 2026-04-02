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
                  Ownership costs
                </span>
              </div>
              <h2 className="text-3xl font-apercu-bold text-cars-primary">
                Know the cost before you buy
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-cars-gray">
                Estimate taxes, insurance, fuel, and long-term running costs before you commit.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => openAssistant()}
                  className="h-11 rounded-full border-cars-primary text-cars-primary hover:bg-cars-primary hover:text-white"
                >
                  Estimate ownership cost
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
                    See the trade-offs between trims.
                  </p>
                </div>
                <div className="rounded-[22px] bg-cars-off-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Price outlook
                  </p>
                  <p className="mt-2 text-sm font-medium text-cars-primary">
                    Check where prices may be headed.
                  </p>
                </div>
                <div className="rounded-[22px] bg-cars-off-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cars-accent">
                    Ownership
                  </p>
                  <p className="mt-2 text-sm font-medium text-cars-primary">
                    Estimate monthly and long-term cost.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[320px]">
              <Image
                src="https://images.cars.com/cldstatic/wp-content/uploads/202404-get-preapproved-for-car-loan-scaled.jpg"
                alt="Ownership cost planning"
                fill
                className="rounded-[32px] object-cover shadow-[0_18px_48px_rgba(15,45,98,0.12)]"
              />

              <div className="absolute -bottom-6 -right-6 hidden h-20 w-20 rounded-full bg-cars-accent md:block" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
