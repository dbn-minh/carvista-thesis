import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { Op } from "sequelize";
import { env } from "../../config/env.js";
import { ensureAuthSchema } from "./auth-schema.service.js";

export class OtpAuthService {
  constructor(
    ctx,
    {
      tokenService,
      identityResolutionService,
      auditLogger,
      otpDeliveryService,
      rateLimitService,
    }
  ) {
    this.ctx = ctx;
    this.tokenService = tokenService;
    this.identityResolutionService = identityResolutionService;
    this.auditLogger = auditLogger;
    this.otpDeliveryService = otpDeliveryService;
    this.rateLimitService = rateLimitService;
  }

  async requestOtp({
    destinationType,
    destinationValue,
    purpose = "login",
    ipAddress,
    userAgent,
  }) {
    await ensureAuthSchema(this.ctx);
    const { OtpChallenges } = this.ctx.models;
    const normalizedValue = normalizeDestination(destinationType, destinationValue);

    await this.rateLimitService.enforceOtpRequestLimit({
      destinationType,
      destinationValue: normalizedValue,
    });

    const existing = await OtpChallenges.findOne({
      where: {
        destination_type: destinationType,
        destination_value: normalizedValue,
        purpose,
        consumed_at: null,
        expires_at: {
          [Op.gt]: new Date(),
        },
      },
      order: [["created_at", "DESC"]],
    });

    if (existing) {
      const secondsSinceLastSend = Math.floor(
        (Date.now() - new Date(existing.last_sent_at).getTime()) / 1000
      );

      if (secondsSinceLastSend < env.auth.otpResendCooldownSeconds) {
        const retryAfterSeconds =
          env.auth.otpResendCooldownSeconds - secondsSinceLastSend;
        throw {
          status: 429,
          safe: true,
          message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
          details: { retry_after_seconds: retryAfterSeconds },
        };
      }

      this.rateLimitService.enforceOtpResendLimit(existing);
    }

    const code = generateOtpCode();
    const otpHash = hashOtp({
      destinationType,
      destinationValue: normalizedValue,
      purpose,
      code,
    });
    const expiresAt = new Date(
      Date.now() + env.auth.otpExpiresInMinutes * 60 * 1000
    );

    let challenge = existing;
    if (challenge) {
      await challenge.update({
        otp_hash: otpHash,
        expires_at: expiresAt,
        last_sent_at: new Date(),
        resend_count: Number(challenge.resend_count || 0) + 1,
        attempt_count: 0,
        metadata_json: JSON.stringify({ ipAddress, userAgent }),
      });
    } else {
      challenge = await OtpChallenges.create({
        destination_type: destinationType,
        destination_value: normalizedValue,
        purpose,
        otp_hash: otpHash,
        expires_at: expiresAt,
        consumed_at: null,
        last_sent_at: new Date(),
        attempt_count: 0,
        resend_count: 0,
        metadata_json: JSON.stringify({ ipAddress, userAgent }),
      });
    }

    await this.otpDeliveryService.sendOtp({
      destinationType,
      destinationValue: normalizedValue,
      code,
      purpose,
    });

    await this.auditLogger.log({
      eventType: "otp_requested",
      authMethod: `${destinationType}_otp`,
      destinationType,
      destinationValue: normalizedValue,
      success: true,
      ipAddress,
      metadata: {
        challengeId: challenge.challenge_id,
        purpose,
        resendCount: challenge.resend_count,
      },
    });

    return {
      challenge_id: challenge.challenge_id,
      destination_type: destinationType,
      destination_value: normalizedValue,
      expires_at: expiresAt.toISOString(),
      resend_available_at: new Date(
        Date.now() + env.auth.otpResendCooldownSeconds * 1000
      ).toISOString(),
    };
  }

  async verifyOtp({
    challengeId,
    destinationType,
    destinationValue,
    code,
    profileName,
    ipAddress,
  }) {
    await ensureAuthSchema(this.ctx);
    const { OtpChallenges } = this.ctx.models;
    const challenge = await OtpChallenges.findByPk(challengeId);

    if (!challenge) {
      throw {
        status: 400,
        safe: true,
        message: "That verification code is invalid or has expired.",
      };
    }

    this.rateLimitService.enforceOtpAttemptLimit(challenge);

    const normalizedValue = normalizeDestination(destinationType, destinationValue);
    if (
      challenge.destination_type !== destinationType ||
      challenge.destination_value !== normalizedValue
    ) {
      throw {
        status: 400,
        safe: true,
        message: "That verification code is invalid or has expired.",
      };
    }

    if (
      challenge.consumed_at ||
      new Date(challenge.expires_at).getTime() <= Date.now()
    ) {
      throw {
        status: 400,
        safe: true,
        message: "That verification code has expired. Please request a new one.",
      };
    }

    const expectedHash = hashOtp({
      destinationType,
      destinationValue: normalizedValue,
      purpose: challenge.purpose,
      code,
    });

    const valid = safeCompare(challenge.otp_hash, expectedHash);
    if (!valid) {
      await challenge.update({
        attempt_count: Number(challenge.attempt_count || 0) + 1,
      });

      await this.auditLogger.log({
        eventType: "otp_verify_failed",
        authMethod: `${destinationType}_otp`,
        destinationType,
        destinationValue: normalizedValue,
        success: false,
        ipAddress,
        metadata: { challengeId: challenge.challenge_id },
      });

      throw {
        status: 400,
        safe: true,
        message: "That verification code is incorrect. Please try again.",
      };
    }

    await challenge.update({
      consumed_at: new Date(),
    });

    const { user, created } = await this.identityResolutionService.resolveOtpUser({
      destinationType,
      destinationValue: normalizedValue,
      profileName,
    });

    const token = this.tokenService.issueToken(user);

    await this.auditLogger.log({
      userId: user.user_id,
      eventType: "otp_verify_success",
      authMethod: `${destinationType}_otp`,
      destinationType,
      destinationValue: normalizedValue,
      success: true,
      ipAddress,
      metadata: {
        challengeId: challenge.challenge_id,
        created,
      },
    });

    return {
      token,
      user,
      user_created: created,
    };
  }
}

function normalizeDestination(destinationType, destinationValue) {
  const value = String(destinationValue || "").trim();
  if (destinationType === "email") {
    return value.toLowerCase();
  }
  return value.replace(/\s+/g, "");
}

function generateOtpCode() {
  const max = 10 ** env.auth.otpCodeLength;
  return String(randomInt(0, max)).padStart(env.auth.otpCodeLength, "0");
}

function hashOtp({ destinationType, destinationValue, purpose, code }) {
  return createHmac("sha256", env.auth.otpSecret)
    .update(`${destinationType}:${destinationValue}:${purpose}:${code}`)
    .digest("hex");
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
