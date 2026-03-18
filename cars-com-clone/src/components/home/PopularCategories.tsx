"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { hasToken } from "@/lib/api-client";

const categories = [
  {
    title: "SUVs and crossovers",
    description: "Popular family-focused models with roomy cabins and versatile cargo space.",
    href: "/catalog?bodyType=suv",
    eyebrow: "Research",
    requiresAuth: false,
  },
  {
    title: "Sedans for daily driving",
    description: "Compare efficient city-friendly cars with balanced comfort and ownership cost.",
    href: "/catalog?bodyType=sedan",
    eyebrow: "Catalog",
    requiresAuth: false,
  },
  {
    title: "Hybrid and fuel-saving picks",
    description: "Start with models that fit buyers watching fuel spend and long-term TCO.",
    href: "/catalog?fuel=hybrid",
    eyebrow: "AI-ready",
    requiresAuth: false,
  },
  {
    title: "Electric vehicles",
    description: "Browse EV research first, then move into pricing, forecasting, and TCO tools.",
    href: "/catalog?fuel=electric",
    eyebrow: "EV",
    requiresAuth: false,
  },
  {
    title: "Cars for sale near you",
    description: "Jump into active marketplace listings and contact sellers from the same experience.",
    href: "/listings",
    eyebrow: "Marketplace",
    requiresAuth: false,
  },
  {
    title: "Sell and manage your inventory",
    description: "Create a listing, track requests, and manage saved activity from your account.",
    href: "/sell",
    eyebrow: "Seller flow",
    requiresAuth: true,
  },
];

export default function PopularCategories() {
  const router = useRouter();
  const { openAuth } = useAuthModal();

  return (
    <section className="py-10">
      <div className="container-cars">
        <div className="section-shell p-6 md:p-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
                Start from a real workflow
              </p>
              <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
                Shop, research, and manage ownership in one place
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
                Every card below goes to a live route in CarVista, so the Home screen behaves
                like a real entry point instead of a static demo.
              </p>
            </div>

            <Link
              href="/catalog"
              className="inline-flex rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary transition-colors hover:bg-cars-off-white"
            >
              Explore full catalog
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((item) =>
              item.requiresAuth ? (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    if (!hasToken()) {
                      openAuth({ mode: "login", next: item.href });
                      return;
                    }
                    router.push(item.href);
                  }}
                  className="group rounded-[28px] border border-cars-gray-light/80 bg-white p-5 text-left transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_16px_38px_rgba(15,45,98,0.12)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-3 text-xl font-apercu-bold text-cars-primary">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-cars-gray">{item.description}</p>
                  <span className="mt-5 inline-flex text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                    Open section
                  </span>
                </button>
              ) : (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[28px] border border-cars-gray-light/80 bg-white p-5 transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_16px_38px_rgba(15,45,98,0.12)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-accent">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-3 text-xl font-apercu-bold text-cars-primary">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-cars-gray">{item.description}</p>
                  <span className="mt-5 inline-flex text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                    Open section
                  </span>
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
