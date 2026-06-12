import test from "node:test";
import assert from "node:assert/strict";
import { env } from "../../config/env.js";
import { enqueueNotificationJob } from "./queue.service.js";

test("queue service falls back safely when queue is disabled", async () => {
  const previousQueueEnabled = env.redis.queueEnabled;
  const previousRedisUrl = env.redis.url;

  env.redis.queueEnabled = false;
  env.redis.url = null;

  try {
    const result = await enqueueNotificationJob("viewingRequestCreated", {
      requestId: 123,
    });

    assert.equal(result.queued, false);
    assert.equal(result.fallback, true);
  } finally {
    env.redis.queueEnabled = previousQueueEnabled;
    env.redis.url = previousRedisUrl;
  }
});
