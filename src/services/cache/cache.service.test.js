import test from "node:test";
import assert from "node:assert/strict";
import { createCacheService } from "./cache.service.js";

function createFakeRedisClient() {
  const store = new Map();

  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value) {
      store.set(key, value);
      return "OK";
    },
    async del(...keys) {
      const list = keys.flatMap((key) => (Array.isArray(key) ? key : [key]));
      let removed = 0;
      for (const key of list) {
        if (store.delete(key)) removed += 1;
      }
      return removed;
    },
    async scan(cursor, _matchLabel, pattern) {
      if (cursor !== "0") return ["0", []];
      const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
      const matches = [...store.keys()].filter((key) => regex.test(key));
      return ["0", matches];
    },
  };
}

test("cache service bypasses safely when cache is disabled", async () => {
  const cache = createCacheService({
    isEnabled: () => false,
    getClient: async () => null,
    isAvailable: () => false,
    logger: { info() {}, warn() {} },
  });

  const value = await cache.remember("catalog:makes", 30, async () => ({ items: [1, 2, 3] }));
  assert.deepEqual(value, { items: [1, 2, 3] });
  assert.equal(await cache.getCache("catalog:makes"), null);
});

test("cache service stores and reuses JSON payloads", async () => {
  const fakeClient = createFakeRedisClient();
  const cache = createCacheService({
    isEnabled: () => true,
    getClient: async () => fakeClient,
    isAvailable: () => true,
    logger: { info() {}, warn() {} },
  });

  let producerCalls = 0;
  const key = cache.buildCacheKey("listing:search", {
    status: "active",
    owner_id: 12,
    page: 1,
  });

  const first = await cache.remember(key, 60, async () => {
    producerCalls += 1;
    return { items: [{ listing_id: 7 }] };
  });
  const second = await cache.remember(key, 60, async () => {
    producerCalls += 1;
    return { items: [] };
  });

  assert.equal(producerCalls, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(await cache.getCache(key), { items: [{ listing_id: 7 }] });
});

test("cache service can delete by namespace pattern", async () => {
  const fakeClient = createFakeRedisClient();
  const cache = createCacheService({
    isEnabled: () => true,
    getClient: async () => fakeClient,
    isAvailable: () => true,
    logger: { info() {}, warn() {} },
  });

  await cache.setCache("listing:search:v2:status=active", { ok: 1 }, 60);
  await cache.setCache("listing:detail:v2:listing_id=99", { ok: 2 }, 60);
  await cache.setCache("catalog:makes:v2", { ok: 3 }, 60);

  const removed = await cache.deleteByPattern("listing:*");
  assert.equal(removed, 2);
  assert.equal(await cache.getCache("listing:search:v2:status=active"), null);
  assert.equal(await cache.getCache("listing:detail:v2:listing_id=99"), null);
  assert.deepEqual(await cache.getCache("catalog:makes:v2"), { ok: 3 });
});

test("cache service serializes toJSON objects into plain JSON", async () => {
  const fakeClient = createFakeRedisClient();
  const cache = createCacheService({
    isEnabled: () => true,
    getClient: async () => fakeClient,
    isAvailable: () => true,
    logger: { info() {}, warn() {} },
  });

  const key = cache.buildCacheKey("vehicle:detail", { variant_id: 1 });
  const sequelizeLikeImage = {
    toJSON() {
      return {
        image_id: 10,
        variant_id: 1,
        url: "https://example.com/car.jpg",
      };
    },
  };

  await cache.setCache(key, { images: [sequelizeLikeImage] }, 60);
  const cached = await cache.getCache(key);

  assert.deepEqual(cached, {
    images: [
      {
        image_id: 10,
        variant_id: 1,
        url: "https://example.com/car.jpg",
      },
    ],
  });
});
