import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { env } from "../../config/env.js";
import { ensureAuthSchema } from "./auth-schema.service.js";

const PLACEHOLDER_EMAIL_DOMAIN = "users.carvista.local";

export class IdentityResolutionService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async resolveOtpUser({ destinationType, destinationValue, profileName }) {
    const { Users } = this.ctx.models;
    const normalizedValue = normalizeDestination(destinationType, destinationValue);

    const existingUser =
      destinationType === "email"
        ? await Users.findOne({ where: { email: normalizedValue } })
        : await Users.findOne({ where: { phone: normalizedValue } });

    if (existingUser) {
      return {
        user: existingUser,
        created: false,
      };
    }

    const passwordHash = await createUnusablePasswordHash();
    const user = await Users.create({
      name: profileName || buildDefaultName(destinationType, normalizedValue),
      email:
        destinationType === "email"
          ? normalizedValue
          : buildPlaceholderEmail(`phone-${normalizedValue}`),
      phone: destinationType === "phone" ? normalizedValue : null,
      password_hash: passwordHash,
      role: "user",
    });

    return {
      user,
      created: true,
    };
  }

  async resolveSocialUser(profile) {
    await ensureAuthSchema(this.ctx);

    const { Users, ExternalIdentities } = this.ctx.models;

    const existingIdentity = await ExternalIdentities.findOne({
      where: {
        provider_name: profile.providerName,
        provider_user_id: profile.providerUserId,
      },
    });

    if (existingIdentity) {
      const linkedUser = await Users.findByPk(existingIdentity.user_id);
      if (linkedUser) {
        return {
          user: linkedUser,
          created: false,
          linkedByEmail: false,
        };
      }
    }

    let user = null;
    let created = false;
    let linkedByEmail = false;
    const normalizedEmail = profile.email ? profile.email.toLowerCase() : null;

    if (normalizedEmail && profile.emailVerified) {
      user = await Users.findOne({ where: { email: normalizedEmail } });
      linkedByEmail = Boolean(user);
    }

    if (!user) {
      user = await Users.create({
        name:
          profile.displayName ||
          buildDefaultName("email", normalizedEmail || profile.providerUserId),
        email:
          normalizedEmail ||
          buildPlaceholderEmail(`${profile.providerName}-${profile.providerUserId}`),
        phone: null,
        password_hash: await createUnusablePasswordHash(),
        role: "user",
      });
      created = true;
    }

    await ExternalIdentities.findOrCreate({
      where: {
        provider_name: profile.providerName,
        provider_user_id: profile.providerUserId,
      },
      defaults: {
        user_id: user.user_id,
        provider_name: profile.providerName,
        provider_user_id: profile.providerUserId,
        provider_email: normalizedEmail,
        provider_display_name: profile.displayName || null,
        provider_avatar_url: profile.avatarUrl || null,
        provider_email_verified: Boolean(profile.emailVerified),
        metadata_json: JSON.stringify(profile.raw || {}),
      },
    });

    return {
      user,
      created,
      linkedByEmail,
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

async function createUnusablePasswordHash() {
  return bcrypt.hash(randomBytes(24).toString("hex"), env.auth.bcryptRounds);
}

function buildPlaceholderEmail(seed) {
  const normalized = String(seed || "member")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized || "member"}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function buildDefaultName(destinationType, destinationValue) {
  if (destinationType === "phone") {
    return `CarVista member ${String(destinationValue).slice(-4)}`;
  }

  const localPart = String(destinationValue || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();

  return localPart ? titleCase(localPart) : "CarVista member";
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
