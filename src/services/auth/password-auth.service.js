import bcrypt from "bcrypt";
import { env } from "../../config/env.js";

export class PasswordAuthService {
  constructor(ctx, { tokenService }) {
    this.ctx = ctx;
    this.tokenService = tokenService;
  }

  async register({ name, email, phone, password }) {
    const { Users } = this.ctx.models;
    const normalizedEmail = email.toLowerCase().trim();

    const exists = await Users.findOne({ where: { email: normalizedEmail } });
    if (exists) {
      throw { status: 409, safe: true, message: "Email already exists" };
    }

    const passwordHash = await bcrypt.hash(password, env.auth.bcryptRounds);
    const user = await Users.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
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
    const normalizedEmail = email.toLowerCase().trim();

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
}
