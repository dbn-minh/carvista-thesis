"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import AuthPanel from "@/components/auth/AuthPanel";

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/garage";

  return <AuthPanel mode="register" next={next} />;
}

export default function RegisterPage() {
  return (
    <>
      <Header />
      <main className="container-cars max-w-xl py-10">
        <Suspense fallback={<AuthPanel mode="register" next="/garage" />}>
          <RegisterPageContent />
        </Suspense>
      </main>
    </>
  );
}
