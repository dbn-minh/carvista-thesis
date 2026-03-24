import { env } from "../../config/env.js";
import { FacebookAuthProvider } from "./providers/facebook-auth.provider.js";
import { GoogleAuthProvider } from "./providers/google-auth.provider.js";
import { createSocialStateToken, verifySocialStateToken } from "./social-state.service.js";

export class SocialAuthService {
  constructor(ctx, { tokenService, identityResolutionService, auditLogger }) {
    this.ctx = ctx;
    this.tokenService = tokenService;
    this.identityResolutionService = identityResolutionService;
    this.auditLogger = auditLogger;
    this.providers = {
      google: new GoogleAuthProvider(),
      facebook: new FacebookAuthProvider(),
    };
  }

  buildStartUrl(providerName, next) {
    const provider = this.providers[providerName];
    if (!provider) {
      throw {
        status: 404,
        safe: true,
        message: "Unsupported social login provider.",
      };
    }

    const state = createSocialStateToken({ providerName, next });
    return provider.getAuthorizationUrl(state);
  }

  async handleCallback(
    providerName,
    { code, state, error, errorDescription, ipAddress }
  ) {
    const provider = this.providers[providerName];
    if (!provider) {
      throw {
        status: 404,
        safe: true,
        message: "Unsupported social login provider.",
      };
    }

    if (error) {
      throw {
        status: 400,
        safe: true,
        message:
          errorDescription ||
          "Social login was cancelled or could not be completed.",
      };
    }

    const statePayload = verifySocialStateToken(state);
    if (statePayload.providerName !== providerName) {
      throw {
        status: 400,
        safe: true,
        message: "The social login session is invalid or has expired.",
      };
    }

    const socialProfile = await provider.exchangeCodeForProfile(code);
    const resolved = await this.identityResolutionService.resolveSocialUser(
      socialProfile
    );
    const token = this.tokenService.issueToken(resolved.user);

    await this.auditLogger.log({
      userId: resolved.user.user_id,
      eventType: "social_login_success",
      authMethod: "social",
      providerName,
      destinationType: socialProfile.email ? "email" : null,
      destinationValue: socialProfile.email || null,
      success: true,
      ipAddress,
      metadata: {
        created: resolved.created,
        linkedByEmail: resolved.linkedByEmail,
      },
    });

    return {
      token,
      redirectUrl: `${env.frontendUrl}/auth/social/callback#token=${encodeURIComponent(
        token
      )}&next=${encodeURIComponent(statePayload.next || "/garage")}`,
    };
  }
}
