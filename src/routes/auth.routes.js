import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { createAuthService } from "../services/auth/auth.service.js";

export const authRoutes = Router();

const RegisterSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    password: z.string().min(6),
  }),
  query: z.any(),
  params: z.any(),
});

const LoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  query: z.any(),
  params: z.any(),
});

const OtpRequestSchema = z.object({
  body: z.object({
    destination_type: z.enum(["email", "phone"]),
    destination_value: z.string().min(3),
    purpose: z.enum(["login", "register", "verify_contact", "passwordless_signin"]).optional(),
  }),
  query: z.any(),
  params: z.any(),
});

const OtpVerifySchema = z.object({
  body: z.object({
    challenge_id: z.preprocess((value) => Number(value), z.number().int().positive()),
    destination_type: z.enum(["email", "phone"]),
    destination_value: z.string().min(3),
    code: z.string().min(4).max(10),
    profile_name: z.string().min(1).optional(),
  }),
  query: z.any(),
  params: z.any(),
});

const SocialProviderParamsSchema = z.object({
  body: z.any(),
  query: z.object({
    next: z.string().optional(),
  }),
  params: z.object({
    provider: z.enum(["google", "facebook"]),
  }),
});

const UpdateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(6).max(30).optional(),
    preferred_contact_method: z
      .enum(["phone", "email", "phone_or_email"])
      .optional(),
  }),
  query: z.any(),
  params: z.any(),
});

authRoutes.post(
  ["/auth/register", "/auth/password/register"],
  validate(RegisterSchema),
  async (req, res, next) => {
    try {
      const authService = createAuthService(req.ctx);
      const result = await authService.registerWithPassword(req.validated.body, {
        ipAddress: req.ip,
      });

      res.status(201).json({
        user_id: result.user.user_id,
        email: result.user.email,
        token: result.token,
        user: sanitizeUser(result.user),
      });
    } catch (e) {
      next(e);
    }
  }
);

authRoutes.post(
  ["/auth/login", "/auth/password/login"],
  validate(LoginSchema),
  async (req, res, next) => {
    try {
      const authService = createAuthService(req.ctx);
      const result = await authService.loginWithPassword(req.validated.body, {
        ipAddress: req.ip,
      });

      res.json({
        token: result.token,
        user: sanitizeUser(result.user),
      });
    } catch (e) {
      next(e);
    }
  }
);

authRoutes.post("/auth/otp/request", validate(OtpRequestSchema), async (req, res, next) => {
  try {
    const authService = createAuthService(req.ctx);
    const result = await authService.requestOtp({
      destinationType: req.validated.body.destination_type,
      destinationValue: req.validated.body.destination_value,
      purpose: req.validated.body.purpose || "login",
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || null,
    });

    res.status(202).json(result);
  } catch (e) {
    next(e);
  }
});

authRoutes.post("/auth/otp/verify", validate(OtpVerifySchema), async (req, res, next) => {
  try {
    const authService = createAuthService(req.ctx);
    const result = await authService.verifyOtp({
      challengeId: req.validated.body.challenge_id,
      destinationType: req.validated.body.destination_type,
      destinationValue: req.validated.body.destination_value,
      code: req.validated.body.code,
      profileName: req.validated.body.profile_name,
      ipAddress: req.ip,
    });

    res.json({
      token: result.token,
      user: sanitizeUser(result.user),
      user_created: result.user_created,
    });
  } catch (e) {
    next(e);
  }
});

authRoutes.get("/auth/providers", (_req, res) => {
  res.json({
    otp: {
      email: true,
      phone: true,
      expires_in_minutes: env.auth.otpExpiresInMinutes,
      resend_cooldown_seconds: env.auth.otpResendCooldownSeconds,
    },
    social: {
      google: Boolean(env.auth.social.google.clientId && env.auth.social.google.clientSecret),
      facebook: Boolean(
        env.auth.social.facebook.appId && env.auth.social.facebook.appSecret
      ),
    },
  });
});

authRoutes.get(
  "/auth/social/:provider/start",
  validate(SocialProviderParamsSchema),
  async (req, res, next) => {
    try {
      const authService = createAuthService(req.ctx);
      const nextPath = sanitizeNext(req.validated.query.next);
      const authorizationUrl = authService.buildSocialStartUrl(
        req.validated.params.provider,
        nextPath
      );
      res.redirect(authorizationUrl);
    } catch (e) {
      next(e);
    }
  }
);

authRoutes.get("/auth/social/:provider/callback", async (req, res) => {
  const provider = req.params.provider;
  const authService = createAuthService(req.ctx);

  try {
    const result = await authService.handleSocialCallback(provider, {
      code: req.query.code,
      state: req.query.state,
      error: req.query.error,
      errorDescription: req.query.error_description,
      ipAddress: req.ip,
    });
    return res.redirect(result.redirectUrl);
  } catch (error) {
    const safeMessage =
      error?.safe || error?.status && error.status < 500
        ? error.message
        : "Social login could not be completed right now.";
    return res.redirect(buildSocialErrorRedirect(provider, safeMessage));
  }
});

authRoutes.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const authService = createAuthService(req.ctx);
    const user = await authService.getCurrentUser(req.user.userId);
    res.json({ user: sanitizeUser(user) });
  } catch (e) {
    next(e);
  }
});

authRoutes.patch("/auth/me", requireAuth, validate(UpdateProfileSchema), async (req, res, next) => {
  try {
    const authService = createAuthService(req.ctx);
    const user = await authService.updateCurrentUserProfile(req.user.userId, {
      name: req.validated.body.name,
      email: req.validated.body.email,
      phone: req.validated.body.phone,
      preferredContactMethod: req.validated.body.preferred_contact_method,
    });
    res.json({ user: sanitizeUser(user) });
  } catch (e) {
    next(e);
  }
});

function sanitizeUser(user) {
  if (!user) return null;
  return {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    preferred_contact_method: user.preferred_contact_method ?? null,
    role: user.role,
  };
}

function sanitizeNext(nextPath) {
  const candidate = String(nextPath || "").trim();
  if (!candidate.startsWith("/")) return "/garage";
  return candidate;
}

function buildSocialErrorRedirect(provider, message) {
  const hash = new URLSearchParams({
    provider: String(provider || ""),
    error: message || "Social login failed.",
  });
  return `${env.frontendUrl}/auth/social/callback#${hash.toString()}`;
}
