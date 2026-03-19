"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import Header from "@/components/layout/Header";

export default function AiPage() {
  const { openAssistant } = useAiAssistant();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    openAssistant();
  }, [openAssistant]);

  return (
    <>
      <Header />
      <main className="container-cars py-8">
        <section className="section-shell overflow-hidden bg-[linear-gradient(135deg,rgba(15,45,98,0.96),rgba(27,76,160,0.92),rgba(95,150,255,0.72))] p-6 text-white md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
            AI concierge
          </p>
          <h1 className="mt-2 text-4xl font-apercu-bold">CarVista AI now follows the user across the site</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/85">
            Instead of a separate tool page, the assistant now lives in the floating chat widget
            and in the compare modal on vehicle detail pages. Use it to ask for recommendations,
            compare variants, forecast pricing, and discuss ownership cost.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openAssistant()}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-cars-primary"
            >
              Open AI concierge
            </button>
            <Link
              href="/catalog"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Browse the catalog
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
