"use client";

import { useEffect } from "react";
import { AiAssistantProvider } from "@/components/ai/AiAssistantProvider";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export default function ClientBody({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.body.classList.add("antialiased", "font-dm-sans");
  }, []);

  return (
    <ThemeProvider>
      <AuthModalProvider>
        <AiAssistantProvider>
          <div className="antialiased font-dm-sans">{children}</div>
        </AiAssistantProvider>
      </AuthModalProvider>
    </ThemeProvider>
  );
}
