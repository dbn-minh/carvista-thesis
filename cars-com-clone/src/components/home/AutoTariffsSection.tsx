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
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8fb4ff]">
                  Ownership costs
                </span>
              </div>
              <h2 className="editorial-heading text-2xl sm:text-3xl">
                Know the cost before you buy
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                Estimate taxes, insurance, fuel, and long-term running costs before you commit.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => openAssistant()}
                  className="h-11 w-full rounded-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 sm:w-auto"
                >
                  Estimate ownership cost
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="h-11 w-full rounded-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 sm:w-auto"
                >
                  <Link href="/catalog?fuel=hybrid">Browse efficient cars</Link>
                </Button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="glass-panel rounded-[22px] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7de2ff]">
                    Compare
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-100">
                    See the trade-offs between trims.
                  </p>
                </div>
                <div className="glass-panel rounded-[22px] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7de2ff]">
                    Price outlook
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-100">
                    Check where prices may be headed.
                  </p>
                </div>
                <div className="glass-panel rounded-[22px] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7de2ff]">
                    Ownership
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-100">
                    Estimate monthly and long-term cost.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[280px] sm:min-h-[320px]">
              <Image
                src="https://images.cars.com/cldstatic/wp-content/uploads/202404-get-preapproved-for-car-loan-scaled.jpg"
                alt="Ownership cost planning"
                fill
                className="rounded-[32px] object-cover shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
              />

              <div className="absolute -bottom-6 -right-6 hidden h-20 w-20 rounded-full bg-[#7de2ff] blur-[1px] md:block" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
