import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { createBullRedisConnection } from "../config/redis.js";
import { createDb } from "../db/index.js";
import { processNotificationJob } from "../services/notifications/notification-job.service.js";
import { NOTIFICATION_QUEUE_NAME } from "../services/queue/queue.service.js";

async function main() {
  if (!env.redis.queueEnabled) {
    console.warn("[worker:notification] QUEUE_ENABLED=false. Worker will not start.");
    return;
  }

  if (!env.redis.url) {
    console.warn("[worker:notification] REDIS_URL is missing. Worker will not start.");
    return;
  }

  const connection = createBullRedisConnection("notification-worker");
  if (!connection) {
    console.warn("[worker:notification] Redis connection is unavailable. Worker will not start.");
    return;
  }

  try {
    await connection.connect();
    await connection.ping();
  } catch (error) {
    console.warn("[worker:notification] Redis is unavailable. Worker stays disabled.", {
      message: error?.message || "unknown error",
    });
    await connection.quit().catch(() => connection.disconnect());
    return;
  }

  const db = createDb();
  await db.sequelize.authenticate();

  const worker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      console.log("[worker:notification] processing job", {
        id: job.id,
        name: job.name,
      });

      const result = await processNotificationJob(db, {
        type: job.name,
        payload: job.data,
      });
      console.log("[worker:notification] job result", {
        id: job.id,
        name: job.name,
        result,
      });
      return result;
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log("[worker:notification] job completed", {
      id: job.id,
      name: job.name,
    });
  });

  worker.on("failed", (job, error) => {
    console.error("[worker:notification] job failed", {
      id: job?.id ?? null,
      name: job?.name ?? null,
      message: error?.message || "unknown error",
    });
  });

  const shutdown = async () => {
    console.log("[worker:notification] shutting down");
    await worker.close().catch(() => {});
    await connection.quit().catch(() => connection.disconnect());
    await db.sequelize.close().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[worker:notification] ready");
}

main().catch((error) => {
  console.error("[worker:notification] fatal startup error", error);
  process.exit(1);
});
