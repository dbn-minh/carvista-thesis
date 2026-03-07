import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { validate } from "../middlewares/validate.js";
import { requireAuth } from "../middlewares/auth.js";

export const authRoutes = Router();

const RegisterSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    password: z.string().min(6),
  }),
  query: z.any(),
  params: z.any(),
});

authRoutes.post("/auth/register", validate(RegisterSchema), async (req, res, next) => {
  try {
    const { Users } = req.ctx.models;
    const b = req.validated.body;

    const exists = await Users.findOne({ where: { email: b.email } });
    if (exists) return next({ status: 409, message: "Email already exists" });

    const password_hash = await bcrypt.hash(b.password, env.auth.bcryptRounds);
    const user = await Users.create({
      name: b.name,
      email: b.email,
      phone: b.phone ?? null,
      password_hash,
      role: "user",
    });

    res.status(201).json({ user_id: user.user_id, email: user.email });
  } catch (e) { next(e); }
});

const LoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  query: z.any(),
  params: z.any(),
});

authRoutes.post("/auth/login", validate(LoginSchema), async (req, res, next) => {
  try {
    const { Users } = req.ctx.models;
    const b = req.validated.body;

    const user = await Users.findOne({ where: { email: b.email } });
    if (!user) return next({ status: 401, message: "Invalid credentials" });

    const ok = await bcrypt.compare(b.password, user.password_hash);
    if (!ok) return next({ status: 401, message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      env.auth.jwtSecret,
      { expiresIn: env.auth.jwtExpiresIn }
    );
    res.json({ token });
  } catch (e) { next(e); }
});

authRoutes.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const { Users } = req.ctx.models;
    const user = await Users.findByPk(req.user.userId, { attributes: ["user_id","name","email","phone","role"] });
    res.json({ user });
  } catch (e) { next(e); }
});