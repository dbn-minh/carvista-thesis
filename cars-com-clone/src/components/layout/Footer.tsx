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
  { href: "/garage", label: "Saved cars", mode: "login" },
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
    <footer className="border-t border-white/6 bg-transparent">
      <div className="container-cars py-10 sm:py-14">
        <div className="section-shell theme-hero-panel overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(242,247,255,0.95),rgba(228,237,250,0.94))] text-foreground dark:bg-[linear-gradient(135deg,rgba(19,24,31,0.98),rgba(23,29,30,0.96),rgba(40,56,92,0.88))] dark:text-white">
          <div className="grid gap-8 px-5 py-6 sm:px-6 md:px-8 md:py-8 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-10 lg:py-10">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-cars-primary dark:text-cars-accent">
                CarVista
              </p>
              <h2 className="max-w-xl text-2xl font-apercu-bold leading-tight text-foreground dark:text-white sm:text-3xl">
                A thesis-ready car platform inspired by cars.com, expanded with AI-first
                workflows.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-cars-gray dark:text-white/72 sm:text-[15px]">
                The current product combines catalog exploration, marketplace listings,
                seller communication, reviews, saved logs, and AI-assisted insights in one
                consistent experience.
              </p>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-apercu-bold uppercase tracking-[0.18em] text-cars-gray dark:text-white/52">
                Explore
              </h3>
              <ul className="space-y-3 text-sm">
                {quickLinks.map((item) => (
                  <li key={item.href}>
                    {item.mode === "link" ? (
                      <Link href={item.href} className="transition-colors hover:text-cars-primary dark:hover:text-white/70">
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProtected(item.href)}
                        className="transition-colors hover:text-cars-primary dark:hover:text-white/70"
                      >
                        {item.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-apercu-bold uppercase tracking-[0.18em] text-cars-gray dark:text-white/52">
                Features
              </h3>
              <ul className="space-y-3 text-sm">
                {featureLinks.map((item) => (
                  <li key={item.href}>
                    {item.mode === "link" ? (
                      <Link href={item.href} className="transition-colors hover:text-cars-primary dark:hover:text-white/70">
                        {item.label}
                      </Link>
                    ) : item.mode === "register" ? (
                      <button
                        type="button"
                        onClick={() => openAuth({ mode: "register", next: "/" })}
                        className="transition-colors hover:text-cars-primary dark:hover:text-white/70"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProtected(item.href)}
                        className="transition-colors hover:text-cars-primary dark:hover:text-white/70"
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

        <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
          <div className="section-shell p-5 sm:p-6">
            <h3 className="text-lg font-apercu-bold text-foreground dark:text-white">Current project scope</h3>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {thesisLinks.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-white/6 bg-white/4 px-4 py-3 text-sm text-cars-gray dark:text-slate-200"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="section-shell p-5 sm:p-6">
            <h3 className="text-lg font-apercu-bold text-foreground dark:text-white">Need a quick start?</h3>
            <p className="mt-3 text-sm leading-6 text-cars-gray dark:text-slate-300">
              Start from Catalog to research cars, move to Listings to see marketplace
              inventory, then use AI tools to compare vehicles and estimate ownership cost.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/catalog"
                className="editorial-button inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-slate-950 sm:w-auto"
              >
                Browse catalog
              </Link>
              <button
                type="button"
                onClick={() => openProtected("/ai")}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-foreground dark:text-white sm:w-auto"
              >
                Open AI tools
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/6 pt-5 text-sm leading-6 text-cars-gray dark:text-slate-400 md:mt-8 md:flex-row md:items-center md:justify-between md:gap-6">
          <p>CarVista thesis prototype. Inspired by cars.com, extended with AI-powered workflows.</p>
          <p>Built with Next.js, Node.js, MySQL, Sequelize, and custom AI services.</p>
        </div>
      </div>
    </footer>
  );
}
