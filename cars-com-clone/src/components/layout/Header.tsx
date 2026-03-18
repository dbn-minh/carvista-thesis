"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  const [loggedIn, setLoggedIn] = useState(false);

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
    window.location.href = "/";
  }

  return (
    <header className="border-b bg-white">
      <div className="container-cars flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="text-xl font-bold text-purple-900">
          CarVista
        </Link>

        <nav className="flex flex-wrap items-center gap-4 text-sm">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "font-semibold text-purple-800" : "hover:text-purple-700"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          {!loggedIn ? (
            <>
              <Link href="/login" className="rounded border px-3 py-2 hover:bg-slate-50">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded bg-purple-800 px-3 py-2 text-white hover:bg-purple-700"
              >
                Register
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border px-3 py-2 hover:bg-slate-50"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
