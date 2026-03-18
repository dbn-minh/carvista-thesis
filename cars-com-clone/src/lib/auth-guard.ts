"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { hasToken } from "@/lib/api-client";

export function useRequireLogin(fallbackPath?: string) {
  const pathname = usePathname();
  const { authenticated, openAuth } = useAuthModal();
  const [ready, setReady] = useState(() => hasToken());
  const requestedRef = useRef(false);

  useLayoutEffect(() => {
    const isLoggedIn = authenticated || hasToken();

    if (!isLoggedIn) {
      setReady(false);
      if (!requestedRef.current) {
        const next = fallbackPath || pathname || "/";
        openAuth({ mode: "login", next });
        requestedRef.current = true;
      }
      return;
    }

    requestedRef.current = false;
    setReady(true);
  }, [authenticated, fallbackPath, openAuth, pathname]);

  return ready;
}
