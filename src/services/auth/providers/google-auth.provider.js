import { env } from "../../../config/env.js";

export class GoogleAuthProvider {
  constructor() {
    this.config = env.auth.social.google;
  }

  getAuthorizationUrl(state) {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw {
        status: 503,
        safe: true,
        message: "Google login is not configured yet.",
      };
    }

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  async exchangeCodeForProfile(code) {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenPayload = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      throw {
        status: 502,
        safe: true,
        message: "Google login could not be completed right now.",
        details: tokenPayload,
      };
    }

    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
        },
      }
    );
    const profile = await profileResponse.json().catch(() => null);

    if (!profileResponse.ok || !profile?.sub) {
      throw {
        status: 502,
        safe: true,
        message: "Google login could not load your profile.",
        details: profile,
      };
    }

    return {
      providerName: "google",
      providerUserId: profile.sub,
      email: profile.email || null,
      emailVerified: Boolean(profile.email_verified),
      displayName: profile.name || null,
      avatarUrl: profile.picture || null,
      raw: profile,
    };
  }
}
