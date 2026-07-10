import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  buildOtpEmailTemplate,
  buildWelcomeEmailTemplate,
  buildViewingRequestBuyerEmail,
  buildViewingRequestSellerEmail,
} from "../notifications/email-template.service.js";
import { env } from "../../config/env.js";
import {
  createEmailProvider,
  NotificationService,
} from "../notifications/notification.service.js";
import { SmtpEmailProvider } from "../notifications/providers/smtp-email.provider.js";
import { OtpAuthService, maskOtpDestination } from "./otp-auth.service.js";
import { AuthService } from "./auth.service.js";
import { PasswordAuthService } from "./password-auth.service.js";
import { SpeedSmsProvider } from "./providers/speedsms-sms.provider.js";
import { createSocialStateToken, verifySocialStateToken } from "./social-state.service.js";
import { normalizePhoneNumber } from "../shared/phone-normalization.service.js";

test("social state token round-trips provider and next path", () => {
  const token = createSocialStateToken({
    providerName: "google",
    next: "/garage",
  });

  const payload = verifySocialStateToken(token);
  assert.equal(payload.providerName, "google");
  assert.equal(payload.next, "/garage");
  assert.ok(payload.nonce);
});

test("social state token normalizes unsafe next paths", () => {
  const token = createSocialStateToken({
    providerName: "facebook",
    next: "https://malicious.example.com",
  });

  const payload = verifySocialStateToken(token);
  assert.equal(payload.next, "/garage");
});

test("OTP email template renders a branded security email", () => {
  const previousFrontendUrl = env.frontendUrl;
  const previousAppPublicUrl = env.appPublicUrl;
  const previousFrom = env.notifications.email.from;

  try {
    env.frontendUrl = "http://localhost:3000";
    env.appPublicUrl = "http://localhost:4000";
    env.notifications.email.from = "CarVista <demo@gmail.com>";

    const template = buildOtpEmailTemplate({
      code: "123456",
      expiresInMinutes: 1,
      purpose: "register",
    });

    assert.match(template.subject, /CarVista/i);
    assert.match(template.subject, /verify/i);
    assert.doesNotMatch(template.subject, /123456/);
    assert.match(template.text, /Verify your CarVista account/);
    assert.match(template.text, /123456/);
    assert.match(template.text, /1 minute/);
    assert.match(template.text, /Do not share this code/i);
    assert.match(template.text, /Support: demo@gmail\.com/);
    assert.doesNotMatch(template.text, /localhost/);
    assert.match(template.html, /CarVista/);
    assert.match(template.html, /123456/);
    assert.match(template.html, /1 2 3 4 5 6/);
    assert.match(template.html, /Security note/);
    assert.match(template.html, /This email was sent for a CarVista account request/);
    assert.match(template.html, /demo@gmail\.com/);
    assert.doesNotMatch(template.html, /Open CarVista/);
    assert.doesNotMatch(template.html, /Contact support/);
    assert.doesNotMatch(template.html, /localhost/);
    assert.doesNotMatch(template.html, /carvista\.local/);
    assert.match(template.html, /@media only screen/);
  } finally {
    env.frontendUrl = previousFrontendUrl;
    env.appPublicUrl = previousAppPublicUrl;
    env.notifications.email.from = previousFrom;
  }
});

test("OTP email template escapes dynamic code content", () => {
  const template = buildOtpEmailTemplate({
    code: "<123&456>",
    expiresInMinutes: 5,
    purpose: "reset_password",
  });

  assert.match(template.subject, /Reset your CarVista password/);
  assert.match(template.html, /&lt; 1 2 3 &amp; 4 5 6 &gt;/);
  assert.doesNotMatch(template.html, /<123&456>/);
});

test("OTP destination masking hides sensitive contact details", () => {
  assert.equal(maskOtpDestination("email", "minh.nguyen@example.com"), "mi*****@example.com");
  assert.equal(maskOtpDestination("phone", "+84 901 234 567"), "+*****4567");
});

