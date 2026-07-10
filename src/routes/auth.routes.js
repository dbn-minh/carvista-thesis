import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middlewares/auth.js";
import { authLimiter } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.js";
import { createAuthService } from "../services/auth/auth.service.js";

export const authRoutes = Router();

const RegisterSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(6).max(30).optional(),
    password: z.string().min(1),
    registration_token: z.string().min(10).optional(),
    otp_challenge_id: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? undefined : Number(value)),
      z.number().int().positive().optional()
    ),
    otp_destination_type: z.enum(["email", "phone"]).optional(),
    otp_destination_value: z.string().min(3).optional(),
    otp_code: z.string().min(4).max(10).optional(),
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

const RegistrationOtpVerifySchema = z.object({
  body: z.object({
    challenge_id: z.preprocess((value) => Number(value), z.number().int().positive()),
    destination_type: z.enum(["email", "phone"]),
    destination_value: z.string().min(3),
    code: z.string().min(4).max(10),
  }),
  query: z.any(),
  params: z.any(),
});

const PasswordResetRequestSchema = z.object({
  body: z.object({
    destination_type: z.enum(["email", "phone"]),
    destination_value: z.string().min(3),
  }),
  query: z.any(),
  params: z.any(),
});

const PasswordResetVerifySchema = z.object({
  body: z.object({
    challenge_id: z.preprocess((value) => Number(value), z.number().int().positive()),
    destination_type: z.enum(["email", "phone"]),
    destination_value: z.string().min(3),
    code: z.string().min(4).max(10),
  }),
  query: z.any(),
  params: z.any(),
});

const PasswordResetSchema = z.object({
  body: z.object({
    reset_token: z.string().min(10),
    new_password: z.string().min(6),
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
  authLimiter,
  validate(RegisterSchema),
  async (req, res, next) => {
    try {
      const authService = createAuthService(req.ctx);
      const result = await authService.registerWithPassword(
        {
          name: req.validated.body.name,
          email: req.validated.body.email,
          phone: req.validated.body.phone,
          password: req.validated.body.password,
          registrationToken: req.validated.body.registration_token,
          otpChallengeId: req.validated.body.otp_challenge_id,
          otpDestinationType: req.validated.body.otp_destination_type,
          otpDestinationValue: req.validated.body.otp_destination_value,
          otpCode: req.validated.body.otp_code,
        },
        {
          ipAddress: req.ip,
        }
      );

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
  authLimiter,
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

authRoutes.post("/auth/otp/request", authLimiter, validate(OtpRequestSchema), async (req, res, next) => {
  try {
    const authService = createAuthService(req.ctx);
    const purpose = req.validated.body.purpose || "login";
    const result = await authService.requestOtp({
      destinationType: req.validated.body.destination_type,
      destinationValue: req.validated.body.destination_value,
      purpose,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || null,
    });

    res.status(202).json({
      ...result,
      message:
        purpose === "register"
          ? "A verification code has been sent."
          : "If the account exists, an OTP has been sent.",
    });
  } catch (e) {
    next(e);
  }
});

authRoutes.post("/auth/otp/verify", authLimiter, validate(OtpVerifySchema), async (req, res, next) => {
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

authRoutes.post(
  "/auth/password/forgot/request",
  authLimiter,
  validate(PasswordResetRequestSchema),
  async (req, res, next) => {
    try {
      const authService = createAuthService(req.ctx);
      const result = await authService.requestPasswordResetOtp({
        destinationType: req.validated.body.destination_type,
        destinationValue: req.validated.body.destination_value,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
      });

      res.status(202).json({
        ...result,
        message: "If the account exists, an OTP has been sent.",
      });
    } catch (e) {
      next(e);
    }
  }
);

authRoutes.post(
  "/auth/register/otp/verify",
  authLimiter,
  validate(RegistrationOtpVerifySchema),
  async (req, res, next) => {
    try {
      const authService = createAuthService(req.ctx);
      const result = await authService.verifyRegistrationOtp(
        {
          challengeId: req.validated.body.challenge_id,
          destinationType: req.validated.body.destination_type,
          destinationValue: req.validated.body.destination_value,
          code: req.validated.body.code,
        },
        {
          ipAddress: req.ip,
        }
      );

      res.json({
        registration_token: result.registrationToken,
        destination_type: result.destinationType,
        destination_value: result.destinationValue,
        masked_destination: result.maskedDestination,
      });
    } catch (e) {
      next(e);
    }
  }
);

authRoutes.post(
  "/auth/password/forgot/verify",
  authLimiter,
  validate(PasswordResetVerifySchema),
  async (req, res, next) => {
    try {
      const authService = createAuthService(req.ctx);
      const result = await authService.verifyPasswordResetOtp(
        {
          challengeId: req.validated.body.challenge_id,
          destinationType: req.validated.body.destination_type,
          destinationValue: req.validated.body.destination_value,
          code: req.validated.body.code,
        },
        {
          ipAddress: req.ip,
        }
      );

      res.json({
        reset_token: result.resetToken,
      });
    } catch (e) {
      next(e);
    }
  }
);

authRoutes.post(
  "/auth/password/forgot/reset",
  authLimiter,
  validate(PasswordResetSchema),
  async (req, res, next) => {
    try {
      const authService = createAuthService(req.ctx);
      const result = await authService.resetPasswordWithToken(
        {
          resetToken: req.validated.body.reset_token,
          newPassword: req.validated.body.new_password,
        },
        {
          ipAddress: req.ip,
        }
      );

      res.json({
        token: result.token,
        user: sanitizeUser(result.user),
      });
    } catch (e) {
      next(e);
    }
  }
);

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
