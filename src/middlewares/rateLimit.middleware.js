import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

function createLimiter({ name, max }) {
  return rateLimit({
    windowMs: env.rateLimit.windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      const resetTime = req.rateLimit?.resetTime
        ? new Date(req.rateLimit.resetTime).getTime()
        : Date.now() + env.rateLimit.windowMs;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((resetTime - Date.now()) / 1000)
      );

      console.warn(`[rate-limit:${name}] blocked`, {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        retryAfterSeconds,
      });

      res.status(429).json({
        error: "Too many requests. Please try again later.",
        message: `Too many requests. Please try again in about ${retryAfterSeconds} seconds.`,
        retry_after_seconds: retryAfterSeconds,
      });
    },
  });
}

export const generalLimiter = createLimiter({
  name: "general",
  max: env.rateLimit.max,
});

export const aiLimiter = createLimiter({
  name: "ai",
  max: env.rateLimit.aiMax,
});

export const authLimiter = createLimiter({
  name: "auth",
  max: env.rateLimit.authMax,
});

export const actionLimiter = createLimiter({
  name: "marketplace-action",
  max: Math.min(env.rateLimit.max, 30),
});
