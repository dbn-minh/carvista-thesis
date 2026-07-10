"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBanner from "@/components/common/StatusBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setStoredToken } from "@/lib/api-client";
import { authApi } from "@/lib/carvista-api";
import {
  hasVietnamPhoneSubscriberDigits,
  normalizeVietnamPhoneInput,
  VIETNAM_PHONE_PREFIX,
  withVietnamPhonePrefix,
} from "@/lib/phone";
import type { AuthProvidersResponse } from "@/lib/types";

export type AuthMode = "login" | "register";

type Props = {
  mode: AuthMode;
  next?: string;
  onModeChange?: (mode: AuthMode) => void;
  onSuccess?: () => void;
};

type AuthFlow = "auth" | "forgot";
type OtpDestinationType = "email" | "phone";
type ForgotStep = "request" | "verify" | "password" | "success";
type RegisterStep = "contact" | "verify" | "password";

const DEFAULT_PROVIDERS: AuthProvidersResponse = {
  otp: {
    email: false,
    phone: false,
    expires_in_minutes: 1,
    resend_cooldown_seconds: 60,
  },
  social: {
    google: false,
    facebook: false,
  },
};

const GENERIC_OTP_SENT_MESSAGE = "If the account exists, an OTP has been sent.";
const PASSWORD_REQUIREMENT_TEXT =
  "Use 8+ characters with an uppercase letter, a number, and a special character.";

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  if (minutes <= 0) return `${remainder}s`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function getRemainingSeconds(target: string | null, nowMs: number) {
  if (!target) return 0;
  const targetMs = new Date(target).getTime();
  if (Number.isNaN(targetMs)) return 0;
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
}

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

function segmentClass(active: boolean, disabled = false) {
  if (active) {
    return "editorial-button flex min-h-10 flex-1 items-center justify-center rounded-full px-3 py-2 text-sm font-semibold text-white dark:text-slate-950";
  }

  return `flex min-h-10 flex-1 items-center justify-center rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
    disabled
      ? "cursor-not-allowed text-slate-300 dark:text-white/28"
      : "text-slate-500 hover:text-slate-700 dark:text-white/62 dark:hover:text-white/82"
  }`;
}

function DestinationToggle({
  value,
  onChange,
  canUseEmail,
  canUsePhone,
}: {
  value: OtpDestinationType;
  onChange: (value: OtpDestinationType) => void;
  canUseEmail: boolean;
  canUsePhone: boolean;
}) {
  return (
    <div className="flex rounded-full border border-slate-200/80 bg-white/72 p-1 dark:border-white/8 dark:bg-white/5">
      <button
        className={segmentClass(value === "email", !canUseEmail)}
        disabled={!canUseEmail}
        onClick={() => onChange("email")}
        type="button"
      >
        Email
      </button>
      <button
        className={segmentClass(value === "phone", !canUsePhone)}
        disabled={!canUsePhone}
        onClick={() => onChange("phone")}
        type="button"
      >
        Phone
      </button>
    </div>
  );
}

