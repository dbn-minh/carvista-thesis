"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import AuthPanel from "@/components/auth/AuthPanel";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/garage";

  return <AuthPanel mode="login" next={next} />;
}

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="container-cars max-w-xl py-10">
        <Suspense fallback={<AuthPanel mode="login" next="/garage" />}>
          <LoginPageContent />
        </Suspense>
      </main>
    </>
  );
}
