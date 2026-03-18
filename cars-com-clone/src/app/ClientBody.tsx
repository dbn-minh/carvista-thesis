"use client";

import { useEffect } from "react";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";

export default function ClientBody({
  children,
}: {
  children: React.ReactNode;
}) {
  // Remove any extension-added classes during hydration
  useEffect(() => {
    // This runs only on the client after hydration
    document.body.className = "antialiased font-apercu-regular";
  }, []);

  return (
    <AuthModalProvider>
      <div className="antialiased font-apercu-regular">{children}</div>
    </AuthModalProvider>
  );
}
