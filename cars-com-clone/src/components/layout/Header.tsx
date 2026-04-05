"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Inbox, UserRound, type LucideIcon } from "lucide-react";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { requestsApi } from "@/lib/carvista-api";
import { clearStoredToken, getStoredToken } from "@/lib/api-client";

type NavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  iconOnly?: boolean;
};

const nav: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog" },
  { href: "/listings", label: "Listings" },
  { href: "/sell", label: "Sell" },
  { href: "/my-listings", label: "My Listings" },
  { href: "/garage", label: "Saved Cars", icon: Heart, iconOnly: true },
  { href: "/requests", label: "Viewing Requests", icon: Inbox, iconOnly: true },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { openAssistant } = useAiAssistant();
  const { openAuth } = useAuthModal();
  const [loggedIn, setLoggedIn] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const protectedRoutes = new Set(["/sell", "/garage", "/my-listings", "/requests", "/profile"]);

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

  useEffect(() => {
    if (!loggedIn) {
      setPendingRequestCount(0);
      return;
    }

    let disposed = false;

    const refreshPendingRequests = async () => {
      try {
        const inbox = await requestsApi.inbox();
        if (!disposed) {
          setPendingRequestCount(
            inbox.items.filter((item) => item.status === "new").length
          );
        }
      } catch {
        if (!disposed) {
          setPendingRequestCount(0);
        }
      }
    };

    const handleRequestRefresh = () => {
      void refreshPendingRequests();
    };

    void refreshPendingRequests();
    window.addEventListener("carvista-requests-changed", handleRequestRefresh);

    return () => {
      disposed = true;
      window.removeEventListener("carvista-requests-changed", handleRequestRefresh);
    };
  }, [loggedIn, pathname]);

  function handleLogout() {
    clearStoredToken();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-white/92 backdrop-blur-xl dark:border-cars-gray-light/30 dark:bg-slate-950/90">
      <div className="bg-cars-primary text-white">
        <div className="container-cars flex items-center justify-between gap-4 py-2 text-xs md:text-sm">
          <p className="font-medium">
            CarVista blends marketplace flows with AI compare, forecasting, and TCO insights.
          </p>
          <button
            type="button"
            onClick={() => openAssistant()}
            className="font-semibold text-white/90 hover:text-white"
          >
            Explore AI tools
          </button>
        </div>
      </div>

        <div className="container-cars flex flex-col gap-4 py-4 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center">
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

        <nav className="flex flex-wrap items-center gap-2 text-sm lg:justify-center">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const badgeCount = item.href === "/requests" ? pendingRequestCount : 0;
            const accessibleLabel =
              badgeCount > 0 ? `${item.label} (${badgeCount} pending)` : item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={accessibleLabel}
                title={accessibleLabel}
                onClick={(e) => {
                  if (!loggedIn && protectedRoutes.has(item.href)) {
                    e.preventDefault();
                    openAuth({ mode: "login", next: item.href });
                  }
                }}
                className={
                  item.iconOnly
                    ? active
                      ? "relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-cars-primary text-white shadow-sm"
                      : "relative inline-flex h-10 w-10 items-center justify-center rounded-full text-cars-primary transition-colors hover:bg-cars-off-white"
                    : active
                      ? "rounded-full bg-cars-primary px-4 py-2 font-semibold text-white shadow-sm"
                      : "rounded-full px-4 py-2 font-medium text-cars-primary transition-colors hover:bg-cars-off-white"
                }
              >
                {Icon ? <Icon className="h-4 w-4" /> : item.label}
                {badgeCount > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-[0_8px_18px_rgba(239,68,68,0.35)]">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                ) : null}
                {item.iconOnly ? <span className="sr-only">{accessibleLabel}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-sm lg:justify-end">
          <ThemeToggle />
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
            <>
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-full border border-cars-primary/15 px-4 py-2 font-medium text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                <UserRound className="h-4 w-4" />
                Profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-cars-primary/15 px-4 py-2 font-medium text-cars-primary transition-colors hover:bg-cars-off-white"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
