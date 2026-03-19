"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { hasToken } from "@/lib/api-client";

const quickLinks = [
  { href: "/catalog", label: "Browse catalog", mode: "link" },
  { href: "/listings", label: "Explore listings", mode: "link" },
  { href: "/sell", label: "Sell your car", mode: "login" },
  { href: "/garage", label: "Garage dashboard", mode: "login" },
] as const;

const featureLinks = [
  { href: "/ai", label: "AI compare and advisor", mode: "login" },
  { href: "/catalog", label: "Vehicle research", mode: "link" },
  { href: "/my-listings", label: "Manage my listings", mode: "login" },
  { href: "/register", label: "Create an account", mode: "register" },
] as const;

const thesisLinks = [
  "Global catalog and detailed specs",
  "Marketplace listing and seller contact flows",
  "Watchlist, notifications, and user-generated reviews",
  "AI compare, price trend, and TCO experiments",
];

export default function Footer() {
  const router = useRouter();
  const { openAssistant } = useAiAssistant();
  const { openAuth } = useAuthModal();

  function openProtected(href: string) {
    if (href === "/ai") {
      openAssistant();
      return;
    }
    if (!hasToken()) {
      openAuth({ mode: "login", next: href });
      return;
    }
    router.push(href);
  }

  return (
    <footer className="border-t border-cars-gray-light/80 bg-white">
      <div className="container-cars py-14">
        <div className="section-shell overflow-hidden bg-cars-primary text-white">
          <div className="grid gap-10 px-6 py-8 md:grid-cols-[1.5fr_1fr_1fr] md:px-10 md:py-10">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                CarVista
              </p>
              <h2 className="max-w-xl text-3xl font-apercu-bold leading-tight">
                A thesis-ready car platform inspired by cars.com, expanded with AI-first
                workflows.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/80">
                The current product combines catalog exploration, marketplace listings,
                seller communication, reviews, saved logs, and AI-assisted insights in one
                consistent experience.
              </p>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-apercu-bold uppercase tracking-[0.18em] text-white/70">
                Explore
              </h3>
              <ul className="space-y-3 text-sm">
                {quickLinks.map((item) => (
                  <li key={item.href}>
                    {item.mode === "link" ? (
                      <Link href={item.href} className="transition-colors hover:text-white/70">
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProtected(item.href)}
                        className="transition-colors hover:text-white/70"
                      >
                        {item.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-apercu-bold uppercase tracking-[0.18em] text-white/70">
                Features
              </h3>
              <ul className="space-y-3 text-sm">
                {featureLinks.map((item) => (
                  <li key={item.href}>
                    {item.mode === "link" ? (
                      <Link href={item.href} className="transition-colors hover:text-white/70">
                        {item.label}
                      </Link>
                    ) : item.mode === "register" ? (
                      <button
                        type="button"
                        onClick={() => openAuth({ mode: "register", next: "/" })}
                        className="transition-colors hover:text-white/70"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProtected(item.href)}
                        className="transition-colors hover:text-white/70"
                      >
                        {item.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <div className="section-shell p-6">
            <h3 className="text-lg font-apercu-bold text-cars-primary">Current project scope</h3>
            <ul className="mt-4 grid gap-3 text-sm text-cars-primary md:grid-cols-2">
              {thesisLinks.map((item) => (
                <li key={item} className="rounded-2xl bg-cars-off-white px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="section-shell p-6">
            <h3 className="text-lg font-apercu-bold text-cars-primary">Need a quick start?</h3>
            <p className="mt-3 text-sm leading-6 text-cars-gray">
              Start from Catalog to research cars, move to Listings to see marketplace
              inventory, then use AI tools to compare vehicles and estimate ownership cost.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/catalog"
                className="rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Browse catalog
              </Link>
              <button
                type="button"
                onClick={() => openProtected("/ai")}
                className="rounded-full border border-cars-primary/15 px-4 py-2 text-sm font-semibold text-cars-primary"
              >
                Open AI tools
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-cars-gray-light/70 pt-5 text-sm text-cars-gray md:flex-row md:items-center md:justify-between">
          <p>CarVista thesis prototype. Inspired by cars.com, extended with AI-powered workflows.</p>
          <p>Built with Next.js, Node.js, MySQL, Sequelize, and custom AI services.</p>
        </div>
      </div>
    </footer>
  );
}
