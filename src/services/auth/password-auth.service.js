import bcrypt from "bcrypt";
import { env } from "../../config/env.js";
import { normalizePhoneNumberOrNull } from "../shared/phone-normalization.service.js";

const PLACEHOLDER_EMAIL_DOMAIN = "users.carvista.local";
const STRONG_PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a number, and a special character.";

export class PasswordAuthService {
  constructor(ctx, { tokenService }) {
    this.ctx = ctx;
    this.tokenService = tokenService;
  }

  async register({ name, email, phone, password }) {
    const { Users } = this.ctx.models;
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail =
      normalizeEmail(email) ||
      (normalizedPhone ? buildPlaceholderEmail(`phone-${normalizedPhone}`) : "");

    assertStrongPassword(password);
    await this.assertCanRegister({ email: normalizedEmail, phone: normalizedPhone });

    const passwordHash = await bcrypt.hash(password, env.auth.bcryptRounds);
    const user = await Users.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password_hash: passwordHash,
      role: "user",
    });

    return {
      user,
      token: this.tokenService.issueToken(user),
      created: true,
    };
  }

  async login({ email, password }) {
    const { Users } = this.ctx.models;
    const normalizedEmail = normalizeEmail(email);

    const user = await Users.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      throw { status: 401, safe: true, message: "Invalid credentials" };
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw { status: 401, safe: true, message: "Invalid credentials" };
    }

    return {
      user,
      token: this.tokenService.issueToken(user),
      created: false,
    };
  }

  async assertCanRegister({ email, phone }) {
    const { Users } = this.ctx.models;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    const emailExists = await Users.findOne({ where: { email: normalizedEmail } });
    if (emailExists) {
      throw { status: 409, safe: true, message: "Email already exists" };
    }

    if (normalizedPhone) {
      const phoneExists = await Users.findOne({ where: { phone: normalizedPhone } });
      if (phoneExists) {
        throw { status: 409, safe: true, message: "Phone number already exists" };
      }
    }
  }

  async findByContact({ destinationType, destinationValue }) {
    const { Users } = this.ctx.models;
    const normalizedValue =
      destinationType === "email"
        ? normalizeEmail(destinationValue)
        : normalizePhone(destinationValue);

    return Users.findOne({
      where:
        destinationType === "email"
          ? { email: normalizedValue }
          : { phone: normalizedValue },
    });
  }

  async updatePassword(user, password) {
    assertStrongPassword(password);
    const passwordHash = await bcrypt.hash(password, env.auth.bcryptRounds);
    await user.update({ password_hash: passwordHash });

    return {
      user,
      token: this.tokenService.issueToken(user),
      created: false,
    };
  }
}

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function normalizePhone(phone) {
  return normalizePhoneNumberOrNull(phone);
}

function buildPlaceholderEmail(seed) {
  const normalized = String(seed || "member")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized || "member"}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function assertStrongPassword(password) {
  const value = String(password || "");
  const strongEnough =
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value);

  if (!strongEnough) {
    throw {
      status: 400,
      safe: true,
      message: STRONG_PASSWORD_MESSAGE,
    };
  }
}
