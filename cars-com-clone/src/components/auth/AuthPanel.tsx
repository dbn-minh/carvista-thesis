"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBanner from "@/components/common/StatusBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/carvista-api";
import { setStoredToken } from "@/lib/api-client";
import type { AuthProvidersResponse } from "@/lib/types";

export type AuthMode = "login" | "register";

type Props = {
  mode: AuthMode;
  next?: string;
  onModeChange?: (mode: AuthMode) => void;
  onSuccess?: () => void;
};

const DEFAULT_PROVIDERS: AuthProvidersResponse = {
  social: {
    google: false,
    facebook: false,
  },
};

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.805 12.231c0-.727-.065-1.426-.186-2.097H12v3.969h5.5a4.703 4.703 0 0 1-2.04 3.088v2.563h3.305c1.935-1.782 3.04-4.409 3.04-7.523Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.074-.915 6.766-2.478l-3.305-2.563c-.916.614-2.088.977-3.46.977-2.66 0-4.915-1.795-5.72-4.209H2.865v2.643A10.216 10.216 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.28 13.727A6.144 6.144 0 0 1 5.96 12c0-.599.108-1.18.32-1.727V7.63H2.865A10.216 10.216 0 0 0 1.8 12c0 1.646.393 3.204 1.065 4.37l3.415-2.643Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.064c1.5 0 2.846.516 3.906 1.53l2.93-2.93C17.07 3.02 14.756 2 12 2a10.216 10.216 0 0 0-9.135 5.63l3.415 2.643c.805-2.414 3.06-4.209 5.72-4.209Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <circle cx="12" cy="12" fill="#1877F2" r="10" />
      <path
        d="M13.307 19v-6.177h2.072l.31-2.407h-2.382V8.879c0-.697.193-1.172 1.192-1.172h1.273V5.553A17.214 17.214 0 0 0 13.917 5c-1.835 0-3.09 1.12-3.09 3.175v1.771H8.75v2.407h2.077V19h2.48Z"
        fill="#fff"
      />
    </svg>
  );
}

