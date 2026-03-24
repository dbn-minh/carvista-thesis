"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import StatusBanner from "@/components/common/StatusBanner";
import { Button } from "@/components/ui/button";
import { setStoredToken } from "@/lib/api-client";

export default function SocialAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Completing your sign-in...");
  const [nextPath, setNextPath] = useState("/garage");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("token");
    const errorMessage = hash.get("error");
    const next = hash.get("next") || "/garage";
    const safeDestination = next.startsWith("/") ? next : "/garage";
    setNextPath(safeDestination);

    if (errorMessage) {
      setError(errorMessage);
      setStatus("");
      return;
    }

    if (!token) {
      setError("We could not complete social login. Please try again.");
      setStatus("");
      return;
    }

    setStoredToken(token);
    setStatus("You are signed in. Redirecting now...");

    const timer = window.setTimeout(() => {
      router.replace(safeDestination);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <>
      <Header />
      <main className="container-cars max-w-xl py-10">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-[0_28px_90px_rgba(15,45,98,0.16)]">
          <div className="bg-[linear-gradient(135deg,rgba(15,45,98,0.96),rgba(27,76,160,0.92),rgba(95,150,255,0.72))] px-6 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              CarVista access
            </p>
            <h1 className="mt-2 text-3xl font-apercu-bold">Social sign-in</h1>
            <p className="mt-3 text-sm leading-6 text-white/85">
              We are finishing your secure sign-in and linking your CarVista account.
            </p>
          </div>
          <div className="space-y-4 px-6 py-6">
            <StatusBanner tone={error ? "error" : "info"}>{error || status}</StatusBanner>
            {error ? (
              <Button
                className="rounded-full bg-cars-primary text-white hover:bg-cars-primary-light"
                onClick={() => router.replace(`/login?next=${encodeURIComponent(nextPath)}`)}
                type="button"
              >
                Return to login
              </Button>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}
