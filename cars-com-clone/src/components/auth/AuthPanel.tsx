"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBanner from "@/components/common/StatusBanner";
import { authApi } from "@/lib/carvista-api";
import { setStoredToken } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AuthMode = "login" | "register";

type Props = {
  mode: AuthMode;
  next?: string;
  onModeChange?: (mode: AuthMode) => void;
  onSuccess?: () => void;
};

export default function AuthPanel({ mode, next, onModeChange, onSuccess }: Props) {
  const router = useRouter();
  const [name, setName] = useState("Test User");
  const [email, setEmail] = useState("user@example.com");
  const [phone, setPhone] = useState("0900000000");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");

  const heading = useMemo(
    () =>
      mode === "login"
        ? {
            title: "Welcome back",
            description: "Sign in to continue saving cars, sending requests, and using AI tools.",
            button: "Login",
          }
        : {
            title: "Create your account",
            description: "Join CarVista to manage listings, watch cars, and unlock protected flows.",
            button: "Create account",
          },
    [mode]
  );

  async function finishAuth() {
    if (onSuccess) {
      onSuccess();
      return;
    }
    router.replace(next || "/garage");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "login") {
        const res = await authApi.login({ email, password });
        setStoredToken(res.token);
        setTone("success");
        setMessage("Login successful.");
        await finishAuth();
      } else {
        await authApi.register({ name, email, phone, password });
        const res = await authApi.login({ email, password });
        setStoredToken(res.token);
        setTone("success");
        setMessage("Account created successfully.");
        await finishAuth();
      }
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-[0_28px_90px_rgba(15,45,98,0.16)]">
      <div className="bg-[linear-gradient(135deg,rgba(15,45,98,0.96),rgba(27,76,160,0.92),rgba(95,150,255,0.72))] px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          CarVista access
        </p>
        <h2 className="mt-2 text-3xl font-apercu-bold">{heading.title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">{heading.description}</p>
      </div>

      <div className="px-6 py-6">
        <div className="mb-5 flex rounded-full bg-cars-off-white p-1">
          <button
            type="button"
            onClick={() => onModeChange?.("login")}
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
            onClick={() => onModeChange?.("register")}
            className={
              mode === "register"
                ? "flex-1 rounded-full bg-cars-primary px-4 py-2 text-sm font-semibold text-white"
                : "flex-1 rounded-full px-4 py-2 text-sm font-semibold text-cars-primary"
            }
          >
            Register
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "register" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-cars-primary">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-semibold text-cars-primary">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>

          {mode === "register" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-cars-primary">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="text" />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-semibold text-cars-primary">Password</label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={6}
              required
            />
          </div>

          <Button
            className="h-11 w-full rounded-full bg-cars-primary text-sm font-semibold text-white hover:bg-cars-primary-light"
            disabled={loading}
            type="submit"
          >
            {loading ? (mode === "login" ? "Logging in..." : "Creating...") : heading.button}
          </Button>

          <StatusBanner tone={tone}>{message}</StatusBanner>
        </form>
      </div>
    </section>
  );
}
