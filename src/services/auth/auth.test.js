import test from "node:test";
import assert from "node:assert/strict";
import { buildOtpEmailTemplate } from "../notifications/email-template.service.js";
import { createSocialStateToken, verifySocialStateToken } from "./social-state.service.js";

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

test("OTP email template includes code and expiry", () => {
  const template = buildOtpEmailTemplate({
    code: "123456",
    expiresInMinutes: 10,
    purpose: "login",
  });

  assert.match(template.subject, /CarVista/i);
  assert.match(template.text, /123456/);
  assert.match(template.text, /10 minutes/);
  assert.match(template.html, /123456/);
});
