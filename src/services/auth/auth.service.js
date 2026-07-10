import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AuthEventLogService } from "./auth-event-log.service.js";
import { IdentityResolutionService } from "./identity-resolution.service.js";
import { OtpAuthService } from "./otp-auth.service.js";
import { OtpDeliveryService } from "./otp-delivery.service.js";
import { PasswordAuthService } from "./password-auth.service.js";
import { RateLimitService } from "./rate-limit.service.js";
import { SocialAuthService } from "./social-auth.service.js";
import { TokenService } from "./token.service.js";
import { createNotificationService } from "../notifications/notification.service.js";
import {
  normalizePhoneNumber,
  normalizePhoneNumberOrNull,
} from "../shared/phone-normalization.service.js";
import { ensureUserProfileSchema } from "../users/user-profile-schema.service.js";

export class AuthService {
  constructor(ctx, { notificationService } = {}) {
    this.ctx = ctx;
    this.tokenService = new TokenService();
    this.auditLogger = new AuthEventLogService(ctx);
    this.identityResolutionService = new IdentityResolutionService(ctx);
    this.rateLimitService = new RateLimitService(ctx);
    this.otpDeliveryService = new OtpDeliveryService();
    this.passwordAuth = new PasswordAuthService(ctx, {
      tokenService: this.tokenService,
    });
    this.otpAuth = new OtpAuthService(ctx, {
      tokenService: this.tokenService,
      identityResolutionService: this.identityResolutionService,
      auditLogger: this.auditLogger,
      otpDeliveryService: this.otpDeliveryService,
      rateLimitService: this.rateLimitService,
    });
    this.socialAuth = new SocialAuthService(ctx, {
      tokenService: this.tokenService,
      identityResolutionService: this.identityResolutionService,
      auditLogger: this.auditLogger,
    });
    this.notificationService = notificationService || createNotificationService(ctx);
  }

  async registerWithPassword(payload, requestMeta = {}) {
    const verifiedContact = payload.registrationToken
      ? verifyRegistrationToken(payload.registrationToken)
      : await this.otpAuth.consumeOtpCode({
          challengeId: payload.otpChallengeId,
          destinationType: payload.otpDestinationType,
          destinationValue: payload.otpDestinationValue,
          code: payload.otpCode,
          expectedPurpose: "register",
          ipAddress: requestMeta.ipAddress || null,
        });

    const registrationPayload = buildRegistrationPayload(payload, verifiedContact);

    assertRegistrationOtpMatchesProfile(registrationPayload, verifiedContact);
    await this.passwordAuth.assertCanRegister({
      email: registrationPayload.email,
      phone: registrationPayload.phone,
    });

    const result = await this.passwordAuth.register(registrationPayload);
    await this.auditLogger.log({
      userId: result.user.user_id,
      eventType: "password_register_success",
      authMethod: "password",
      destinationType: verifiedContact.destinationType,
      destinationValue: verifiedContact.normalizedValue,
      success: true,
      ipAddress: requestMeta.ipAddress || null,
    });
    await this.sendWelcomeEmail(result.user);
    return result;
  }

  async sendWelcomeEmail(user) {
    try {
      await this.notificationService.sendWelcomeEmail({ user });
    } catch (error) {
      console.warn("[auth] welcome email failed", {
        userId: user?.user_id ?? null,
        message: error?.message || String(error),
      });
    }
  }

  async verifyRegistrationOtp(payload, requestMeta = {}) {
    const otp = await this.otpAuth.consumeOtpCode({
      challengeId: payload.challengeId,
      destinationType: payload.destinationType,
      destinationValue: payload.destinationValue,
      code: payload.code,
      expectedPurpose: "register",
      ipAddress: requestMeta.ipAddress || null,
    });

    const registrationToken = jwt.sign(
      {
        purpose: "registration_verified",
        destinationType: otp.destinationType,
        destinationValue: otp.normalizedValue,
      },
      env.auth.jwtSecret,
      { expiresIn: "10m" }
    );

    return {
      registrationToken,
      destinationType: otp.destinationType,
      destinationValue: otp.normalizedValue,
      maskedDestination: maskRegistrationDestination(
        otp.destinationType,
        otp.normalizedValue
      ),
    };
  }

  async loginWithPassword(payload, requestMeta = {}) {
    const result = await this.passwordAuth.login(payload);
    await this.auditLogger.log({
      userId: result.user.user_id,
      eventType: "password_login_success",
      authMethod: "password",
      destinationType: "email",
      destinationValue: result.user.email,
      success: true,
      ipAddress: requestMeta.ipAddress || null,
    });
    return result;
  }

  requestOtp(payload) {
    return this.otpAuth.requestOtp(payload);
  }

  verifyOtp(payload) {
    return this.otpAuth.verifyOtp(payload);
  }

  requestPasswordResetOtp(payload) {
    return this.otpAuth.requestOtp({
      ...payload,
      purpose: "verify_contact",
    });
  }

  async verifyPasswordResetOtp(payload, requestMeta = {}) {
    const otp = await this.otpAuth.consumeOtpCode({
      challengeId: payload.challengeId,
      destinationType: payload.destinationType,
      destinationValue: payload.destinationValue,
      code: payload.code,
      expectedPurpose: "verify_contact",
      ipAddress: requestMeta.ipAddress || null,
    });

    const user = await this.passwordAuth.findByContact({
      destinationType: otp.destinationType,
      destinationValue: otp.normalizedValue,
    });

    if (!user) {
      throw {
        status: 400,
        safe: true,
        message: "That verification code is invalid or has expired.",
      };
    }

    const resetToken = jwt.sign(
      {
        purpose: "password_reset",
        userId: user.user_id,
        destinationType: otp.destinationType,
        destinationValue: otp.normalizedValue,
      },
      env.auth.jwtSecret,
      { expiresIn: "10m" }
    );

    await this.auditLogger.log({
      userId: user.user_id,
      eventType: "password_reset_otp_success",
      authMethod: `${otp.destinationType}_otp`,
      destinationType: otp.destinationType,
      destinationValue: otp.normalizedValue,
      success: true,
      ipAddress: requestMeta.ipAddress || null,
      metadata: {
        challengeId: payload.challengeId,
      },
    });

    return { resetToken };
  }

