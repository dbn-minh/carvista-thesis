"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import AuthPanel, { type AuthMode } from "@/components/auth/AuthPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStoredToken } from "@/lib/api-client";

type OpenOptions = {
  mode?: AuthMode;
  next?: string;
};

type AuthModalContextValue = {
  authenticated: boolean;
  openAuth: (options?: OpenOptions) => void;
  closeAuth: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [nextPath, setNextPath] = useState("/");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const refresh = () => setAuthenticated(Boolean(getStoredToken()));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("carvista-auth-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("carvista-auth-changed", refresh);
    };
  }, []);

  function openAuth(options?: OpenOptions) {
    setMode(options?.mode || "login");
    setNextPath(options?.next || pathname || "/");
    setOpen(true);
  }

  function closeAuth() {
    setOpen(false);
  }

  function handleSuccess() {
    setOpen(false);
    const target = nextPath || pathname || "/";
    if (pathname !== target) {
      router.replace(target);
      return;
    }
    router.refresh();
  }

  return (
    <AuthModalContext.Provider value={{ authenticated, openAuth, closeAuth }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DialogContent className="max-w-[520px] border-0 bg-transparent p-0 shadow-none">
            <DialogTitle className="sr-only">
              {mode === "login" ? "Login to CarVista" : "Register for CarVista"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Authenticate to continue using protected CarVista features.
            </DialogDescription>
            <AuthPanel
              mode={mode}
              next={nextPath}
              onModeChange={setMode}
              onSuccess={handleSuccess}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const value = useContext(AuthModalContext);
  if (!value) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return value;
}
