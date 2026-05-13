"use client";

import Image from "next/image";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { hasToken } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const quickActions = [
  { label: "Browse listings", href: "/listings", requiresAuth: false },
  { label: "Explore models", href: "/catalog", requiresAuth: false },
  { label: "Sell your car", href: "/sell", requiresAuth: true },
  { label: "Ask AI", href: "/ai", requiresAuth: true },
];

export default function HeroSection() {
  const router = useRouter();
  const { openAssistant } = useAiAssistant();
  const { openAuth } = useAuthModal();
  const [query, setQuery] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = query.trim();
    router.push(normalized ? `/listings?query=${encodeURIComponent(normalized)}` : "/listings");
  }

  return (
    <section className="relative overflow-hidden border-b border-cars-primary/10 bg-[#f1f6fc] dark:border-white/5 dark:bg-[#070b0f]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(111,145,221,0.18),_transparent_32%),radial-gradient(circle_at_78%_18%,_rgba(125,226,255,0.12),_transparent_22%),linear-gradient(135deg,_rgba(248,251,255,0.98),_rgba(239,245,252,0.96)_42%,_rgba(227,236,248,0.92)_72%,_rgba(241,246,252,0.98))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(129,164,255,0.24),_transparent_32%),radial-gradient(circle_at_78%_18%,_rgba(125,226,255,0.18),_transparent_22%),linear-gradient(135deg,_rgba(7,10,16,0.98),_rgba(10,19,32,0.96)_42%,_rgba(17,28,54,0.9)_72%,_rgba(10,13,18,0.98))]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(227,236,248,0.86))] dark:bg-[linear-gradient(180deg,transparent,rgba(6,8,10,0.86))]" />

      <div className="container-cars relative z-10 grid gap-10 py-12 sm:py-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-20">
        <div className="text-foreground dark:text-white">
          {/*<div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cars-primary/12 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cars-primary backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-[#b6c4ec]">*/}
          {/*  <span className="h-2 w-2 rounded-full bg-cars-primary-light dark:bg-[#7de2ff]" />*/}
          {/*  Editorial marketplace*/}
          {/*</div>*/}
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-cars-gray dark:text-[#b7c4df]">
            Buy, sell, compare, and decide with context
          </p>
          <h1 className="editorial-heading max-w-3xl text-[2.65rem] leading-[0.96] sm:text-5xl lg:text-[5.15rem]">
            Find the right car before the market moves.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-cars-gray dark:text-slate-300 md:text-lg md:leading-8">
            Research models, browse live listings, compare trims side by side, and use
            built-in pricing intelligence before you make a call.
          </p>

          <form
            onSubmit={onSubmit}
            className="section-shell theme-surface-card mt-8 max-w-2xl rounded-[28px] border-white/10 bg-white/5 p-4 text-foreground shadow-[0_30px_90px_rgba(0,0,0,0.4)] dark:text-white sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search make, model, or trim"
                  className="h-12 rounded-full border-input bg-surface-elevated px-5 text-base text-input-foreground placeholder:text-placeholder dark:border-white/10 dark:bg-[#0e1420]/90 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                className="editorial-button h-12 w-full rounded-full px-6 text-sm font-semibold text-slate-950 hover:brightness-105 sm:w-auto"
              >
                Search
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {quickActions.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    if (item.href === "/ai") {
                      openAssistant();
                      return;
                    }
                    if (item.requiresAuth && !hasToken()) {
                      openAuth({ mode: "login", next: item.href });
                      return;
                    }
                    router.push(item.href);
                  }}
                  className="rounded-full border border-cars-primary/12 bg-white/80 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-cars-primary/40 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:border-[#8fb4ff]/40 dark:hover:bg-white/10"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </form>
        </div>

        <div className="relative min-h-[360px] sm:min-h-[420px] lg:min-h-[560px]">
          <div className="absolute inset-0 rounded-[32px] border border-cars-primary/10 bg-[radial-gradient(circle_at_54%_42%,rgba(255,255,255,0.22),rgba(255,255,255,0.08)_46%,rgba(255,255,255,0)_76%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(241,246,252,0.08))] shadow-[0_28px_80px_rgba(15,45,98,0.12)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_54%_42%,rgba(255,255,255,0.08),rgba(255,255,255,0.03)_46%,rgba(255,255,255,0)_76%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] dark:shadow-[0_28px_80px_rgba(0,0,0,0.4)] sm:rounded-[40px]" />
          <div className="absolute left-4 right-4 top-5 z-20 flex items-center justify-between rounded-full border border-cars-primary/10 bg-white/58 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cars-primary shadow-[0_16px_30px_rgba(15,45,98,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-[#0b1017]/52 dark:text-[#c5f6ff] dark:shadow-[0_16px_30px_rgba(0,0,0,0.24)] sm:left-6 sm:right-6">
            <span>Pricing intelligence</span>
            <span className="text-cars-gray dark:text-[#9fb2d9]">Catalog + live listings</span>
          </div>
          <div className="absolute inset-x-4 bottom-6 top-14 sm:inset-x-8 sm:bottom-8 sm:top-16">
            <Image
              src="https://www.cars.com/images/sell/sale-dealer-woman-brand-colors.png"
              alt="CarVista hero vehicle"
              fill
              priority
              className="object-contain object-center drop-shadow-[0_36px_60px_rgba(2,6,16,0.72)]"
            />
          </div>
          <div className="absolute inset-0 z-10 rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)_28%,rgba(247,250,255,0.22)_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0)_26%,rgba(8,11,18,0.22)_100%)] sm:rounded-[40px]" />
        </div>
      </div>
    </section>
  );
}
