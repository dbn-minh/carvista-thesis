"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { hasToken } from "@/lib/api-client";

const workflows = [
  {
    id: 1,
    title: "Catalog research",
    description: "Browse real makes, models, trims, specs, and pricing history from the CarVista catalog.",
    image: "https://ext.same-assets.com/569242764/2708255373.webp",
    link: "/catalog",
    featured: true,
    requiresAuth: false,
  },
  {
    id: 2,
    title: "Marketplace listings",
    description: "Explore active listings, save the ones you like, and send viewing requests after login.",
    image: "https://ext.same-assets.com/569242764/3296848294.webp",
    link: "/listings",
    featured: false,
    requiresAuth: false,
  },
  {
    id: 3,
    title: "Garage and notifications",
    description: "Track your watchlist, requests, and ownership activity from a single dashboard.",
    image: "https://ext.same-assets.com/569242764/1361286067.webp",
    link: "/garage",
    featured: false,
    requiresAuth: true,
  },
  {
    id: 4,
    title: "AI-assisted decision support",
    description: "Compare cars, predict price, calculate TCO, and ask the advisor before you buy.",
    image: "https://ext.same-assets.com/569242764/1269782033.webp",
    link: "/ai",
    featured: false,
    requiresAuth: true,
  },
];

const quickLinks = [
  { label: "Open the catalog and search by make or model", href: "/catalog", requiresAuth: false },
  { label: "Browse active listings from sellers", href: "/listings", requiresAuth: false },
  { label: "Create or manage your own listings", href: "/my-listings", requiresAuth: true },
  { label: "Launch AI compare, TCO, and chat tools", href: "/ai", requiresAuth: true },
];

export default function NewsSection() {
  const router = useRouter();
  const { openAuth } = useAuthModal();

  function handleProtectedRoute(href: string) {
    if (!hasToken()) {
      openAuth({ mode: "login", next: href });
      return;
    }
    router.push(href);
  }

  return (
    <section className="py-10">
      <div className="container-cars">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="section-shell p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
              Platform flows
            </p>
            <h2 className="mt-2 text-3xl font-apercu-bold text-cars-primary">
              The Home screen now leads into real product journeys
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-cars-gray">
              Instead of linking to outside content, this section now explains and opens the
              workflows already supported inside CarVista.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {workflows.map((item) =>
                item.requiresAuth ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleProtectedRoute(item.link)}
                    className="group overflow-hidden rounded-[28px] border border-cars-gray-light/80 bg-white text-left transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_16px_38px_rgba(15,45,98,0.12)]"
                  >
                    <div className="relative h-48 w-full">
                      <Image src={item.image} alt={item.title} fill className="object-cover" />
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-apercu-bold text-cars-primary">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-cars-gray">{item.description}</p>
                      <span className="mt-5 inline-flex text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                        Open this workflow
                      </span>
                    </div>
                  </button>
                ) : (
                  <Link
                    key={item.id}
                    href={item.link}
                    className="group overflow-hidden rounded-[28px] border border-cars-gray-light/80 bg-white transition-all hover:-translate-y-1 hover:border-cars-accent/25 hover:shadow-[0_16px_38px_rgba(15,45,98,0.12)]"
                  >
                    <div className="relative h-48 w-full">
                      <Image src={item.image} alt={item.title} fill className="object-cover" />
                      {item.featured ? (
                        <div className="absolute left-4 top-4 rounded-full bg-cars-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                          Core flow
                        </div>
                      ) : null}
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-apercu-bold text-cars-primary">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-cars-gray">{item.description}</p>
                      <span className="mt-5 inline-flex text-sm font-semibold text-cars-primary transition-colors group-hover:text-cars-accent">
                        Open this workflow
                      </span>
                    </div>
                  </Link>
                )
              )}
            </div>
          </div>

          <div className="section-shell p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cars-accent">
              Quick launch
            </p>
            <h3 className="mt-2 text-2xl font-apercu-bold text-cars-primary">
              Everything from Home should be one click away
            </h3>
            <div className="mt-6 space-y-3">
              {quickLinks.map((item, index) =>
                item.requiresAuth ? (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => handleProtectedRoute(item.href)}
                    className="flex w-full items-start gap-4 rounded-[24px] bg-cars-off-white px-4 py-4 text-left transition-colors hover:bg-[#e9f1ff]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-apercu-bold text-cars-primary shadow-sm">
                      {index + 1}
                    </span>
                    <span className="pt-1 text-sm font-medium leading-6 text-cars-primary">
                      {item.label}
                    </span>
                  </button>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start gap-4 rounded-[24px] bg-cars-off-white px-4 py-4 transition-colors hover:bg-[#e9f1ff]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-apercu-bold text-cars-primary shadow-sm">
                      {index + 1}
                    </span>
                    <span className="pt-1 text-sm font-medium leading-6 text-cars-primary">
                      {item.label}
                    </span>
                  </Link>
                )
              )}
            </div>

            <div className="mt-6 rounded-[24px] bg-cars-primary p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Thesis direction
              </p>
              <p className="mt-3 text-sm leading-6 text-white/85">
                The current UI now mirrors a polished automotive marketplace while still keeping
                your AI compare, forecasting, TCO, and seller-management features in the same
                visual language.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