test("phone normalization converts Vietnam local numbers to E.164", () => {
  assert.equal(normalizePhoneNumber("090 123 4567"), "+84901234567");
  assert.equal(normalizePhoneNumber("090-123-4567"), "+84901234567");
  assert.equal(normalizePhoneNumber("+840901234567"), "+84901234567");
  assert.equal(normalizePhoneNumber("84901234567"), "+84901234567");
});

test("OTP login request does not deliver code for unknown contacts", async () => {
  const { service, sent } = createOtpAuthHarness();

  const result = await service.requestOtp({
    destinationType: "email",
    destinationValue: "missing@example.com",
    purpose: "passwordless_signin",
    ipAddress: "127.0.0.1",
    userAgent: "node-test",
  });

  assert.equal(sent.length, 0);
  assert.equal(result.masked_destination, "mi*****@example.com");
  assert.ok(result.challenge_id);
});

test("OTP login verifies an existing user without creating a new account", async () => {
  const user = {
    user_id: 7,
    email: "buyer@example.com",
    phone: null,
    role: "user",
  };
  const { service, sent } = createOtpAuthHarness({ user });

  const requested = await service.requestOtp({
    destinationType: "email",
    destinationValue: "buyer@example.com",
    purpose: "passwordless_signin",
    ipAddress: "127.0.0.1",
  });

  assert.equal(sent.length, 1);

  const verified = await service.verifyOtp({
    challengeId: requested.challenge_id,
    destinationType: "email",
    destinationValue: "buyer@example.com",
    code: sent[0].code,
    ipAddress: "127.0.0.1",
  });

  assert.equal(verified.token, "token-7");
  assert.equal(verified.user, user);
  assert.equal(verified.user_created, false);
});

test("OTP phone request normalizes Vietnam local numbers before delivery", async () => {
  const user = {
    user_id: 8,
    email: "buyer@example.com",
    phone: "+84901234567",
    role: "user",
  };
  const { service, sent } = createOtpAuthHarness({ user });

  const result = await service.requestOtp({
    destinationType: "phone",
    destinationValue: "090 123 4567",
    purpose: "passwordless_signin",
    ipAddress: "127.0.0.1",
  });

  assert.equal(sent.length, 1);
  assert.equal(result.destination_value, "+84901234567");
  assert.equal(sent[0].destinationValue, "+84901234567");
});

test("buyer viewing request email confirms success and links request management", () => {
  const template = buildViewingRequestBuyerEmail({
    buyerName: "Minh",
    listingTitle: "2024 Toyota Camry",
    listingId: 42,
    sellerName: "CarVista Dealer",
    preferredViewingTime: "2026-06-12T09:00:00.000Z",
    message: "Can I see it this weekend?",
  });

  assert.match(template.subject, /viewing request/i);
  assert.match(template.text, /sent successfully/i);
  assert.match(template.text, /2024 Toyota Camry/);
  assert.match(template.text, /CarVista Dealer/);
  assert.match(template.text, /\/requests/);
  assert.match(template.html, /Manage requests/);
});

test("seller viewing request email links to the requests manager", () => {
  const previousFrontendUrl = env.frontendUrl;

  try {
    env.frontendUrl = "http://localhost:3000";

    const template = buildViewingRequestSellerEmail({
      sellerName: "Seller",
      listingTitle: "2024 Toyota Camry",
      listingId: 42,
      buyerName: "Minh",
      buyerEmail: "buyer@example.com",
      buyerPhone: "+84 901 234 567",
      preferredViewingTime: "2026-06-12T09:00:00.000Z",
      message: "Can I see it this weekend?",
    });

    assert.match(template.subject, /New viewing request/i);
    assert.match(template.text, /You have a new viewing request/i);
    assert.match(template.text, /buyer@example\.com/);
    assert.match(template.text, /Manage viewing requests: http:\/\/localhost:3000\/requests/);
    assert.match(template.html, /Manage viewing requests/);
    assert.match(template.html, /http:\/\/localhost:3000\/requests/);
  } finally {
    env.frontendUrl = previousFrontendUrl;
  }
});

