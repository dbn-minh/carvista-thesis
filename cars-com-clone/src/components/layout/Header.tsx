"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { clearStoredToken, getStoredToken } from "@/lib/api-client";

const nav = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog" },
  { href: "/listings", label: "Listings" },
  { href: "/sell", label: "Sell" },
  { href: "/garage", label: "Garage" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/ai", label: "AI" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [loggedIn, setLoggedIn] = useState(false);
  const protectedRoutes = new Set(["/sell", "/garage", "/my-listings", "/ai"]);

  useEffect(() => {
    const refresh = () => setLoggedIn(Boolean(getStoredToken()));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("carvista-auth-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("carvista-auth-changed", refresh);
    };
  }, [pathname]);

  function handleLogout() {
    clearStoredToken();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-white/92 backdrop-blur-xl">
      <div className="bg-cars-primary text-white">
        <div className="container-cars flex items-center justify-between gap-4 py-2 text-xs md:text-sm">
          <p className="font-medium">
            CarVista blends marketplace flows with AI compare, forecasting, and TCO insights.
          </p>
          <button
            type="button"
            onClick={() =>
              loggedIn ? router.push("/ai") : openAuth({ mode: "login", next: "/ai" })
            }
            className="font-semibold text-white/90 hover:text-white"
          >
            Explore AI tools
          </button>
        </div>
      </div>

      <div className="container-cars flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cars-primary text-lg font-apercu-bold text-white shadow-lg shadow-cars-primary/25">
              CV
            </div>
            <div>
              <p className="text-xl font-apercu-bold text-cars-primary">CarVista</p>
              <p className="text-xs text-cars-gray">AI-powered intelligent car platform</p>
            </div>
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  if (!loggedIn && protectedRoutes.has(item.href)) {
                    e.preventDefault();
                    openAuth({ mode: "login", next: item.href });
                  }
                }}
                className={
                  active
                    ? "rounded-full bg-cars-primary px-4 py-2 font-semibold text-white shadow-sm"
                    : "rounded-full px-4 py-2 font-medium text-cars-primary transition-colors hover:bg-cars-off-white"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/listings"
            className="hidden rounded-full border border-cars-primary/15 bg-cars-off-white px-4 py-2 font-medium text-cars-primary transition-colors hover:border-cars-accent/20 hover:text-cars-accent md:inline-flex"
          >
            Browse inventory
          </Link>

          {!loggedIn ? (
            <>
              <button
                type="button"
                onClick={() => openAuth({ mode: "login", next: pathname || "/" })}
                className="rounded-full border border-cars-primary/15 px-4 py-2 font-medium text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => openAuth({ mode: "register", next: pathname || "/" })}
                className="rounded-full bg-cars-accent px-4 py-2 font-semibold text-white shadow-lg shadow-cars-accent/25 transition-transform hover:-translate-y-0.5 hover:bg-cars-primary-light"
              >
                Create account
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-cars-primary/15 px-4 py-2 font-medium text-cars-primary transition-colors hover:bg-cars-off-white"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