  async resetPasswordWithToken(payload, requestMeta = {}) {
    let tokenPayload;
    try {
      tokenPayload = jwt.verify(payload.resetToken, env.auth.jwtSecret);
    } catch {
      throw {
        status: 400,
        safe: true,
        message: "That password reset session has expired. Please request a new code.",
      };
    }

    if (tokenPayload?.purpose !== "password_reset" || !tokenPayload.userId) {
      throw {
        status: 400,
        safe: true,
        message: "That password reset session has expired. Please request a new code.",
      };
    }

    const user = await this.ctx.models.Users.findByPk(tokenPayload.userId);
    if (!user) {
      throw {
        status: 400,
        safe: true,
        message: "That password reset session has expired. Please request a new code.",
      };
    }

    const result = await this.passwordAuth.updatePassword(user, payload.newPassword);

    await this.auditLogger.log({
      userId: result.user.user_id,
      eventType: "password_reset_success",
      authMethod: "password_reset_token",
      destinationType: tokenPayload.destinationType || "email",
      destinationValue: tokenPayload.destinationValue || result.user.email,
      success: true,
      ipAddress: requestMeta.ipAddress || null,
    });

    return result;
  }

  buildSocialStartUrl(providerName, next) {
    return this.socialAuth.buildStartUrl(providerName, next);
  }

  handleSocialCallback(providerName, payload) {
    return this.socialAuth.handleCallback(providerName, payload);
  }

  async getCurrentUser(userId) {
    await ensureUserProfileSchema(this.ctx);
    return this.ctx.models.Users.findByPk(userId, {
      attributes: [
        "user_id",
        "name",
        "email",
        "phone",
        "preferred_contact_method",
        "role",
      ],
    });
  }

  async updateCurrentUserProfile(userId, payload) {
    await ensureUserProfileSchema(this.ctx);
    const { Users } = this.ctx.models;

    const user = await Users.findByPk(userId);
    if (!user) {
      throw { status: 404, safe: true, message: "User not found." };
    }

    const nextEmail = payload.email?.trim().toLowerCase() || user.email;
    if (nextEmail !== user.email) {
      const existingUser = await Users.findOne({
        where: { email: nextEmail },
        attributes: ["user_id"],
      });

      if (existingUser && Number(existingUser.user_id) !== Number(userId)) {
        throw {
          status: 409,
          safe: true,
          message: "That email address is already in use by another account.",
        };
      }
    }

    const nextPhone =
      payload.phone === undefined
        ? user.phone
        : normalizePhoneNumberOrNull(payload.phone);

    await user.update({
      name: payload.name?.trim() || user.name,
      email: nextEmail,
      phone: nextPhone,
      preferred_contact_method:
        payload.preferredContactMethod === undefined
          ? user.preferred_contact_method
          : payload.preferredContactMethod || null,
    });

    return this.getCurrentUser(userId);
  }
}

export function createAuthService(ctx) {
  return new AuthService(ctx);
}

function assertRegistrationOtpMatchesProfile(payload, otp) {
  const email = String(payload.email || "").trim().toLowerCase();
  const phone = normalizePhoneNumber(payload.phone);

  if (otp.destinationType === "email" && otp.normalizedValue !== email) {
    throw {
      status: 400,
      safe: true,
      message: "The verification code does not match this registration email.",
    };
  }

  if (otp.destinationType === "phone" && otp.normalizedValue !== phone) {
    throw {
      status: 400,
      safe: true,
      message: "The verification code does not match this registration phone number.",
    };
  }
}

function buildRegistrationPayload(payload, verifiedContact) {
  return {
    name: payload.name,
    email:
      verifiedContact.destinationType === "email"
        ? verifiedContact.normalizedValue
        : payload.email,
    phone:
      verifiedContact.destinationType === "phone"
        ? verifiedContact.normalizedValue
        : payload.phone,
    password: payload.password,
  };
}

function verifyRegistrationToken(token) {
  let tokenPayload;
  try {
    tokenPayload = jwt.verify(token, env.auth.jwtSecret);
  } catch {
    throw {
      status: 400,
      safe: true,
      message: "That registration verification has expired. Please request a new code.",
    };
  }

  if (
    tokenPayload?.purpose !== "registration_verified" ||
    !["email", "phone"].includes(tokenPayload.destinationType) ||
    !tokenPayload.destinationValue
  ) {
    throw {
      status: 400,
      safe: true,
      message: "That registration verification has expired. Please request a new code.",
    };
  }

  return {
    destinationType: tokenPayload.destinationType,
    normalizedValue: String(tokenPayload.destinationValue),
  };
}

function maskRegistrationDestination(destinationType, destinationValue) {
  if (destinationType === "email") {
    const [localPart, domain] = String(destinationValue || "").split("@");
    if (!domain) return "*****";
    return `${localPart.slice(0, Math.min(2, localPart.length))}*****@${domain}`;
  }

  const digits = String(destinationValue || "").replace(/\D/g, "");
  return digits.length > 4 ? `+*****${digits.slice(-4)}` : "*****";
}
