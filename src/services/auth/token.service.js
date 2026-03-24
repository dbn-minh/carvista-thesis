import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export class TokenService {
  issueToken(user) {
    return jwt.sign(
      {
        userId: user.user_id,
        role: user.role,
      },
      env.auth.jwtSecret,
      { expiresIn: env.auth.jwtExpiresIn }
    );
  }

  verifyToken(token) {
    return jwt.verify(token, env.auth.jwtSecret);
  }
}
