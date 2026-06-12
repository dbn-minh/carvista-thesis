import Redis from "ioredis";
import { env } from "./env.js";

const REDIS_RETRY_COOLDOWN_MS = 10000;

let cacheClient = null;
let cacheConnectPromise = null;
let redisAvailable = false;
let lastConnectAttemptAt = 0;
let missingRedisUrlWarned = false;

function sanitizeRedisUrl(urlValue) {
  if (!urlValue) return null;

  try {
    const parsed = new URL(urlValue);
    const authPrefix = parsed.username
      ? `${encodeURIComponent(parsed.username)}${parsed.password ? ":***" : ""}@`
      : "";
    return `${parsed.protocol}//${authPrefix}${parsed.host}${parsed.pathname}`;
  } catch {
    return "redis://***";
  }
}

function buildRedisOptions({ label, maxRetriesPerRequest = 1 } = {}) {
  return {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest,
    retryStrategy(attempt) {
      if (attempt > 2) return null;
      return Math.min(attempt * 250, 1000);
    },
    reconnectOnError() {
      return false;
    },
    connectionName: `carvista-${label || "redis"}`,
  };
}

function attachListeners(client, label) {
  if (!client || client.__carvistaListenersAttached) return;

  client.__carvistaListenersAttached = true;

  client.on("connect", () => {
    console.log(`[redis:${label}] connecting`);
  });

  client.on("ready", () => {
    redisAvailable = true;
    console.log(`[redis:${label}] ready`);
  });

  client.on("close", () => {
    redisAvailable = false;
    console.warn(`[redis:${label}] connection closed`);
  });

  client.on("error", (error) => {
    redisAvailable = false;
    console.warn(`[redis:${label}] ${error?.message || "unknown error"}`);
  });
}

function canAttemptRedisConnect() {
  return Date.now() - lastConnectAttemptAt >= REDIS_RETRY_COOLDOWN_MS;
}

export function isRedisConfigured() {
  return Boolean(env.redis.url);
}

export function isRedisFeatureEnabled(feature) {
  if (feature === "cache") return env.redis.cacheEnabled;
  if (feature === "queue") return env.redis.queueEnabled;
  return env.redis.cacheEnabled || env.redis.queueEnabled;
}

export function isRedisAvailable() {
  return redisAvailable;
}

export async function getRedisClient() {
  if (!isRedisFeatureEnabled("cache")) return null;

  if (!isRedisConfigured()) {
    if (!missingRedisUrlWarned) {
      console.warn("[redis] REDIS_URL is not configured. Cache and queue stay in fallback mode.");
      missingRedisUrlWarned = true;
    }
    return null;
  }

  if (!cacheClient) {
    cacheClient = new Redis(env.redis.url, buildRedisOptions({ label: "cache", maxRetriesPerRequest: 1 }));
    attachListeners(cacheClient, "cache");
  }

  if (redisAvailable) return cacheClient;
  if (cacheConnectPromise) return cacheConnectPromise;
  if (!canAttemptRedisConnect()) return null;

  lastConnectAttemptAt = Date.now();
  cacheConnectPromise = cacheClient
    .connect()
    .then(() => cacheClient)
    .catch((error) => {
      redisAvailable = false;
      console.warn("[redis:cache] unavailable, using fallback mode", {
        message: error?.message || "unknown error",
        url: sanitizeRedisUrl(env.redis.url),
      });
      return null;
    })
    .finally(() => {
      cacheConnectPromise = null;
    });

  return cacheConnectPromise;
}

export function createBullRedisConnection(label = "bullmq") {
  if (!isRedisFeatureEnabled("queue")) return null;

  if (!isRedisConfigured()) {
    if (!missingRedisUrlWarned) {
      console.warn("[redis] REDIS_URL is not configured. BullMQ queue stays in fallback mode.");
      missingRedisUrlWarned = true;
    }
    return null;
  }

  const connection = new Redis(
    env.redis.url,
    buildRedisOptions({ label, maxRetriesPerRequest: null })
  );
  attachListeners(connection, label);
  return connection;
}

export async function pingRedis() {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    redisAvailable = (await client.ping()) === "PONG";
    return redisAvailable;
  } catch (error) {
    redisAvailable = false;
    console.warn("[redis:cache] ping failed", {
      message: error?.message || "unknown error",
    });
    return false;
  }
}

export async function closeRedisClient() {
  if (!cacheClient) return;

  try {
    await cacheClient.quit();
  } catch {
    await cacheClient.disconnect();
  } finally {
    cacheClient = null;
    cacheConnectPromise = null;
    redisAvailable = false;
  }
}
