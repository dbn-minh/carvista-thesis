import { createHmac, randomUUID } from "crypto";
import { env } from "../../config/env.js";

const SOCIAL_STATE_TTL_MS = 10 * 60 * 1000;

export function createSocialStateToken({ providerName, next }) {
  const payload = {
    providerName,
    next: normalizeNext(next),
    issuedAt: Date.now(),
    nonce: randomUUID(),
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySocialStateToken(stateToken) {
  const [encoded, signature] = String(stateToken || "").split(".");
  if (!encoded || !signature || sign(encoded) !== signature) {
    throw {
      status: 400,
      safe: true,
      message: "The social login session is invalid or has expired.",
    };
  }

  const payload = JSON.parse(fromBase64Url(encoded));
  if (Date.now() - Number(payload.issuedAt || 0) > SOCIAL_STATE_TTL_MS) {
    throw {
      status: 400,
      safe: true,
      message: "The social login session has expired. Please try again.",
    };
  }

  return payload;
}

function sign(value) {
  return createHmac("sha256", env.auth.socialStateSecret)
    .update(value)
    .digest("base64url");
}

function toBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizeNext(next) {
  if (typeof next !== "string" || !next.startsWith("/")) return "/garage";
  return next;
}
