import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next({ status: 401, message: "Missing Bearer token" });

  try {
    req.user = jwt.verify(token, env.auth.jwtSecret); // { userId, role }
    next();
  } catch {
    next({ status: 401, message: "Invalid/expired token" });
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user?.role) return next({ status: 401, message: "Unauthorized" });
    if (!roles.includes(req.user.role)) return next({ status: 403, message: "Forbidden" });
    next();
  };
}