export default function AuthPanel({ mode, next, onModeChange, onSuccess }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [providerInfo, setProviderInfo] = useState<AuthProvidersResponse>(DEFAULT_PROVIDERS);
  const [providerStatus, setProviderStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    let mounted = true;

    authApi
      .providers()
      .then((result) => {
        if (mounted) {
          setProviderInfo(result);
          setProviderStatus("ready");
        }
      })
      .catch(() => {
        if (mounted) {
          setProviderStatus("error");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void mode;
    setMessage("");
    setTone("info");
    setPassword("");
    setConfirmPassword("");
  }, [mode]);

  const heading = useMemo(
    () =>
      mode === "login"
        ? {
            eyebrow: "CarVista account",
            title: "Welcome back",
            description:
              "Sign in to save favorites, manage listings, and pick up your search right where you left it.",
            button: "Sign in",
          }
        : {
            eyebrow: "Join CarVista",
            title: "Create your account",
            description:
              "Set up your account to save vehicles, reach sellers faster, and manage your own listings with ease.",
            button: "Create account",
          },
    [mode]
  );

  const socialLabel = mode === "login" ? "Or continue with" : "Or create your account with";
  const socialHelp =
    "Use a trusted account and we will connect it safely to your CarVista profile.";
  const googleButtonLabel = mode === "login" ? "Sign in with Google" : "Continue with Google";
  const facebookButtonLabel =
    mode === "login" ? "Sign in with Facebook" : "Continue with Facebook";
  const canUseGoogle = providerStatus !== "ready" || providerInfo.social.google;
  const canUseFacebook = providerStatus !== "ready" || providerInfo.social.facebook;
  const noSocialProvidersAvailable =
    providerStatus === "ready" && !providerInfo.social.google && !providerInfo.social.facebook;
  const fieldClassName =
    "h-12 rounded-[18px] border border-slate-200/80 bg-white/88 px-4 text-slate-800 placeholder:text-slate-400 focus-visible:border-cars-accent focus-visible:ring-cars-accent/35 dark:border-white/10 dark:bg-white/5 dark:text-primary-foreground dark:placeholder:text-primary-foreground/34 sm:h-14";
  const isRegister = mode === "register";

  async function finishAuth() {
    if (onSuccess) {
      onSuccess();
      return;
    }

    router.replace(next || "/garage");
  }

  function handleModeSwitch(nextMode: AuthMode) {
    setMessage("");

    if (onModeChange) {
      onModeChange(nextMode);
      return;
    }

    const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
    router.replace(nextMode === "login" ? `/login${suffix}` : `/register${suffix}`);
  }

  function setFriendlyError(error: unknown, fallback: string) {
    setTone("error");
    setMessage(error instanceof Error ? error.message : fallback);
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();

    if (mode === "register" && password !== confirmPassword) {
      setTone("error");
      setMessage("Passwords do not match yet. Please re-enter them and try again.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (mode === "login") {
        const result = await authApi.login({ email, password });
        setStoredToken(result.token);
        setTone("success");
        setMessage("Signed in successfully.");
        await finishAuth();
        return;
      }

      const registered = await authApi.register({ name, email, password });
      if (registered.token) {
        setStoredToken(registered.token);
        setTone("success");
        setMessage("Account created successfully.");
        await finishAuth();
        return;
      }

      const loggedIn = await authApi.login({ email, password });
      setStoredToken(loggedIn.token);
      setTone("success");
      setMessage("Account created successfully.");
      await finishAuth();
    } catch (error) {
      setFriendlyError(error, "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleSocialLogin(provider: "google" | "facebook") {
    window.location.assign(authApi.socialStartUrl(provider, next || "/garage"));
  }

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,255,0.96))] shadow-[0_32px_120px_rgba(15,45,98,0.18)] dark:border-white/8 dark:bg-[#111616] dark:shadow-[0_32px_120px_rgba(0,0,0,0.45)] sm:rounded-[36px]">
      <div className="bg-[linear-gradient(135deg,rgba(230,239,255,1),rgba(214,229,255,0.98),rgba(182,210,255,0.92))] px-5 py-6 text-slate-900 dark:bg-[linear-gradient(135deg,rgba(23,29,30,1),rgba(41,56,92,0.96),rgba(111,145,221,0.78))] dark:text-primary-foreground sm:px-7 sm:py-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cars-primary dark:text-cars-accent">
          {heading.eyebrow}
        </p>
        <h2 className="mt-2 text-[2rem] font-apercu-bold leading-tight text-slate-900 dark:text-primary-foreground sm:text-3xl">
          {heading.title}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-primary-foreground/74">
          {heading.description}
        </p>
      </div>

      <div className="space-y-5 bg-transparent px-4 py-5 dark:bg-[#111616] sm:space-y-6 sm:px-7 sm:py-7">
        <div className="flex rounded-full border border-slate-200/80 bg-white/72 p-1 shadow-[0_10px_30px_rgba(15,45,98,0.08)] dark:border-white/8 dark:bg-white/5 dark:shadow-none lg:max-w-[380px]">
          <button
            type="button"
            onClick={() => handleModeSwitch("login")}
            className={
              mode === "login"
                ? "editorial-button flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,45,98,0.18)] dark:text-slate-950"
                : "flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-white/62 dark:hover:text-white/82"
            }
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("register")}
            className={
              mode === "register"
                ? "editorial-button flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,45,98,0.18)] dark:text-slate-950"
                : "flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-white/62 dark:hover:text-white/82"
            }
          >
            Register
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:gap-6">
          <div className="space-y-4 sm:space-y-5">
            <form
              onSubmit={onPasswordSubmit}
              className={isRegister ? "grid gap-4 sm:grid-cols-2 sm:gap-5" : "space-y-4 sm:space-y-5"}
            >
              {isRegister ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-cars-accent">
                    Name
                  </label>
                  <Input
                    className={fieldClassName}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How should we address you?"
                    required
                  />
                </div>
              ) : null}

              <div className={isRegister ? "" : undefined}>
                <label className="mb-2 block text-sm font-semibold text-cars-accent">
                  Email
                </label>
                <Input
                  className={fieldClassName}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className={isRegister ? "" : undefined}>
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-sm font-semibold text-cars-accent">
                    Password
                  </label>
                  {!isRegister ? (
                    <span className="text-xs font-medium text-slate-400 dark:text-primary-foreground/34">
                      Minimum 6 characters
                    </span>
                  ) : null}
                </div>
                <Input
                  className={fieldClassName}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  minLength={6}
                  placeholder={isRegister ? "Create a password" : "Enter your password"}
                  required
                />
              </div>

              {isRegister ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-cars-accent">
                    Confirm password
                  </label>
                  <Input
                    className={fieldClassName}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type="password"
                    minLength={6}
                    placeholder="Re-enter your password"
                    required
                  />
                </div>
              ) : null}

              <div className={isRegister ? "sm:col-span-2" : undefined}>
                <Button
                  className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
                  disabled={loading}
                  type="submit"
                >
                  {loading
                    ? isRegister
                      ? "Creating account..."
                      : "Signing in..."
                    : heading.button}
                </Button>
              </div>
            </form>

            <StatusBanner tone={tone}>{message}</StatusBanner>
          </div>

          <aside className="space-y-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(236,244,255,0.98),rgba(223,235,255,0.96))] px-4 py-4 text-slate-800 shadow-[0_18px_48px_rgba(15,45,98,0.08)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(24,30,38,0.96),rgba(16,20,19,0.96))] dark:text-primary-foreground dark:shadow-none sm:px-5 sm:py-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-primary-foreground/50">
                {socialLabel}
              </p>
              <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/72">{socialHelp}</p>
            </div>

            <div className="grid gap-3">
              <button
                className={`flex min-h-12 w-full items-center gap-3 rounded-full border px-4 text-left transition ${
                  canUseGoogle
                    ? "border-slate-200/80 bg-white/78 text-slate-800 shadow-[0_14px_34px_rgba(15,45,98,0.08)] hover:border-cars-primary/35 hover:bg-white dark:border-white/18 dark:bg-white/[0.02] dark:text-primary-foreground dark:shadow-[0_14px_34px_rgba(0,0,0,0.24)] dark:hover:border-cars-accent/55 dark:hover:bg-white/[0.08]"
                    : "cursor-not-allowed border-slate-200/80 bg-white/55 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-primary-foreground/35"
                }`}
                disabled={!canUseGoogle}
                onClick={() => handleSocialLogin("google")}
                type="button"
              >
                <GoogleLogo />
                <span className="whitespace-normal font-semibold leading-5 text-slate-800 dark:text-primary-foreground">
                  {googleButtonLabel}
                </span>
              </button>
              <button
                className={`flex min-h-12 w-full items-center gap-3 rounded-full border px-4 text-left transition ${
                  canUseFacebook
                    ? "border-slate-200/80 bg-white/78 text-slate-800 shadow-[0_14px_34px_rgba(15,45,98,0.08)] hover:border-cars-primary/35 hover:bg-white dark:border-white/18 dark:bg-white/[0.02] dark:text-primary-foreground dark:shadow-[0_14px_34px_rgba(0,0,0,0.24)] dark:hover:border-cars-accent/55 dark:hover:bg-white/[0.08]"
                    : "cursor-not-allowed border-slate-200/80 bg-white/55 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-primary-foreground/35"
                }`}
                disabled={!canUseFacebook}
                onClick={() => handleSocialLogin("facebook")}
                type="button"
              >
                <FacebookLogo />
                <span className="whitespace-normal font-semibold leading-5 text-slate-800 dark:text-primary-foreground">
                  {facebookButtonLabel}
                </span>
              </button>
            </div>

            {providerStatus === "error" ? (
              <p className="text-xs leading-5 text-slate-500 dark:text-primary-foreground/54">
                We could not confirm provider availability just now, but you can still try a
                social sign-in.
              </p>
            ) : null}
            {noSocialProvidersAvailable ? (
              <p className="text-xs leading-5 text-slate-500 dark:text-primary-foreground/54">
                Social login buttons will appear here once the provider keys are configured.
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}
