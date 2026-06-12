import crypto from "crypto";
import { env } from "../../config/env.js";
import {
  getRedisClient,
  isRedisAvailable,
  isRedisFeatureEnabled,
} from "../../config/redis.js";

const CACHE_KEY_VERSION = "v2";

function normalizeValue(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.toJSON === "function"
  ) {
    return normalizeValue(value.toJSON());
  }
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        const normalized = normalizeValue(value[key]);
        if (normalized !== undefined) {
          accumulator[key] = normalized;
        }
        return accumulator;
      }, {});
  }
  return value;
}

function flattenEntries(input, prefix = "") {
  if (input == null) return [];

  if (Array.isArray(input)) {
    return [[prefix, input.map((item) => String(item)).join(",")]];
  }

  if (typeof input !== "object") {
    return [[prefix, String(input)]];
  }

  return Object.keys(input)
    .sort()
    .flatMap((key) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      const value = input[key];
      if (value == null || value === "") return [];
      if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        return flattenEntries(value, nextPrefix);
      }
      return [[nextPrefix, Array.isArray(value) ? value.join(",") : String(value)]];
    });
}

function safeSerialize(value) {
  return JSON.stringify(normalizeValue(value));
}

function buildFingerprint(value) {
  return crypto.createHash("sha1").update(safeSerialize(value)).digest("hex").slice(0, 12);
}

function createCacheService({
  getClient = getRedisClient,
  isEnabled = () => isRedisFeatureEnabled("cache") && env.redis.cacheEnabled,
  isAvailable = isRedisAvailable,
  logger = console,
} = {}) {
  async function resolveClient() {
    if (!isEnabled()) return null;
    return getClient();
  }

  async function getCache(key) {
    const client = await resolveClient();
    if (!client || !isAvailable()) {
      logger.info?.("[cache] bypass get", { key, reason: client ? "redis_unavailable" : "cache_disabled" });
      return null;
    }

    try {
      const raw = await client.get(key);
      if (raw == null) {
        logger.info?.("[cache] miss", { key });
        return null;
      }

      logger.info?.("[cache] hit", { key });
      return JSON.parse(raw);
    } catch (error) {
      logger.warn?.("[cache] get failed", {
        key,
        message: error?.message || "unknown error",
      });
      return null;
    }
  }

  async function setCache(key, value, ttlSeconds = env.redis.ttlSeconds) {
    const client = await resolveClient();
    if (!client || !isAvailable()) {
      logger.info?.("[cache] bypass set", { key, reason: client ? "redis_unavailable" : "cache_disabled" });
      return false;
    }

    try {
      await client.set(key, safeSerialize(value), "EX", Math.max(1, Number(ttlSeconds) || env.redis.ttlSeconds));
      logger.info?.("[cache] set", { key, ttlSeconds });
      return true;
    } catch (error) {
      logger.warn?.("[cache] set failed", {
        key,
        message: error?.message || "unknown error",
      });
      return false;
    }
  }

  async function deleteCache(key) {
    const client = await resolveClient();
    if (!client || !isAvailable()) {
      logger.info?.("[cache] bypass delete", { key, reason: client ? "redis_unavailable" : "cache_disabled" });
      return 0;
    }

    try {
      const deleted = await client.del(key);
      logger.info?.("[cache] delete", { key, deleted });
      return deleted;
    } catch (error) {
      logger.warn?.("[cache] delete failed", {
        key,
        message: error?.message || "unknown error",
      });
      return 0;
    }
  }

  async function deleteByPattern(pattern) {
    const client = await resolveClient();
    if (!client || !isAvailable()) {
      logger.info?.("[cache] bypass deleteByPattern", {
        pattern,
        reason: client ? "redis_unavailable" : "cache_disabled",
      });
      return 0;
    }

    let deleted = 0;
    let cursor = "0";

    try {
      do {
        const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await client.del(...keys);
        }
      } while (cursor !== "0");

      logger.info?.("[cache] deleteByPattern", { pattern, deleted });
      return deleted;
    } catch (error) {
      logger.warn?.("[cache] deleteByPattern failed", {
        pattern,
        message: error?.message || "unknown error",
      });
      return deleted;
    }
  }

  async function remember(key, ttlSeconds, producerFn, { onStatus } = {}) {
    const client = await resolveClient();
    const cacheReady = Boolean(client && isAvailable());

    if (!cacheReady) {
      onStatus?.("bypass");
      logger.info?.("[cache] remember bypass", {
        key,
        reason: client ? "redis_unavailable" : "cache_disabled",
      });
      return producerFn();
    }

    const cached = await getCache(key);
    if (cached != null) {
      onStatus?.("hit");
      return cached;
    }

    const value = await producerFn();
    onStatus?.("miss");
    await setCache(key, value, ttlSeconds);
    return value;
  }

  function buildCacheKey(namespace, params = {}) {
    const normalized = normalizeValue(params);
    const entries = flattenEntries(normalized);
    const versionedNamespace = `${namespace}:${CACHE_KEY_VERSION}`;

    if (entries.length === 0) return versionedNamespace;

    const segments = entries.map(([key, value]) => `${key}=${value}`);
    const key = `${versionedNamespace}:${segments.join(":")}`;

    if (key.length <= 180) return key;
    return `${versionedNamespace}:${segments.slice(0, 4).join(":")}:hash=${buildFingerprint(normalized)}`;
  }

  return {
    getCache,
    setCache,
    deleteCache,
    deleteByPattern,
    remember,
    buildCacheKey,
  };
}

const defaultCacheService = createCacheService();

export const getCache = defaultCacheService.getCache;
export const setCache = defaultCacheService.setCache;
export const deleteCache = defaultCacheService.deleteCache;
export const deleteByPattern = defaultCacheService.deleteByPattern;
export const remember = defaultCacheService.remember;
export const buildCacheKey = defaultCacheService.buildCacheKey;
export { createCacheService };
