"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Facebook } from "lucide-react";
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
  const canUseGoogle = providerStatus !== "ready" || providerInfo.social.google;
  const canUseFacebook = providerStatus !== "ready" || providerInfo.social.facebook;
  const noSocialProvidersAvailable =
    providerStatus === "ready" && !providerInfo.social.google && !providerInfo.social.facebook;

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
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-[0_28px_90px_rgba(15,45,98,0.16)]">
      <div className="bg-[linear-gradient(135deg,rgba(15,45,98,0.96),rgba(27,76,160,0.92),rgba(95,150,255,0.72))] px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          {heading.eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-apercu-bold">{heading.title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">{heading.description}</p>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="flex rounded-full bg-cars-off-white p-1">
          <button
            type="button"
            onClick={() => handleModeSwitch("login")}
            className={
              mode === "login"
                ? "flex-1 rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                : "flex-1 rounded-full px-4 py-2 text-sm font-semibold text-cars-primary"
            }
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("register")}
            className={
              mode === "register"
                ? "flex-1 rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                : "flex-1 rounded-full px-4 py-2 text-sm font-semibold text-cars-primary"
            }
          >
            Register
          </button>
        </div>

        <form onSubmit={onPasswordSubmit} className="space-y-4">
          {mode === "register" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-cars-primary">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should we address you?"
                required
              />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-semibold text-cars-primary">Email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-cars-primary">Password</label>
              {mode === "login" ? (
                <span className="text-xs font-medium text-slate-400">
                  Minimum 6 characters
                </span>
              ) : null}
            </div>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={6}
              placeholder={mode === "login" ? "Enter your password" : "Create a password"}
              required
            />
          </div>

          {mode === "register" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-cars-primary">
                Confirm password
              </label>
              <Input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                minLength={6}
                placeholder="Re-enter your password"
                required
              />
            </div>
          ) : null}

          <Button
            className="h-11 w-full rounded-full bg-cars-primary text-sm font-semibold text-white hover:bg-cars-primary-light"
            disabled={loading}
            type="submit"
          >
            {loading
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : heading.button}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {socialLabel}
          </p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm text-slate-600">{socialHelp}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className="h-11 rounded-full"
              disabled={!canUseGoogle}
              onClick={() => handleSocialLogin("google")}
              type="button"
              variant="outline"
            >
              <span className="font-semibold">Google</span>
            </Button>
            <Button
              className="h-11 rounded-full"
              disabled={!canUseFacebook}
              onClick={() => handleSocialLogin("facebook")}
              type="button"
              variant="outline"
            >
              <Facebook className="h-4 w-4" />
              <span className="font-semibold">Facebook</span>
            </Button>
          </div>
          {providerStatus === "error" ? (
            <p className="text-xs text-slate-500">
              We could not confirm provider availability just now, but you can still try a social
              sign-in.
            </p>
          ) : null}
          {noSocialProvidersAvailable ? (
            <p className="text-xs text-slate-500">
              Social login buttons will appear here once the provider keys are configured.
            </p>
          ) : null}
        </div>

        <StatusBanner tone={tone}>{message}</StatusBanner>
      </div>
    </section>
  );
}
