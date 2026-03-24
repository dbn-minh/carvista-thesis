import dotenv from "dotenv";
dotenv.config();

export const env = {
  appPort: parseInt(process.env.APP_PORT || "3000", 10),
  appPublicUrl:
    process.env.APP_PUBLIC_URL ||
    `http://localhost:${parseInt(process.env.APP_PORT || "3000", 10)}`,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
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
    otpSecret: process.env.OTP_SECRET || process.env.JWT_SECRET || "change_me",
    otpCodeLength: parseInt(process.env.OTP_CODE_LENGTH || "6", 10),
    otpExpiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES || "10", 10),
    otpResendCooldownSeconds: parseInt(
      process.env.OTP_RESEND_COOLDOWN_SECONDS || "60",
      10
    ),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10),
    otpMaxResends: parseInt(process.env.OTP_MAX_RESENDS || "3", 10),
    otpMaxChallengesPerHour: parseInt(
      process.env.OTP_MAX_CHALLENGES_PER_HOUR || "5",
      10
    ),
    socialStateSecret:
      process.env.SOCIAL_STATE_SECRET || process.env.JWT_SECRET || "change_me",
    social: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirectUri:
          process.env.GOOGLE_REDIRECT_URI ||
          `${
            process.env.APP_PUBLIC_URL ||
            `http://localhost:${parseInt(process.env.APP_PORT || "3000", 10)}`
          }/api/auth/social/google/callback`,
      },
      facebook: {
        appId: process.env.FACEBOOK_APP_ID || "",
        appSecret: process.env.FACEBOOK_APP_SECRET || "",
        redirectUri:
          process.env.FACEBOOK_REDIRECT_URI ||
          `${
            process.env.APP_PUBLIC_URL ||
            `http://localhost:${parseInt(process.env.APP_PORT || "3000", 10)}`
          }/api/auth/social/facebook/callback`,
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
  priceDropThreshold: parseFloat(process.env.PRICE_DROP_THRESHOLD || "0.03"),
};
