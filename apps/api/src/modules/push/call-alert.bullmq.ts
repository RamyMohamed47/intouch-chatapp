import { Queue, Worker, type Job } from "bullmq";
import type { Logger } from "pino";
import { z } from "zod";

import {
  createBullMqConnection,
  type BackgroundJobComponent,
  type BackgroundJobTelemetry,
} from "../../infrastructure/background-jobs/index.js";
import {
  deliverCallAlert,
  handleCallAlertFailure,
  type CallAlertDeliveryDependencies,
} from "./call-alert.delivery.js";

const QUEUE_NAME = "call-alert-delivery";
const LEASE_MS = 30_000;
const STALE_MS = 60_000;
const BATCH_SIZE = 100;

const jobSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("RECONCILE") }),
  z.strictObject({
    kind: z.literal("DISPATCH"),
    outboxId: z.string().regex(/^[a-f\d]{24}$/i),
  }),
]);

type CallAlertJobData = z.infer<typeof jobSchema>;

export const createBullMqCallAlertJobs = (
  dependencies: CallAlertDeliveryDependencies & {
    logger: Logger;
    redisUrl: string;
    redisKeyPrefix: string;
    telemetry?: BackgroundJobTelemetry;
  },
): BackgroundJobComponent => {
  const prefix = `${dependencies.redisKeyPrefix}:bullmq`;
  const queueConnection = createBullMqConnection(
    dependencies.redisUrl,
    "call-alert-queue",
    dependencies.logger,
  );
  const workerConnection = createBullMqConnection(
    dependencies.redisUrl,
    "call-alert-worker",
    dependencies.logger,
  );
  const queue = new Queue<CallAlertJobData>(QUEUE_NAME, {
    connection: queueConnection.connection,
    prefix,
  });
  const worker = new Worker<CallAlertJobData>(
    QUEUE_NAME,
    async (job) => {
      const data = jobSchema.parse(job.data);
      const now = dependencies.now?.() ?? new Date();
      if (data.kind === "RECONCILE") {
        const records = await dependencies.outbox.listDispatchable(
          now,
          new Date(now.getTime() - STALE_MS),
          BATCH_SIZE,
        );
        for (const record of records) {
          const jobId = `call-alert-${record.id}`;
          const existing = await queue.getJob(jobId);
          const state = await existing?.getState();
          if (existing && (state === "completed" || state === "failed")) {
            await existing.remove();
          }
          await queue.add(
            "dispatch",
            { kind: "DISPATCH", outboxId: record.id },
            {
              jobId,
              removeOnComplete: { age: 60 * 60, count: 1_000 },
              removeOnFail: { age: 24 * 60 * 60, count: 2_000 },
            },
          );
          await dependencies.outbox.markQueued(record.id, now);
        }
        return;
      }
      const record = await dependencies.outbox.claim(
        data.outboxId,
        now,
        new Date(now.getTime() + LEASE_MS),
      );
      if (!record) return;
      try {
        await deliverCallAlert(dependencies, record);
      } catch (error) {
        await handleCallAlertFailure(dependencies, record, error);
      }
    },
    {
      autorun: false,
      concurrency: 5,
      connection: workerConnection.connection,
      prefix,
    },
  );
  const unregister = dependencies.telemetry?.registerBackgroundQueue(
    QUEUE_NAME,
    async () => {
      const counts = await queue.getJobCounts("wait", "active", "failed");
      return {
        active: counts.active ?? 0,
        delayed: 0,
        failed: counts.failed ?? 0,
        waiting: counts.wait ?? 0,
      };
    },
  );
  let started = false;

  queue.on("error", (error) =>
    dependencies.logger.error({ err: error }, "Call alert queue error"),
  );
  worker.on("error", (error) =>
    dependencies.logger.error({ err: error }, "Call alert worker error"),
  );
  worker.on("completed", (job: Job<CallAlertJobData>) => {
    dependencies.telemetry?.recordBackgroundJob({
      durationSeconds:
        Math.max(
          0,
          (job.finishedOn ?? Date.now()) - (job.processedOn ?? Date.now()),
        ) / 1_000,
      job: job.name,
      queue: QUEUE_NAME,
      result: "completed",
    });
  });
  worker.on("failed", (job: Job<CallAlertJobData> | undefined) => {
    dependencies.telemetry?.recordBackgroundJob({
      durationSeconds: job?.processedOn
        ? Math.max(0, Date.now() - job.processedOn) / 1_000
        : 0,
      job: job?.name ?? "unknown",
      queue: QUEUE_NAME,
      result: "failed",
    });
  });

  return {
    isReady: () =>
      started &&
      queueConnection.isReady() &&
      workerConnection.isReady() &&
      worker.isRunning(),
    async start() {
      if (started) return;
      await Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]);
      await queue.upsertJobScheduler(
        "call-alert-reconcile-v1",
        { every: 1_000 },
        {
          name: "reconcile",
          data: { kind: "RECONCILE" },
          opts: { removeOnComplete: 100, removeOnFail: 500 },
        },
      );
      started = true;
      void worker.run().catch((error: unknown) => {
        dependencies.logger.error({ err: error }, "Call alert worker stopped");
      });
    },
    async close() {
      started = false;
      unregister?.();
      await worker.close();
      await queue.close();
    },
  };
};