test("welcome email template matches CarVista account theme", () => {
  const previousFrontendUrl = env.frontendUrl;

  try {
    env.frontendUrl = "http://localhost:3000";

    const template = buildWelcomeEmailTemplate({
      userName: "Minh Doan",
    });

    assert.match(template.subject, /Welcome to CarVista/);
    assert.match(template.text, /Hi Minh Doan/);
    assert.match(template.text, /created successfully/i);
    assert.match(template.text, /http:\/\/localhost:3000\/listings/);
    assert.match(template.html, /Welcome, Minh/);
    assert.match(template.html, /Browse vehicles/);
    assert.match(template.html, /Compare cars/);
    assert.match(template.html, /http:\/\/localhost:3000\/profile/);
    assert.match(template.html, /@media only screen/);
  } finally {
    env.frontendUrl = previousFrontendUrl;
  }
});

test("notification service sends buyer viewing request email", async () => {
  const sent = [];
  const service = new NotificationService(
    { models: { Notifications: { create: async (payload) => payload } } },
    {
      emailProvider: {
        async send(payload) {
          sent.push(payload);
          return { provider: "test-email", messageId: "msg_1" };
        },
      },
    }
  );

  const result = await service.sendBuyerViewingRequestEmail({
    buyer: { name: "Minh", email: "buyer@example.com" },
    listingTitle: "2024 Toyota Camry",
    listingId: 42,
    sellerName: "CarVista Dealer",
    preferredViewingTime: null,
    message: "Please confirm availability.",
  });

  assert.equal(result.delivered, true);
  assert.equal(result.provider, "test-email");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "buyer@example.com");
  assert.match(sent[0].subject, /viewing request/i);
  assert.match(sent[0].text, /sent successfully/i);
});

test("notification service sends seller viewing request email", async () => {
  const sent = [];
  const service = new NotificationService(
    { models: { Notifications: { create: async (payload) => payload } } },
    {
      emailProvider: {
        async send(payload) {
          sent.push(payload);
          return { provider: "test-email", messageId: "seller-msg-1" };
        },
      },
    }
  );

  const result = await service.sendSellerViewingRequestEmail({
    seller: { name: "Seller", email: "seller@example.com" },
    listingTitle: "2024 Toyota Camry",
    listingId: 42,
    buyerName: "Minh",
    buyerEmail: "buyer@example.com",
    buyerPhone: "+84 901 234 567",
    preferredViewingTime: null,
    message: "Please confirm availability.",
  });

  assert.equal(result.delivered, true);
  assert.equal(result.provider, "test-email");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "seller@example.com");
  assert.match(sent[0].subject, /New viewing request/i);
  assert.match(sent[0].text, /Manage viewing requests/i);
  assert.match(sent[0].html, /\/requests/);
});

test("notification service sends welcome email", async () => {
  const sent = [];
  const service = new NotificationService(
    { models: { Notifications: { create: async (payload) => payload } } },
    {
      emailProvider: {
        async send(payload) {
          sent.push(payload);
          return { provider: "test-email", messageId: "welcome-msg-1" };
        },
      },
    }
  );

  const result = await service.sendWelcomeEmail({
    user: { name: "Minh", email: "minh@example.com" },
  });

  assert.equal(result.delivered, true);
  assert.equal(result.provider, "test-email");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "minh@example.com");
  assert.match(sent[0].subject, /Welcome to CarVista/);
  assert.match(sent[0].text, /Your account has been created successfully/);
  assert.match(sent[0].html, /Browse vehicles/);
});

test("notification service skips welcome email for placeholder local addresses", async () => {
  const sent = [];
  const service = new NotificationService(
    { models: { Notifications: { create: async (payload) => payload } } },
    {
      emailProvider: {
        async send(payload) {
          sent.push(payload);
        },
      },
    }
  );

  const result = await service.sendWelcomeEmail({
    user: { name: "Phone User", email: "phone-84901234567@users.carvista.local" },
  });

  assert.equal(result.delivered, false);
  assert.equal(result.reason, "welcome_email_missing_or_local");
  assert.equal(sent.length, 0);
});

