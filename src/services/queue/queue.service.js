import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import { createBullRedisConnection } from "../../config/redis.js";

export const NOTIFICATION_QUEUE_NAME = "notificationQueue";

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: true,
  removeOnFail: 50,
};

let notificationQueue = null;
let notificationQueueConnection = null;

export function isQueueEnabled() {
  return env.redis.queueEnabled && Boolean(env.redis.url);
}

async function getNotificationQueue() {
  if (!isQueueEnabled()) return null;

  if (!notificationQueueConnection) {
    notificationQueueConnection = createBullRedisConnection("notification-queue");
  }

  if (!notificationQueueConnection) return null;

  if (!notificationQueue) {
    notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection: notificationQueueConnection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return notificationQueue;
}

export async function enqueueNotificationJob(type, payload, options = {}) {
  if (!isQueueEnabled()) {
    console.info("[queue] notification queue bypassed", {
      type,
      reason: env.redis.queueEnabled ? "missing_redis_url" : "queue_disabled",
    });
    return {
      queued: false,
      fallback: true,
      reason: "queue_disabled",
    };
  }

  try {
    const queue = await getNotificationQueue();
    if (!queue) {
      return {
        queued: false,
        fallback: true,
        reason: "queue_unavailable",
      };
    }

    const job = await queue.add(type, payload, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
    });

    console.log("[queue] notification job queued", {
      type,
      jobId: job.id,
    });

    return {
      queued: true,
      fallback: false,
      queueName: NOTIFICATION_QUEUE_NAME,
      jobId: job.id,
    };
  } catch (error) {
    console.warn("[queue] enqueue failed, falling back to inline notification", {
      type,
      message: error?.message || "unknown error",
    });

    return {
      queued: false,
      fallback: true,
      reason: "enqueue_failed",
    };
  }
}

export async function closeNotificationQueue() {
  if (notificationQueue) {
    await notificationQueue.close().catch(() => {});
    notificationQueue = null;
  }

  if (notificationQueueConnection) {
    await notificationQueueConnection.quit().catch(() => notificationQueueConnection.disconnect());
    notificationQueueConnection = null;
  }
}
