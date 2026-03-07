import dotenv from "dotenv";
dotenv.config();

export const env = {
  appPort: parseInt(process.env.APP_PORT || "3000", 10),
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3308", 10),
    name: process.env.DB_NAME || "carvista",
    user: process.env.DB_USER || "user",
    password: process.env.DB_PASSWORD || "password",
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || "change_me",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10", 10),
  },
  priceDropThreshold: parseFloat(process.env.PRICE_DROP_THRESHOLD || "0.03"),
};