export default function AuthPanel({
  mode,
  next,
  onModeChange,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [flow, setFlow] = useState<AuthFlow>("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(VIETNAM_PHONE_PREFIX);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [providerInfo, setProviderInfo] =
    useState<AuthProvidersResponse>(DEFAULT_PROVIDERS);
  const [providerStatus, setProviderStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("contact");
  const [registerOtpType, setRegisterOtpType] =
    useState<OtpDestinationType>("email");
  const [registerOtpCode, setRegisterOtpCode] = useState("");
  const [registerOtpChallengeId, setRegisterOtpChallengeId] = useState<
    number | null
  >(null);
  const [registerOtpMasked, setRegisterOtpMasked] = useState("");
  const [registerOtpResendAt, setRegisterOtpResendAt] = useState<string | null>(
    null,
  );
  const [registerVerificationToken, setRegisterVerificationToken] =
    useState("");
  const [forgotOtpType, setForgotOtpType] =
    useState<OtpDestinationType>("email");
  const [forgotOtpValue, setForgotOtpValue] = useState("");
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [forgotOtpChallengeId, setForgotOtpChallengeId] = useState<
    number | null
  >(null);
  const [forgotOtpMasked, setForgotOtpMasked] = useState("");
  const [forgotOtpResendAt, setForgotOtpResendAt] = useState<string | null>(
    null,
  );
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [forgotResetComplete, setForgotResetComplete] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
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
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const canUseEmailOtp =
    providerStatus !== "ready" || Boolean(providerInfo.otp?.email);
  const canUsePhoneOtp =
    providerStatus !== "ready" || Boolean(providerInfo.otp?.phone);
  const canUseOtp = canUseEmailOtp || canUsePhoneOtp;
  const canUseGoogle = providerStatus !== "ready" || providerInfo.social.google;
  const canUseFacebook =
    providerStatus !== "ready" || providerInfo.social.facebook;
  const noSocialProvidersAvailable =
    providerStatus === "ready" &&
    !providerInfo.social.google &&
    !providerInfo.social.facebook;
  const otpExpiryMinutes = providerInfo.otp?.expires_in_minutes ?? 1;
  const otpExpiryLabel = `${otpExpiryMinutes} minute${otpExpiryMinutes === 1 ? "" : "s"}`;
  const isRegister = mode === "register";
  const isRegisterVerificationFlow =
    flow === "auth" && isRegister && registerStep !== "contact";
  const registerResendSeconds = getRemainingSeconds(registerOtpResendAt, nowMs);
  const forgotResendSeconds = getRemainingSeconds(forgotOtpResendAt, nowMs);
  const forgotStep: ForgotStep = forgotResetComplete
    ? "success"
    : forgotResetToken
      ? "password"
      : forgotOtpChallengeId
        ? "verify"
        : "request";
  const isRecoveryFlow = flow === "forgot";

  useEffect(() => {
    void mode;
    setFlow("auth");
    setMessage("");
    setTone("info");
    setPassword("");
    setConfirmPassword("");
    resetRegisterOtp();
    resetForgotFlow();
  }, [mode]);

  useEffect(() => {
    if (providerStatus !== "ready") return;

    if (!canUseEmailOtp && canUsePhoneOtp) {
      setRegisterOtpType("phone");
      setForgotOtpType("phone");
      setPhone((current) => withVietnamPhonePrefix(current));
      setForgotOtpValue((current) => withVietnamPhonePrefix(current));
    }
  }, [canUseEmailOtp, canUsePhoneOtp, providerStatus]);

  const heading = useMemo(() => {
    if (flow === "forgot") {
      const shared = {
        eyebrow: "Account recovery",
        button: "Continue",
      };

      if (forgotStep === "verify") {
        return {
          ...shared,
          title: "Verify your account",
          description: "Enter the OTP we sent to your email or phone.",
        };
      }

      if (forgotStep === "password") {
        return {
          ...shared,
          title: "Set a new password",
          description:
            "Choose a new password for your CarVista account before returning to sign in.",
        };
      }

      if (forgotStep === "success") {
        return {
          ...shared,
          title: "Password updated",
          description:
            "Your password has been reset successfully. You can now sign in.",
        };
      }

      return {
        ...shared,
        title: "Reset your password",
        description:
          "Enter the email or phone number linked to your CarVista account.",
      };
    }

    if (mode === "login") {
      return {
        eyebrow: "CarVista account",
        title: "Welcome back",
        description:
          "Sign in to save favorites, manage listings, and pick up your search right where you left it.",
        button: "Sign in",
      };
    }

    if (registerStep === "verify") {
      return {
        eyebrow: "Join CarVista",
        title: "Verify your contact",
        description: "Enter the one-time code we sent to continue.",
        button: "Verify OTP",
      };
    }

    if (registerStep === "password") {
      return {
        eyebrow: "Join CarVista",
        title: "Set your password",
        description:
          "Your contact is verified. Add your name and secure password to finish.",
        button: "Create account",
      };
    }

    return {
      eyebrow: "Join CarVista",
      title: "Create your account",
      description:
        "Choose how you want to verify your account, then we will send a one-time code.",
      button: "Create account",
    };
  }, [flow, forgotStep, mode, registerStep]);

  const socialLabel =
    mode === "login" ? "Or continue with" : "Or create your account with";
  const googleButtonLabel =
    mode === "login" ? "Sign in with Google" : "Continue with Google";
  const facebookButtonLabel =
    mode === "login" ? "Sign in with Facebook" : "Continue with Facebook";
  const fieldClassName =
    "h-12 rounded-[18px] border border-slate-200/80 bg-white/88 px-4 text-slate-800 placeholder:text-slate-400 focus-visible:border-cars-accent focus-visible:ring-cars-accent/35 dark:border-white/10 dark:bg-white/5 dark:text-primary-foreground dark:placeholder:text-primary-foreground/34 sm:h-14";
  const linkButtonClassName =
    "text-sm font-semibold text-cars-primary transition-colors hover:text-cars-accent dark:text-cars-accent";
  const mutedLinkButtonClassName =
    "text-sm font-semibold text-slate-500 transition-colors hover:text-cars-primary dark:text-primary-foreground/62 dark:hover:text-cars-accent";

  async function finishAuth() {
    if (onSuccess) {
      onSuccess();
      return;
    }

    router.replace(next || "/garage");
  }

  function handleModeSwitch(nextMode: AuthMode) {
    setMessage("");
    setFlow("auth");
    if (nextMode === "register") {
      setEmail("");
      setPhone(VIETNAM_PHONE_PREFIX);
      resetRegisterOtp();
    }

    if (onModeChange) {
      onModeChange(nextMode);
      return;
    }

    const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
    router.replace(
      nextMode === "login" ? `/login${suffix}` : `/register${suffix}`,
    );
  }

  function setFriendlyError(error: unknown, fallback: string) {
    setTone("error");
    setMessage(error instanceof Error ? error.message : fallback);
  }

  function backToSignIn() {
    setFlow("auth");
    resetForgotFlow();
    setMessage("");
    setTone("info");
  }

  function resetRegisterOtp() {
    setRegisterStep("contact");
    setRegisterOtpCode("");
    setRegisterOtpChallengeId(null);
    setRegisterOtpMasked("");
    setRegisterOtpResendAt(null);
    setRegisterVerificationToken("");
  }

  function resetForgotFlow() {
    setForgotOtpCode("");
    setForgotOtpChallengeId(null);
    setForgotOtpMasked("");
    setForgotOtpResendAt(null);
    setForgotResetToken("");
    setForgotResetComplete(false);
    setNewPassword("");
    setConfirmNewPassword("");
  }

  function requireMatchingPasswords(first: string, second: string) {
    if (first !== second) {
      setTone("error");
      setMessage(
        "Passwords do not match yet. Please re-enter them and try again.",
      );
      return false;
    }

    return true;
  }

  function requireStrongPassword(passwordValue: string) {
    if (!isStrongPassword(passwordValue)) {
      setTone("error");
      setMessage(PASSWORD_REQUIREMENT_TEXT);
      return false;
    }

    return true;
  }

  function getRegisterOtpValue() {
    return registerOtpType === "email" ? email.trim() : normalizeVietnamPhoneInput(phone);
  }

  function getRegisterOtpInputValue() {
    return registerOtpType === "email" ? email : withVietnamPhonePrefix(phone);
  }

  function getForgotOtpValue() {
    return forgotOtpType === "email"
      ? forgotOtpValue.trim()
      : normalizeVietnamPhoneInput(forgotOtpValue);
  }

  function getForgotOtpInputValue() {
    return forgotOtpType === "email"
      ? forgotOtpValue
      : withVietnamPhonePrefix(forgotOtpValue);
  }

  function requireValidPhone(value: string) {
    if (!hasVietnamPhoneSubscriberDigits(value)) {
      setTone("error");
      setMessage("Enter a valid Vietnam phone number, for example +84901234567.");
      return false;
    }

    return true;
  }

  function handleSocialLogin(provider: "google" | "facebook") {
    window.location.assign(authApi.socialStartUrl(provider, next || "/garage"));
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await authApi.login({ email, password });
      setStoredToken(result.token);
      setTone("success");
      setMessage("Signed in successfully.");
      await finishAuth();
    } catch (error) {
      setFriendlyError(error, "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onRegisterOtpRequestSubmit(e: FormEvent) {
    e.preventDefault();
    await requestRegisterOtp();
  }

  async function requestRegisterOtp() {
    const destinationValue = getRegisterOtpValue();
    if (!destinationValue) {
      setTone("error");
      setMessage(
        registerOtpType === "email"
          ? "Enter the email you want to verify."
          : "Enter the phone number you want to verify.",
      );
      return;
    }

    if (registerOtpType === "phone" && !requireValidPhone(destinationValue)) {
      return;
    }

    setLoading(true);
    setMessage("");
    setRegisterVerificationToken("");
    setRegisterOtpCode("");
    if (registerOtpType === "phone") setPhone(destinationValue);

    try {
      const result = await authApi.requestOtp({
        destination_type: registerOtpType,
        destination_value: destinationValue,
        purpose: "register",
      });
      setRegisterOtpChallengeId(result.challenge_id);
      setRegisterOtpMasked(result.masked_destination || "");
      setRegisterOtpResendAt(result.resend_available_at);
      setRegisterStep("verify");
      setTone("success");
      setMessage(
        `Verification code sent${
          result.masked_destination ? ` to ${result.masked_destination}` : ""
        }. It expires in ${otpExpiryLabel}.`,
      );
    } catch (error) {
      setFriendlyError(error, "Could not send the verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function onRegisterOtpVerifySubmit(e: FormEvent) {
    e.preventDefault();

    if (!registerOtpChallengeId) {
      setTone("error");
      setMessage("Please request a verification code first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await authApi.verifyRegistrationOtp({
        challenge_id: registerOtpChallengeId,
        destination_type: registerOtpType,
        destination_value: getRegisterOtpValue(),
        code: registerOtpCode,
      });
      setRegisterVerificationToken(result.registration_token);
      setRegisterOtpMasked(result.masked_destination || registerOtpMasked);
      setRegisterStep("password");
      setTone("success");
      setMessage("Contact verified. Set a password to finish your account.");
    } catch (error) {
      setFriendlyError(error, "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onRegisterSubmit(e: FormEvent) {
    e.preventDefault();

    if (!registerVerificationToken) {
      setTone("error");
      setMessage("Please verify your contact before creating an account.");
      return;
    }

    if (!requireStrongPassword(password)) return;
    if (!requireMatchingPasswords(password, confirmPassword)) return;

    setLoading(true);
    setMessage("");

    try {
      const result = await authApi.register({
        name,
        email: registerOtpType === "email" ? getRegisterOtpValue() : undefined,
        phone: registerOtpType === "phone" ? getRegisterOtpValue() : undefined,
        password,
        registration_token: registerVerificationToken,
      });
      setStoredToken(result.token);
      setTone("success");
      setMessage("Account created successfully.");
      await finishAuth();
    } catch (error) {
      setFriendlyError(error, "Account creation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotOtpRequestSubmit(e: FormEvent) {
    e.preventDefault();
    await requestForgotOtp();
  }

  async function requestForgotOtp() {
    const destinationValue = getForgotOtpValue();
    if (!destinationValue) {
      setTone("error");
      setMessage(
        forgotOtpType === "email"
          ? "Enter the email linked to your account."
          : "Enter the phone number linked to your account.",
      );
      return;
    }

    if (forgotOtpType === "phone" && !requireValidPhone(destinationValue)) {
      return;
    }

    setLoading(true);
    setMessage("");
    if (forgotOtpType === "phone") setForgotOtpValue(destinationValue);

    try {
      const result = await authApi.requestPasswordResetOtp({
        destination_type: forgotOtpType,
        destination_value: destinationValue,
      });
      setForgotOtpChallengeId(result.challenge_id);
      setForgotOtpValue(result.destination_value);
      setForgotOtpMasked(result.masked_destination || "");
      setForgotOtpResendAt(result.resend_available_at);
      setForgotResetToken("");
      setForgotResetComplete(false);
      setTone("info");
      setMessage(result.message || GENERIC_OTP_SENT_MESSAGE);
    } catch (error) {
      setFriendlyError(error, "Could not send the verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotOtpVerifySubmit(e: FormEvent) {
    e.preventDefault();

    if (!forgotOtpChallengeId) {
      setTone("error");
      setMessage("Please request a verification code first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await authApi.verifyPasswordResetOtp({
        challenge_id: forgotOtpChallengeId,
        destination_type: forgotOtpType,
        destination_value: getForgotOtpValue(),
        code: forgotOtpCode,
      });
      setForgotResetToken(result.reset_token);
      setTone("success");
      setMessage("Code verified. Set a new password to continue.");
    } catch (error) {
      setFriendlyError(error, "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPasswordSubmit(e: FormEvent) {
    e.preventDefault();

    if (!requireStrongPassword(newPassword)) return;
    if (!requireMatchingPasswords(newPassword, confirmNewPassword)) return;

    setLoading(true);
    setMessage("");

    try {
      await authApi.resetPasswordWithOtp({
        reset_token: forgotResetToken,
        new_password: newPassword,
      });
      setTone("success");
      setMessage("");
      setForgotResetToken("");
      setForgotResetComplete(true);
    } catch (error) {
      setFriendlyError(error, "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  function renderPasswordLogin() {
    return (
      <form onSubmit={onPasswordSubmit} className="space-y-4 sm:space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-accent">
            Email
          </label>
          <Input
            className={fieldClassName}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-accent">
            Password
          </label>
          <Input
            className={fieldClassName}
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            type="password"
            value={password}
          />
          <button
            className={`mt-2 ${linkButtonClassName}`}
            onClick={() => {
              setFlow("forgot");
              resetForgotFlow();
              setMessage("");
            }}
            type="button"
          >
            Forgot password?
          </button>
        </div>

        <Button
          className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
          disabled={loading}
          type="submit"
        >
          {loading ? "Signing in..." : heading.button}
        </Button>
      </form>
    );
  }

  function renderRegister() {
    if (registerStep === "verify") {
      return (
        <form
          className="space-y-4 rounded-[24px] border border-cars-primary/12 bg-white/58 p-4 shadow-[0_14px_38px_rgba(15,45,98,0.08)] dark:border-white/10 dark:bg-white/[0.03] sm:p-5"
          onSubmit={onRegisterOtpVerifySubmit}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-primary dark:text-cars-accent">
              OTP verification
            </p>
            <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/64">
              {registerOtpMasked
                ? `Enter the code sent to ${registerOtpMasked}.`
                : "Enter the code we sent."}{" "}
              It expires in {otpExpiryLabel}.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-cars-accent">
              Verification code
            </label>
            <Input
              className={fieldClassName}
              inputMode="numeric"
              onChange={(e) => setRegisterOtpCode(e.target.value)}
              placeholder="Enter OTP"
              required
              value={registerOtpCode}
            />
          </div>

          <Button
            className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
            disabled={loading}
            type="submit"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500 dark:text-primary-foreground/54">
              {registerResendSeconds > 0
                ? `Request another code in ${formatCountdown(registerResendSeconds)}.`
                : "You can request another code now."}
            </p>
            <div className="flex gap-4">
              <button
                className={linkButtonClassName}
                disabled={loading || registerResendSeconds > 0}
                onClick={() => void requestRegisterOtp()}
                type="button"
              >
                Resend OTP
              </button>
              <button
                className={mutedLinkButtonClassName}
                onClick={resetRegisterOtp}
                type="button"
              >
                Back
              </button>
            </div>
          </div>
        </form>
      );
    }

    if (registerStep === "password") {
      return (
        <form
          className="space-y-4 rounded-[24px] border border-cars-primary/12 bg-white/58 p-4 shadow-[0_14px_38px_rgba(15,45,98,0.08)] dark:border-white/10 dark:bg-white/[0.03] sm:p-5"
          onSubmit={onRegisterSubmit}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-primary dark:text-cars-accent">
              Verified
            </p>
            <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/64">
              {registerOtpMasked || getRegisterOtpValue()} is verified.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-cars-accent">
              Name
            </label>
            <Input
              className={fieldClassName}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should we address you?"
              required
              value={name}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-cars-accent">
              Password
            </label>
            <Input
              className={fieldClassName}
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              type="password"
              value={password}
            />
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-primary-foreground/54">
              {PASSWORD_REQUIREMENT_TEXT}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-cars-accent">
              Confirm password
            </label>
            <Input
              className={fieldClassName}
              minLength={8}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              type="password"
              value={confirmPassword}
            />
          </div>

          <Button
            className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
            disabled={loading}
            type="submit"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>

          <button
            className={mutedLinkButtonClassName}
            onClick={resetRegisterOtp}
            type="button"
          >
            Start over
          </button>
        </form>
      );
    }

    return (
      <form
        autoComplete="off"
        className="space-y-4 sm:space-y-5"
        onSubmit={onRegisterOtpRequestSubmit}
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-accent">
            Verify by
          </label>
          <DestinationToggle
            canUseEmail={canUseEmailOtp}
            canUsePhone={canUsePhoneOtp}
            onChange={(value) => {
              setRegisterOtpType(value);
              if (value === "phone") {
                setPhone((current) => withVietnamPhonePrefix(current));
              }
              resetRegisterOtp();
            }}
            value={registerOtpType}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-cars-accent">
            {registerOtpType === "email" ? "Email address" : "Phone number"}
          </label>
          <Input
            autoComplete="new-password"
            className={fieldClassName}
            name="carvista-register-contact"
            onBlur={() => {
              if (registerOtpType === "phone") {
                setPhone(normalizeVietnamPhoneInput(phone) || VIETNAM_PHONE_PREFIX);
              }
            }}
            onChange={(e) => {
              if (registerOtpType === "email") {
                setEmail(e.target.value);
              } else {
                setPhone(e.target.value);
              }
              resetRegisterOtp();
            }}
            placeholder={registerOtpType === "email" ? "you@example.com" : "+84..."}
            required
            type={registerOtpType === "email" ? "email" : "tel"}
            value={getRegisterOtpInputValue()}
          />
        </div>

        <Button
          className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
          disabled={loading || !canUseOtp}
          type="submit"
        >
          {loading ? "Sending OTP..." : "Send OTP"}
        </Button>
      </form>
    );
  }

  function renderForgotPassword() {
    if (forgotStep === "success") {
      return (
        <div className="space-y-5 rounded-[24px] border border-emerald-200/80 bg-emerald-50/72 p-5 text-slate-800 shadow-[0_14px_38px_rgba(15,45,98,0.08)] dark:border-emerald-400/20 dark:bg-emerald-400/8 dark:text-primary-foreground">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              Success
            </p>
            <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/68">
              Your password has been reset successfully. You can now sign in.
            </p>
          </div>
          <Button
            className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
            onClick={backToSignIn}
            type="button"
          >
            Back to sign in
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {forgotStep === "request" ? (
          <form
            onSubmit={onForgotOtpRequestSubmit}
            className="space-y-4 rounded-[24px] border border-cars-primary/12 bg-white/58 p-4 shadow-[0_14px_38px_rgba(15,45,98,0.08)] dark:border-white/10 dark:bg-white/[0.03] sm:p-5"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-primary dark:text-cars-accent">
                Find your account
              </p>
              <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/64">
                We will send a one-time code if the account exists.
              </p>
            </div>
            <DestinationToggle
              canUseEmail={canUseEmailOtp}
              canUsePhone={canUsePhoneOtp}
              onChange={(value) => {
                setForgotOtpType(value);
                setForgotOtpValue(value === "phone" ? VIETNAM_PHONE_PREFIX : "");
                resetForgotFlow();
              }}
              value={forgotOtpType}
            />
            <div>
              <label className="mb-2 block text-sm font-semibold text-cars-accent">
                {forgotOtpType === "email" ? "Email address" : "Phone number"}
              </label>
              <Input
                className={fieldClassName}
                onBlur={() => {
                  if (forgotOtpType === "phone") {
                    setForgotOtpValue(
                      normalizeVietnamPhoneInput(forgotOtpValue) || VIETNAM_PHONE_PREFIX,
                    );
                  }
                }}
                onChange={(e) => {
                  setForgotOtpValue(e.target.value);
                  resetForgotFlow();
                }}
                placeholder={
                  forgotOtpType === "email" ? "you@example.com" : "+84..."
                }
                required
                type={forgotOtpType === "email" ? "email" : "tel"}
                value={getForgotOtpInputValue()}
              />
            </div>
            <Button
              className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
              disabled={loading || !canUseOtp}
              type="submit"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </Button>
          </form>
        ) : null}

        {forgotStep === "verify" ? (
          <form
            onSubmit={onForgotOtpVerifySubmit}
            className="space-y-4 rounded-[24px] border border-cars-primary/12 bg-white/58 p-4 shadow-[0_14px_38px_rgba(15,45,98,0.08)] dark:border-white/10 dark:bg-white/[0.03] sm:p-5"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-primary dark:text-cars-accent">
                Verify OTP
              </p>
              <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/64">
                {forgotOtpMasked
                  ? `Enter the OTP sent to ${forgotOtpMasked}.`
                  : "Enter the OTP sent to your email or phone."}{" "}
                It expires in {otpExpiryLabel}.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-cars-accent">
                OTP
              </label>
              <Input
                className={fieldClassName}
                inputMode="numeric"
                onChange={(e) => setForgotOtpCode(e.target.value)}
                placeholder="Enter OTP"
                required
                value={forgotOtpCode}
              />
            </div>
            <Button
              className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
              disabled={loading}
              type="submit"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>
          </form>
        ) : null}

        {forgotStep === "password" ? (
          <form
            onSubmit={onForgotPasswordSubmit}
            className="space-y-4 rounded-[24px] border border-cars-primary/12 bg-white/58 p-4 shadow-[0_14px_38px_rgba(15,45,98,0.08)] dark:border-white/10 dark:bg-white/[0.03] sm:p-5"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-primary dark:text-cars-accent">
                New credentials
              </p>
              <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/64">
                {PASSWORD_REQUIREMENT_TEXT}
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-cars-accent">
                New password
              </label>
              <Input
                className={fieldClassName}
                minLength={8}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a new password"
                required
                type="password"
                value={newPassword}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-cars-accent">
                Confirm new password
              </label>
              <Input
                className={fieldClassName}
                minLength={8}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
                type="password"
                value={confirmNewPassword}
              />
            </div>
            <Button
              className="editorial-button h-11 w-full rounded-full text-sm font-semibold text-white hover:brightness-105 dark:text-slate-950 sm:h-12"
              disabled={loading}
              type="submit"
            >
              {loading ? "Updating password..." : "Reset password"}
            </Button>
          </form>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {forgotStep === "verify" && forgotOtpResendAt ? (
            <p className="text-xs leading-5 text-slate-500 dark:text-primary-foreground/54 sm:max-w-[55%]">
              {forgotResendSeconds > 0
                ? `Request another OTP in ${formatCountdown(forgotResendSeconds)}.`
                : "You can request another OTP now."}
            </p>
          ) : null}
          {forgotStep === "verify" ? (
            <button
              className={linkButtonClassName}
              disabled={loading || forgotResendSeconds > 0}
              onClick={() => void requestForgotOtp()}
              type="button"
            >
              Resend OTP
            </button>
          ) : null}
          {forgotStep === "password" ? (
            <button
              className={mutedLinkButtonClassName}
              onClick={() => {
                setForgotResetToken("");
                setForgotOtpCode("");
                setMessage("");
                setTone("info");
              }}
              type="button"
            >
              Back
            </button>
          ) : null}
          {forgotStep === "verify" ? (
            <button
              className={mutedLinkButtonClassName}
              onClick={() => {
                setForgotOtpChallengeId(null);
                setForgotOtpCode("");
                setForgotOtpMasked("");
                setForgotOtpResendAt(null);
                setMessage("");
                setTone("info");
              }}
              type="button"
            >
              Back
            </button>
          ) : null}
          {forgotStep === "request" ? (
            <button
              className={mutedLinkButtonClassName}
              onClick={backToSignIn}
              type="button"
            >
              Back to sign in
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderSidePanel() {
    if (isRecoveryFlow || isRegisterVerificationFlow) {
      return (
        <aside className="space-y-4 rounded-[28px] border border-cars-primary/14 bg-[linear-gradient(180deg,rgba(236,244,255,0.98),rgba(223,235,255,0.96))] px-4 py-4 text-slate-800 shadow-[0_18px_48px_rgba(15,45,98,0.08)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(24,30,38,0.96),rgba(16,20,19,0.96))] dark:text-primary-foreground dark:shadow-none sm:px-5 sm:py-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cars-primary dark:text-cars-accent">
              {isRecoveryFlow ? "Security check" : "Almost there"}
            </p>
            <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/72">
              {isRecoveryFlow
                ? "Password reset uses a short-lived OTP and never confirms whether an email or phone number exists."
                : "Finish this verification step before creating your CarVista password."}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/62 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_12px_30px_rgba(15,45,98,0.06)] dark:border-white/10 dark:bg-white/[0.04] dark:text-primary-foreground/68">
            {isRecoveryFlow
              ? "Keep this window open until you finish setting the new password. Request a new OTP if the code expires."
              : "Keep this window open after the OTP is verified. You will set your password on the next step."}
          </div>
        </aside>
      );
    }

    return (
      <aside className="space-y-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(236,244,255,0.98),rgba(223,235,255,0.96))] px-4 py-4 text-slate-800 shadow-[0_18px_48px_rgba(15,45,98,0.08)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(24,30,38,0.96),rgba(16,20,19,0.96))] dark:text-primary-foreground dark:shadow-none sm:px-5 sm:py-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-primary-foreground/50">
            {socialLabel}
          </p>
          <p className="text-sm leading-6 text-slate-600 dark:text-primary-foreground/72">
            Use a trusted account and we will connect it safely to your CarVista
            profile.
          </p>
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
            We could not confirm provider availability just now, but you can
            still try a social sign-in.
          </p>
        ) : null}
        {noSocialProvidersAvailable ? (
          <p className="text-xs leading-5 text-slate-500 dark:text-primary-foreground/54">
            Social login buttons will appear here once the provider keys are
            configured.
          </p>
        ) : null}
      </aside>
    );
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
        {!isRecoveryFlow && !isRegisterVerificationFlow ? (
          <div className="flex rounded-full border border-slate-200/80 bg-white/72 p-1 shadow-[0_10px_30px_rgba(15,45,98,0.08)] dark:border-white/8 dark:bg-white/5 dark:shadow-none lg:max-w-[380px]">
            <button
              className={
                mode === "login"
                  ? "editorial-button flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,45,98,0.18)] dark:text-slate-950"
                  : "flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-white/62 dark:hover:text-white/82"
              }
              onClick={() => handleModeSwitch("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={
                mode === "register"
                  ? "editorial-button flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,45,98,0.18)] dark:text-slate-950"
                  : "flex min-h-11 flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-white/62 dark:hover:text-white/82"
              }
              onClick={() => handleModeSwitch("register")}
              type="button"
            >
              Register
            </button>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:gap-6">
          <div className="space-y-4 sm:space-y-5">
            {flow === "forgot"
              ? renderForgotPassword()
              : isRegister
                ? renderRegister()
                : renderPasswordLogin()}

            {message ? (
              <StatusBanner tone={tone}>{message}</StatusBanner>
            ) : null}
          </div>

          {renderSidePanel()}
        </div>
      </div>
    </section>
  );
}
