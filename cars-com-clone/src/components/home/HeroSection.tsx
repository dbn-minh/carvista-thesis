"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { hasToken } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const quickActions = [
  { label: "Shop cars for sale", href: "/listings", requiresAuth: false },
  { label: "Research every model", href: "/catalog", requiresAuth: false },
  { label: "Sell your car", href: "/sell", requiresAuth: true },
  { label: "Use AI advisor", href: "/ai", requiresAuth: true },
];

export default function HeroSection() {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [query, setQuery] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = query.trim();
    router.push(normalized ? `/catalog?q=${encodeURIComponent(normalized)}` : "/catalog");
  }

  return (
    <section className="relative overflow-hidden border-b border-cars-gray-light/70 bg-[#e9f1ff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(47,111,237,0.22),_transparent_30%),linear-gradient(120deg,_rgba(15,45,98,0.94),_rgba(27,76,160,0.88)_52%,_rgba(47,111,237,0.4))]" />
      <div className="container-cars relative z-10 grid gap-10 py-12 md:grid-cols-[1.15fr_0.85fr] md:items-center md:py-16">
        <div className="text-white">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
            CarVista marketplace + AI insights
          </p>
          <h1 className="max-w-2xl text-4xl font-apercu-bold leading-tight md:text-6xl">
            Find, compare, and understand cars with a polished research and seller
            experience.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 md:text-lg">
            Browse a structured vehicle catalog, explore active listings, then use AI
            features to compare models, estimate price trends, and calculate ownership
            cost before making a decision.
          </p>

          <form
            onSubmit={onSubmit}
            className="mt-8 section-shell max-w-2xl rounded-[28px] p-4 text-cars-primary shadow-[0_24px_80px_rgba(7,20,44,0.28)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by make, model, trim, or EV"
                  className="h-12 rounded-full border-cars-gray-light px-5 text-base"
                />
              </div>
              <Button
                type="submit"
                className="h-12 rounded-full bg-cars-accent px-6 text-sm font-semibold text-white hover:bg-cars-primary-light"
              >
                Search catalog
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {quickActions.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    if (item.requiresAuth && !hasToken()) {
                      openAuth({ mode: "login", next: item.href });
                      return;
                    }
                    router.push(item.href);
                  }}
                  className="rounded-full bg-cars-off-white px-4 py-2 text-sm font-medium text-cars-primary transition-colors hover:bg-cars-primary hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </form>
        </div>

        <div className="relative min-h-[360px] md:min-h-[460px]">
          <div className="absolute right-0 top-0 h-full w-full rounded-[36px] border border-white/20 bg-white/10 backdrop-blur-sm" />
          <div className="absolute -left-6 bottom-10 z-20 max-w-[220px] rounded-[28px] bg-white p-5 text-cars-primary shadow-[0_20px_60px_rgba(7,20,44,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cars-accent">
              What you can do
            </p>
            <ul className="mt-3 space-y-3 text-sm leading-6">
              <li>Compare variants with pros and cons</li>
              <li>Track listings and seller activity</li>
              <li>Estimate TCO and future pricing</li>
            </ul>
          </div>
          <div className="absolute inset-x-8 bottom-0 top-8">
            <Image
              src="https://ext.same-assets.com/569242764/3049107266.png"
              alt="CarVista hero vehicle"
              fill
              priority
              className="object-contain object-center drop-shadow-[0_28px_48px_rgba(4,10,24,0.45)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
