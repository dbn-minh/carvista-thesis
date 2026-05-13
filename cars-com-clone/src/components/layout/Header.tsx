"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Inbox, Menu, UserRound, type LucideIcon } from "lucide-react";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import ThemeToggle from "@/components/theme/ThemeToggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { requestsApi } from "@/lib/carvista-api";
import { getStoredToken } from "@/lib/api-client";

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
const primaryNav = nav.filter((item) => !item.iconOnly);
const utilityNav = nav.filter((item) => item.iconOnly);

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { openAssistant } = useAiAssistant();
  const { openAuth } = useAuthModal();
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const protectedRoutes = new Set(["/sell", "/garage", "/my-listings", "/requests", "/profile"]);

  useEffect(() => {
    void pathname;
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
    void pathname;
    if (!loggedIn) {
      setPendingRequestCount(0);
      return;
    }

    let disposed = false;

    const refreshPendingRequests = async () => {
      try {
        const inbox = await requestsApi.inbox();
        if (!disposed) {
          setPendingRequestCount(inbox.items.filter((item) => item.status === "new").length);
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

  useEffect(() => {
    void pathname;
    setMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    setMenuOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("carvista_token");
      window.location.replace("/");
      return;
    }

    router.replace("/");
  }

  function handleProtectedLink(href: string) {
    setMenuOpen(false);
    if (!loggedIn && protectedRoutes.has(href)) {
      openAuth({ mode: "login", next: href });
      return;
    }
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/6 bg-[#0f1414]/88 backdrop-blur-2xl">
      <div className="border-b border-white/6 bg-[linear-gradient(90deg,rgba(111,145,221,0.16),rgba(197,246,255,0.08),rgba(218,185,255,0.08))] text-white">
      </div>

      <div className="container-cars flex items-center justify-between gap-3 py-3 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-6 lg:py-4">
        <div className="min-w-0 flex items-center gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="CarVista home">
            <div className="flex h-12 w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-white/12 bg-white px-2 py-1 shadow-[0_18px_42px_rgba(197,246,255,0.2)]">
              <Image
                src="/logos/carvista-logo-icon.png"
                alt=""
                width={931}
                height={482}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-apercu-bold text-white sm:text-xl">CarVista</p>
              <p className="truncate text-[11px] leading-4 text-slate-400 sm:text-xs">
                AI-powered intelligent car platform
              </p>
            </div>
          </Link>
        </div>

        <nav className="hidden flex-wrap items-center gap-2 text-sm lg:flex lg:justify-center">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const badgeCount = item.href === "/requests" ? pendingRequestCount : 0;
            const accessibleLabel =
              badgeCount > 0 ? `${item.label} (${badgeCount} pending)` : item.label;

            const stateClass = item.iconOnly
              ? active
                ? "relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(111,145,221,1),rgba(146,175,238,0.95))] text-slate-950 shadow-sm"
                : "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/4 text-white transition-colors hover:bg-white/8"
              : active
                ? "rounded-full bg-[linear-gradient(135deg,rgba(111,145,221,1),rgba(146,175,238,0.95))] px-4 py-2 font-semibold text-slate-950 shadow-sm"
                : "rounded-full border border-white/8 bg-white/4 px-4 py-2 font-medium text-white transition-colors hover:bg-white/8";

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
                className={stateClass}
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

        <div className="hidden items-center gap-3 text-sm lg:flex lg:justify-end">
          <ThemeToggle />
          {!loggedIn ? (
            <>
              <button
                type="button"
                onClick={() => openAuth({ mode: "login", next: pathname || "/" })}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition-colors hover:bg-white/10"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => openAuth({ mode: "register", next: pathname || "/" })}
                className="editorial-button rounded-full px-4 py-2 font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 hover:brightness-105"
              >
                Create account
              </button>
            </>
          ) : (
            <>
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition-colors hover:bg-white/10"
              >
                <UserRound className="h-4 w-4" />
                Profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition-colors hover:bg-white/10"
              >
                Logout
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-[min(88vw,360px)] flex-col border-l border-white/10 bg-[#111616]/98 px-5 pb-6 pt-12 text-left text-white sm:max-w-none"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-white">Navigate CarVista</SheetTitle>
            <SheetDescription>
              Browse research, listings, AI tools, and account actions without leaving the current page.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-2">
            {primaryNav.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleProtectedLink(item.href)}
                  className={
                    active
                      ? "flex w-full items-center justify-between rounded-2xl bg-[linear-gradient(135deg,rgba(111,145,221,1),rgba(146,175,238,0.95))] px-4 py-3 text-left text-sm font-semibold text-slate-950 shadow-sm"
                      : "flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left text-sm font-medium text-white/88 transition-colors hover:bg-white/8"
                  }
                >
                  <span>{item.label}</span>
                  {protectedRoutes.has(item.href) && !loggedIn ? (
                    <span className={active ? "text-slate-900/70" : "text-white/42"}>
                      Login required
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {utilityNav.map((item) => {
              const Icon = item.icon;
              const badgeCount = item.href === "/requests" ? pendingRequestCount : 0;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleProtectedLink(item.href)}
                  className="relative flex min-h-[88px] flex-col items-start justify-between rounded-[24px] border border-white/8 bg-white/4 px-4 py-4 text-left text-white/88 transition-colors hover:bg-white/8"
                >
                  {Icon ? <Icon className="h-5 w-5" /> : null}
                  <span className="text-sm font-semibold leading-5">{item.label}</span>
                  {badgeCount > 0 ? (
                    <span className="absolute right-3 top-3 inline-flex min-h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              openAssistant();
            }}
            className="editorial-button mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:brightness-105"
          >
            Open AI tools
          </button>

          <div className="mt-auto flex flex-col gap-3 pt-6">
            {!loggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openAuth({ mode: "login", next: pathname || "/" });
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openAuth({ mode: "register", next: pathname || "/" });
                  }}
                  className="editorial-button inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:brightness-105"
                >
                  Create account
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleProtectedLink("/profile")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  <UserRound className="h-4 w-4" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
