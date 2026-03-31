import dotenv from "dotenv";

const runtimeNodeEnv = process.env.NODE_ENV || "development";
const shouldLoadDotenv = runtimeNodeEnv !== "production" || process.env.LOAD_DOTENV_IN_PRODUCTION === "true";

if (shouldLoadDotenv) {
  dotenv.config();
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDatabaseUrl(urlValue) {
  if (!urlValue) return null;
  try {
    const parsed = new URL(urlValue);
    return {
      url: urlValue,
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      name: parsed.pathname.replace(/^\//, ""),
      user: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
      dialect: parsed.protocol.startsWith("mysql") ? "mysql" : "mysql",
    };
  } catch {
    return null;
  }
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const appPort = toInt(process.env.PORT || process.env.APP_PORT, 4000);
const appPublicUrl = trimSlash(process.env.APP_PUBLIC_URL || `http://localhost:${appPort}`);
const frontendUrl = trimSlash(process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.MYSQL_PUBLIC_URL ||
  process.env.RAILWAY_DATABASE_URL ||
  "";
const parsedDatabaseUrl = parseDatabaseUrl(databaseUrl);

const dbHost = process.env.DB_HOST || process.env.MYSQLHOST || parsedDatabaseUrl?.host || "localhost";
const dbPort = toInt(process.env.DB_PORT || process.env.MYSQLPORT || parsedDatabaseUrl?.port, 3306);
const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || parsedDatabaseUrl?.name || "carvista";
const dbUser = process.env.DB_USER || process.env.MYSQLUSER || parsedDatabaseUrl?.user || "user";
const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || parsedDatabaseUrl?.password || "password";
const corsAllowedOrigins = [
  frontendUrl,
  ...parseList(process.env.CORS_ALLOWED_ORIGINS),
].filter(Boolean);
const corsAllowedOriginPatterns = parseList(process.env.CORS_ALLOWED_ORIGIN_PATTERNS);

function resolveSocialRedirectUri(envKey, providerPath) {
  return trimSlash(process.env[envKey] || `${appPublicUrl}/api/auth/social/${providerPath}/callback`);
}

export const env = {
  nodeEnv,
  isProduction,
  appPort,
  appPublicUrl,
  frontendUrl,
  trustProxy: toBool(process.env.TRUST_PROXY, isProduction),
  logFormat: process.env.LOG_FORMAT || (isProduction ? "combined" : "dev"),
  jsonLimit: process.env.JSON_LIMIT || "2mb",
  cors: {
    allowedOrigins: [...new Set(corsAllowedOrigins)],
    allowedOriginPatterns: corsAllowedOriginPatterns,
    credentials: toBool(process.env.CORS_ALLOW_CREDENTIALS, true),
  },
  db: {
    url: databaseUrl || null,
    host: dbHost,
    port: dbPort,
    name: dbName,
    user: dbUser,
    password: dbPassword,
    dialect: "mysql",
    ssl: toBool(process.env.DB_SSL || process.env.MYSQL_SSL, false),
    sslRejectUnauthorized: toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
    poolMax: toInt(process.env.DB_POOL_MAX, 10),
    poolMin: toInt(process.env.DB_POOL_MIN, 0),
    poolAcquireMs: toInt(process.env.DB_POOL_ACQUIRE_MS, 30000),
    poolIdleMs: toInt(process.env.DB_POOL_IDLE_MS, 10000),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || "change_me",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),
    otpSecret: process.env.OTP_SECRET || process.env.JWT_SECRET || "change_me",
    otpCodeLength: toInt(process.env.OTP_CODE_LENGTH, 6),
    otpExpiresInMinutes: toInt(process.env.OTP_EXPIRES_IN_MINUTES, 10),
    otpResendCooldownSeconds: toInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
    otpMaxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
    otpMaxResends: toInt(process.env.OTP_MAX_RESENDS, 3),
    otpMaxChallengesPerHour: toInt(process.env.OTP_MAX_CHALLENGES_PER_HOUR, 5),
    socialStateSecret: process.env.SOCIAL_STATE_SECRET || process.env.JWT_SECRET || "change_me",
    social: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirectUri: resolveSocialRedirectUri("GOOGLE_REDIRECT_URI", "google"),
      },
      facebook: {
        appId: process.env.FACEBOOK_APP_ID || "",
        appSecret: process.env.FACEBOOK_APP_SECRET || "",
        redirectUri: resolveSocialRedirectUri("FACEBOOK_REDIRECT_URI", "facebook"),
      },
    },
  },
  notifications: {
    email: {
      provider: process.env.EMAIL_PROVIDER || "console",
      from: process.env.EMAIL_FROM || "noreply@carvista.local",
      resendApiKey: process.env.RESEND_API_KEY || "",
      resendApiUrl: process.env.RESEND_API_URL || "https://api.resend.com/emails",
    },
    sms: {
      provider: process.env.SMS_PROVIDER || "console",
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
      twilioFromNumber: process.env.TWILIO_FROM_NUMBER || "",
    },
  },
  priceDropThreshold: toFloat(process.env.PRICE_DROP_THRESHOLD, 0.03),
};