test("auth registration sends welcome email after creating a user", async () => {
  const sentWelcome = [];
  const { service } = createAuthServiceHarness({
    notificationService: {
      async sendWelcomeEmail(payload) {
        sentWelcome.push(payload);
        return { delivered: true, provider: "test-email" };
      },
    },
  });
  const registrationToken = jwt.sign(
    {
      purpose: "registration_verified",
      destinationType: "email",
      destinationValue: "minh@example.com",
    },
    env.auth.jwtSecret,
    { expiresIn: "10m" }
  );

  const result = await service.registerWithPassword(
    {
      name: "Minh Doan",
      email: "minh@example.com",
      password: "CarVista#1",
      registrationToken,
    },
    { ipAddress: "127.0.0.1" }
  );

  assert.equal(result.created, true);
  assert.equal(result.user.email, "minh@example.com");
  assert.equal(sentWelcome.length, 1);
  assert.equal(sentWelcome[0].user.email, "minh@example.com");
});

test("email provider factory supports Gmail SMTP mode", () => {
  const previousProvider = env.notifications.email.provider;

  try {
    env.notifications.email.provider = "smtp";
    assert.ok(createEmailProvider() instanceof SmtpEmailProvider);
  } finally {
    env.notifications.email.provider = previousProvider;
  }
});

test("SMTP email provider sends through the configured Gmail transporter", async () => {
  const sent = [];
  const provider = new SmtpEmailProvider({
    config: {
      from: "CarVista <demo@gmail.com>",
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: "demo@gmail.com",
      smtpPass: "google-app-password",
    },
    transporter: {
      async sendMail(payload) {
        sent.push(payload);
        return { messageId: "smtp-msg-1" };
      },
    },
  });

  const result = await provider.send({
    to: "buyer@example.com",
    subject: "Your CarVista verification code",
    text: "Code: 123456",
    html: "<p>Code: 123456</p>",
  });

  assert.equal(result.provider, "smtp");
  assert.equal(result.messageId, "smtp-msg-1");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, "CarVista <demo@gmail.com>");
  assert.equal(sent[0].to, "buyer@example.com");
  assert.match(sent[0].subject, /verification code/i);
});

test("SpeedSMS provider sends OTP through the SpeedSMS API", async () => {
  const calls = [];
  const provider = new SpeedSmsProvider({
    config: {
      speedSmsAccessToken: "speed-token",
      speedSmsApiBaseUrl: "https://api.speedsms.vn/index.php",
      speedSmsSmsType: 4,
      speedSmsSender: "Verify",
    },
    async fetchImpl(url, options) {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            status: "success",
            code: "00",
            data: { tranId: 12345, totalSMS: 1, totalPrice: 250, invalidPhone: [] },
          };
        },
      };
    },
  });

  const result = await provider.sendOtp({
    destination: "+84817140976",
    message: "Ma OTP CarVista cua ban la 123456. Hieu luc trong 1 minute.",
  });

  assert.equal(result.provider, "speedsms");
  assert.equal(result.messageId, "12345");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");

  const url = new URL(calls[0].url);
  assert.equal(url.href.startsWith("https://api.speedsms.vn/index.php/sms/send?"), true);
  assert.equal(url.searchParams.get("access-token"), "speed-token");
  assert.equal(url.searchParams.get("to"), "84817140976");
  assert.equal(url.searchParams.get("type"), "4");
  assert.equal(url.searchParams.get("sender"), "Verify");
  assert.match(url.searchParams.get("content") || "", /CarVista/);
});

test("SpeedSMS provider maps SpeedSMS API errors to safe delivery failures", async () => {
  const provider = new SpeedSmsProvider({
    config: {
      speedSmsAccessToken: "speed-token",
      speedSmsApiBaseUrl: "https://api.speedsms.vn/index.php",
      speedSmsSmsType: 4,
      speedSmsSender: "Verify",
    },
    async fetchImpl() {
      return {
        ok: true,
        async json() {
          return {
            status: "error",
            code: "300",
            message: "Your account balance not enough to send sms",
          };
        },
      };
    },
  });

  await assert.rejects(
    () =>
      provider.sendOtp({
        destination: "+84817140976",
        message: "Ma OTP CarVista cua ban la 123456. Hieu luc trong 1 minute.",
      }),
    (error) =>
      error?.status === 502 &&
      error?.safe === true &&
      error?.details?.provider === "speedsms" &&
      error?.details?.code === "300"
  );
});

