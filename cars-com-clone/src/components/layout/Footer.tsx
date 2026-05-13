"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { hasToken } from "@/lib/api-client";

const quickLinks = [
  { href: "/catalog", label: "Browse cars", mode: "link" },
  { href: "/listings", label: "View listings", mode: "link" },
  { href: "/sell", label: "Sell your car", mode: "login" },
] as const;

const featureLinks = [
  { href: "/ai", label: "AI car advisor", mode: "login" },
  { href: "/compare", label: "Smart comparison", mode: "link" },
  { href: "/ai", label: "Cost insight", mode: "login" },
] as const;

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
          <div className="grid gap-8 px-5 py-6 sm:px-6 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1.62fr)_minmax(150px,0.95fr)_minmax(150px,0.95fr)] lg:px-10 lg:py-10">
            <div className="lg:min-w-[170px]">
              <Link
                href="/"
                aria-label="CarVista home"
                className="mb-5 inline-flex w-fit items-center overflow-hidden rounded-[24px] border border-slate-200/80 bg-white px-3 py-2 shadow-[0_18px_50px_rgba(15,45,98,0.12)] transition-transform hover:-translate-y-0.5 dark:border-white/10"
              >
                <Image
                  src="/logos/carvista-logo-horizontal.png"
                  alt="CarVista logo"
                  width={1553}
                  height={342}
                  className="h-12 w-auto object-contain sm:h-14"
                />
              </Link>
              <h2 className="max-w-xl text-2xl font-apercu-bold leading-tight text-foreground dark:text-white sm:text-3xl">
                Make smarter car decisions with AI-assisted insights.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-cars-gray dark:text-white/72 sm:text-[15px]">
                Explore cars, compare options, estimate ownership costs, and get clear
                guidance before choosing your next vehicle.
              </p>
            </div>

            <div className="lg:min-w-[170px]">
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
                  <li key={`${item.href}-${item.label}`}>
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
          </div>
        </div>
      </div>
    </footer>
  );
}
