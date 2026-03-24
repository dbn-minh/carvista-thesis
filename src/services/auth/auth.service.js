import { AuthEventLogService } from "./auth-event-log.service.js";
import { IdentityResolutionService } from "./identity-resolution.service.js";
import { OtpAuthService } from "./otp-auth.service.js";
import { OtpDeliveryService } from "./otp-delivery.service.js";
import { PasswordAuthService } from "./password-auth.service.js";
import { RateLimitService } from "./rate-limit.service.js";
import { SocialAuthService } from "./social-auth.service.js";
import { TokenService } from "./token.service.js";

export class AuthService {
  constructor(ctx) {
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
  }

  async registerWithPassword(payload, requestMeta = {}) {
    const result = await this.passwordAuth.register(payload);
    await this.auditLogger.log({
      userId: result.user.user_id,
      eventType: "password_register_success",
      authMethod: "password",
      destinationType: "email",
      destinationValue: result.user.email,
      success: true,
      ipAddress: requestMeta.ipAddress || null,
    });
    return result;
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

  buildSocialStartUrl(providerName, next) {
    return this.socialAuth.buildStartUrl(providerName, next);
  }

  handleSocialCallback(providerName, payload) {
    return this.socialAuth.handleCallback(providerName, payload);
  }

  async getCurrentUser(userId) {
    return this.ctx.models.Users.findByPk(userId, {
      attributes: ["user_id", "name", "email", "phone", "role"],
    });
  }
}

export function createAuthService(ctx) {
  return new AuthService(ctx);
}