test("password auth rejects weak registration passwords", async () => {
  const { service } = createPasswordAuthHarness();

  await assert.rejects(
    () =>
      service.register({
        name: "Minh",
        email: "minh@example.com",
        password: "password",
      }),
    (error) =>
      error?.status === 400 &&
      /uppercase letter, a number, and a special character/i.test(error.message)
  );
});

test("password auth supports phone-only registration with a placeholder email", async () => {
  const { service, createdUsers } = createPasswordAuthHarness();

  const result = await service.register({
    name: "Minh",
    phone: "+84 901 234 567",
    password: "CarVista#1",
  });

  assert.equal(result.token, "token-99");
  assert.equal(createdUsers.length, 1);
  assert.equal(createdUsers[0].phone, "+84901234567");
  assert.equal(createdUsers[0].email, "phone-84901234567@users.carvista.local");
});

test("password auth normalizes local Vietnam phone numbers at registration", async () => {
  const { service, createdUsers } = createPasswordAuthHarness();

  await service.register({
    name: "Minh",
    phone: "090 123 4567",
    password: "CarVista#1",
  });

  assert.equal(createdUsers[0].phone, "+84901234567");
});

function createOtpAuthHarness({ user = null } = {}) {
  let nextChallengeId = 1;
  const challenges = new Map();
  const sent = [];
  const auditEvents = [];

  const OtpChallenges = {
    async sync() {},
    async count() {
      return 0;
    },
    async findOne() {
      return null;
    },
    async findByPk(challengeId) {
      return challenges.get(Number(challengeId)) || null;
    },
    async create(payload) {
      const challenge = {
        challenge_id: nextChallengeId,
        ...payload,
        async update(nextValues) {
          Object.assign(challenge, nextValues);
          return challenge;
        },
      };
      nextChallengeId += 1;
      challenges.set(challenge.challenge_id, challenge);
      return challenge;
    },
  };

  const ctx = {
    models: {
      OtpChallenges,
      ExternalIdentities: { async sync() {} },
      AuthEventLogs: { async sync() {} },
      Users: {
        async findOne({ where }) {
          if (!user) return null;
          if (where.email && where.email === user.email) return user;
          if (where.phone && where.phone === user.phone) return user;
          return null;
        },
      },
    },
  };

  const service = new OtpAuthService(ctx, {
    tokenService: {
      issueToken(foundUser) {
        return `token-${foundUser.user_id}`;
      },
    },
    identityResolutionService: {
      async resolveOtpUser() {
        throw new Error("OTP login should not create a user");
      },
    },
    auditLogger: {
      async log(event) {
        auditEvents.push(event);
      },
    },
    otpDeliveryService: {
      async sendOtp(payload) {
        sent.push(payload);
      },
    },
    rateLimitService: {
      async enforceOtpRequestLimit() {},
      enforceOtpAttemptLimit() {},
      enforceOtpResendLimit() {},
    },
  });

  return { service, sent, auditEvents };
}

function createAuthServiceHarness({ notificationService }) {
  const createdUsers = [];
  const authEvents = [];

  const Users = {
    async findOne() {
      return null;
    },
    async create(payload) {
      const user = {
        user_id: 101,
        ...payload,
      };
      createdUsers.push(user);
      return user;
    },
  };

  const ctx = {
    models: {
      Users,
      OtpChallenges: { async sync() {} },
      ExternalIdentities: { async sync() {} },
      AuthEventLogs: {
        async sync() {},
        async create(payload) {
          authEvents.push(payload);
          return payload;
        },
      },
    },
  };

  const service = new AuthService(ctx, { notificationService });
  return { service, createdUsers, authEvents };
}

function createPasswordAuthHarness() {
  const createdUsers = [];

  const Users = {
    async findOne() {
      return null;
    },
    async create(payload) {
      const user = {
        user_id: 99,
        ...payload,
      };
      createdUsers.push(user);
      return user;
    },
  };

  const service = new PasswordAuthService(
    { models: { Users } },
    {
      tokenService: {
        issueToken(user) {
          return `token-${user.user_id}`;
        },
      },
    }
  );

  return { service, createdUsers };
}
