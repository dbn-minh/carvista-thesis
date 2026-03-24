import { Op } from "sequelize";
import { env } from "../../config/env.js";

export class RateLimitService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async enforceOtpRequestLimit({ destinationType, destinationValue }) {
    const { OtpChallenges } = this.ctx.models;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentCount = await OtpChallenges.count({
      where: {
        destination_type: destinationType,
        destination_value: destinationValue,
        created_at: {
          [Op.gte]: oneHourAgo,
        },
      },
    });

    if (recentCount >= env.auth.otpMaxChallengesPerHour) {
      throw {
        status: 429,
        safe: true,
        message:
          "Too many verification code requests. Please wait a bit before trying again.",
      };
    }
  }

  enforceOtpAttemptLimit(challenge) {
    if (challenge.attempt_count >= env.auth.otpMaxAttempts) {
      throw {
        status: 429,
        safe: true,
        message:
          "That code can no longer be used. Please request a new verification code.",
      };
    }
  }

  enforceOtpResendLimit(challenge) {
    if (challenge.resend_count >= env.auth.otpMaxResends) {
      throw {
        status: 429,
        safe: true,
        message:
          "You have requested too many codes. Please wait before requesting another one.",
      };
    }
  }
}
