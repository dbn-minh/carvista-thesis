import { env } from "../../../config/env.js";

const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v22.0";

export class FacebookAuthProvider {
  constructor() {
    this.config = env.auth.social.facebook;
  }

  getAuthorizationUrl(state) {
    if (!this.config.appId || !this.config.appSecret) {
      throw {
        status: 503,
        safe: true,
        message: "Facebook login is not configured yet.",
      };
    }

    const url = new URL(`https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set("client_id", this.config.appId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "email,public_profile");
    return url.toString();
  }

  async exchangeCodeForProfile(code) {
    const tokenUrl = new URL(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`
    );
    tokenUrl.searchParams.set("client_id", this.config.appId);
    tokenUrl.searchParams.set("client_secret", this.config.appSecret);
    tokenUrl.searchParams.set("redirect_uri", this.config.redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenPayload = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      throw {
        status: 502,
        safe: true,
        message: "Facebook login could not be completed right now.",
        details: tokenPayload,
      };
    }

    const profileUrl = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me`);
    profileUrl.searchParams.set("fields", "id,name,email,picture.type(large)");
    profileUrl.searchParams.set("access_token", tokenPayload.access_token);

    const profileResponse = await fetch(profileUrl.toString());
    const profile = await profileResponse.json().catch(() => null);
    if (!profileResponse.ok || !profile?.id) {
      throw {
        status: 502,
        safe: true,
        message: "Facebook login could not load your profile.",
        details: profile,
      };
    }

    return {
      providerName: "facebook",
      providerUserId: profile.id,
      email: profile.email || null,
      emailVerified: Boolean(profile.email),
      displayName: profile.name || null,
      avatarUrl: profile.picture?.data?.url || null,
      raw: profile,
    };
  }
}
