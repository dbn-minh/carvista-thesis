"use client";

import { useEffect } from "react";
import { AiAssistantProvider } from "@/components/ai/AiAssistantProvider";
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
      <AiAssistantProvider>
        <div className="antialiased font-apercu-regular">{children}</div>
      </AiAssistantProvider>
    </AuthModalProvider>
  );
}
