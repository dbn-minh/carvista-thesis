"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Facebook, Mail, MessageSquareText, Smartphone } from "lucide-react";
import StatusBanner from "@/components/common/StatusBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/carvista-api";
import { setStoredToken } from "@/lib/api-client";
import type {
  AuthProvidersResponse,
  OtpRequestResponse,
} from "@/lib/types";

export type AuthMode = "login" | "register";

type AuthMethod = "password" | "email-otp" | "phone-otp";

type Props = {
  mode: AuthMode;
  next?: string;
  onModeChange?: (mode: AuthMode) => void;
  onSuccess?: () => void;
};

const DEFAULT_PROVIDERS: AuthProvidersResponse = {
  otp: {
    email: true,
    phone: true,
    expires_in_minutes: 10,
    resend_cooldown_seconds: 60,
  },
  social: {
    google: false,
    facebook: false,
  },
};

export default function AuthPanel({ mode, next, onModeChange, onSuccess }: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<AuthMethod>("password");
  const [name, setName] = useState("Test User");
  const [email, setEmail] = useState("user@example.com");
  const [phone, setPhone] = useState("0900000000");
  const [password, setPassword] = useState("123456");
  const [otpCode, setOtpCode] = useState("");
  const [otpChallenge, setOtpChallenge] = useState<OtpRequestResponse | null>(null);
  const [providerInfo, setProviderInfo] = useState<AuthProvidersResponse>(DEFAULT_PROVIDERS);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "error" | "info">("info");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;

    authApi
      .providers()
      .then((result) => {
        if (mounted) {
          setProviderInfo(result);
        }
      })
      .catch(() => {
        if (mounted) {
          setProviderInfo(DEFAULT_PROVIDERS);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setMessage("");
    setTone("info");
    setOtpChallenge(null);
    setOtpCode("");
    setMethod("password");
  }, [mode]);

  useEffect(() => {
    if (!otpChallenge) return undefined;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [otpChallenge]);

  const heading = useMemo(
    () =>
      mode === "login"
        ? {
            title: "Welcome back",
            description:
              "Sign in with your password, a one-time code, or a trusted social account.",
            button: "Login",
          }
        : {
            title: "Create your account",
            description:
              "Create a CarVista account with a password, a one-time code, or a trusted social account.",
            button: "Create account",
          },
    [mode]
  );

  const activeDestinationType = method === "phone-otp" ? "phone" : "email";
  const activeDestinationValue = activeDestinationType === "phone" ? phone : email;
  const resendSeconds = otpChallenge
    ? Math.max(
        0,
        Math.ceil((new Date(otpChallenge.resend_available_at).getTime() - now) / 1000)
      )
    : 0;

  async function finishAuth() {
    if (onSuccess) {
      onSuccess();
      return;
    }

    router.replace(next || "/garage");
  }

  function handleModeSwitch(nextMode: AuthMode) {
    setMessage("");
    setOtpChallenge(null);
    setOtpCode("");

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
    setLoading(true);
    setMessage("");

    try {
      if (mode === "login") {
        const result = await authApi.login({ email, password });
        setStoredToken(result.token);
        setTone("success");
        setMessage("Login successful.");
        await finishAuth();
        return;
      }

      const registered = await authApi.register({ name, email, phone, password });
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

  async function requestOtp() {
    if (activeDestinationType === "email" && !email.trim()) {
      setTone("error");
      setMessage("Enter your email address before requesting a code.");
      return;
    }

    if (activeDestinationType === "phone" && phone.trim().length < 8) {
      setTone("error");
      setMessage("Enter a valid phone number before requesting a code.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await authApi.requestOtp({
        destination_type: activeDestinationType,
        destination_value: activeDestinationValue,
        purpose: mode === "register" ? "register" : "login",
      });
      setOtpChallenge(result);
      setOtpCode("");
      setTone("success");
      setMessage(
        activeDestinationType === "email"
          ? "We sent a verification code to your email."
          : "We sent a verification code to your phone."
      );
      setNow(Date.now());
    } catch (error) {
      setFriendlyError(error, "We could not send a verification code right now.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();

    if (!otpChallenge) {
      setTone("error");
      setMessage("Request a verification code first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await authApi.verifyOtp({
        challenge_id: otpChallenge.challenge_id,
        destination_type: otpChallenge.destination_type,
        destination_value: otpChallenge.destination_value,
        code: otpCode,
        profile_name: name || undefined,
      });
      setStoredToken(result.token);
      setTone("success");
      setMessage(
        result.user_created
          ? "Your account is ready and you are now signed in."
          : "Verification successful."
      );
      await finishAuth();
    } catch (error) {
      setFriendlyError(error, "That code could not be verified.");
    } finally {
      setLoading(false);
    }
  }

  function handleSocialLogin(provider: "google" | "facebook") {
    window.location.assign(authApi.socialStartUrl(provider, next || "/garage"));
  }

  const showPasswordFields = method === "password";
  const showOtpFields = method === "email-otp" || method === "phone-otp";

  return (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-[0_28px_90px_rgba(15,45,98,0.16)]">
      <div className="bg-[linear-gradient(135deg,rgba(15,45,98,0.96),rgba(27,76,160,0.92),rgba(95,150,255,0.72))] px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          CarVista access
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

        <div className="grid gap-2 sm:grid-cols-3">
          <MethodButton
            active={method === "password"}
            icon={<Mail className="h-4 w-4" />}
            label={mode === "login" ? "Password" : "Create with password"}
            onClick={() => {
              setMethod("password");
              setOtpChallenge(null);
              setMessage("");
            }}
          />
          <MethodButton
            active={method === "email-otp"}
            disabled={!providerInfo.otp.email}
            icon={<MessageSquareText className="h-4 w-4" />}
            label="Email OTP"
            onClick={() => {
              setMethod("email-otp");
              setOtpChallenge(null);
              setMessage("");
            }}
          />
          <MethodButton
            active={method === "phone-otp"}
            disabled={!providerInfo.otp.phone}
            icon={<Smartphone className="h-4 w-4" />}
            label="Phone OTP"
            onClick={() => {
              setMethod("phone-otp");
              setOtpChallenge(null);
              setMessage("");
            }}
          />
        </div>

        {showPasswordFields ? (
          <form onSubmit={onPasswordSubmit} className="space-y-4">
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
          </form>
        ) : null}

        {showOtpFields ? (
          <form onSubmit={verifyOtp} className="space-y-4">
            {mode === "register" ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-cars-primary">
                  Your name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How should we address you?"
                />
              </div>
            ) : null}

            {method === "email-otp" ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-cars-primary">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-semibold text-cars-primary">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="text" required />
              </div>
            )}

            {otpChallenge ? (
              <>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Code sent to <strong>{otpChallenge.destination_value}</strong>. It expires in{" "}
                  {providerInfo.otp.expires_in_minutes} minutes.
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-cars-primary">
                    Verification code
                  </label>
                  <Input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Enter the code"
                    required
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="h-11 flex-1 rounded-full bg-cars-primary text-sm font-semibold text-white hover:bg-cars-primary-light"
                    disabled={loading || otpCode.trim().length < 4}
                    type="submit"
                  >
                    {loading ? "Verifying..." : "Verify code"}
                  </Button>
                  <Button
                    className="h-11 rounded-full"
                    disabled={loading || resendSeconds > 0}
                    onClick={(e) => {
                      e.preventDefault();
                      requestOtp();
                    }}
                    type="button"
                    variant="outline"
                  >
                    {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
                  </Button>
                </div>

                <button
                  type="button"
                  className="text-sm font-semibold text-cars-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setOtpChallenge(null);
                    setOtpCode("");
                    setMessage("");
                  }}
                >
                  Use a different {method === "phone-otp" ? "phone number" : "email"}
                </button>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  We&apos;ll send a secure one-time code and sign you in after verification.
                </div>

                <Button
                  className="h-11 w-full rounded-full bg-cars-primary text-sm font-semibold text-white hover:bg-cars-primary-light"
                  disabled={loading}
                  onClick={(e) => {
                    e.preventDefault();
                    requestOtp();
                  }}
                  type="button"
                >
                  {loading
                    ? "Sending code..."
                    : method === "phone-otp"
                      ? "Send code by SMS"
                      : "Send code by email"}
                </Button>
              </>
            )}
          </form>
        ) : null}

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-cars-primary">Or continue with</p>
            <p className="mt-1 text-sm text-slate-600">
              Use a trusted account and we&apos;ll link it safely to your CarVista profile.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className="h-11 rounded-full"
              disabled={!providerInfo.social.google}
              onClick={() => handleSocialLogin("google")}
              type="button"
              variant="outline"
            >
              <span className="font-semibold">Google</span>
            </Button>
            <Button
              className="h-11 rounded-full"
              disabled={!providerInfo.social.facebook}
              onClick={() => handleSocialLogin("facebook")}
              type="button"
              variant="outline"
            >
              <Facebook className="h-4 w-4" />
              <span className="font-semibold">Facebook</span>
            </Button>
          </div>
          {!providerInfo.social.google && !providerInfo.social.facebook ? (
            <p className="text-xs text-slate-500">
              Social login will appear here once the provider keys are configured.
            </p>
          ) : null}
        </div>

        <StatusBanner tone={tone}>{message}</StatusBanner>
      </div>
    </section>
  );
}

function MethodButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        active
          ? "flex items-center justify-center gap-2 rounded-2xl border border-cars-primary bg-blue-50 px-4 py-3 text-sm font-semibold text-cars-primary"
          : "flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-cars-primary/40 hover:text-cars-primary disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {icon}
      {label}
    </button>
  );
}
