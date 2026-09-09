import { Queue, Worker, type Job } from "bullmq";
import type { Logger } from "pino";
import { z } from "zod";

import {
  createBullMqConnection,
  type BackgroundJobComponent,
  type BackgroundJobTelemetry,
} from "../../infrastructure/background-jobs/index.js";
import type { NotificationRepository } from "../notifications/notification.repository.js";
import {
  checkPushReceipts,
  deliverPush,
  handlePushDeliveryFailure,
  PUSH_LEASE_MS,
  type PushDeliveryDependencies,
} from "./push.delivery.js";
import { reconcilePushOutbox } from "./push.worker.js";

const QUEUE_NAME = "push-delivery";
const RECONCILE_INTERVAL_MS = 2_000;
const STALE_MS = 5 * 60_000;
const BATCH_SIZE = 100;

const jobSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("RECONCILE") }),
  z.strictObject({
    kind: z.literal("DISPATCH"),
    outboxId: z.string().regex(/^[a-f\d]{24}$/i),
  }),
  z.strictObject({
    kind: z.literal("RECEIPT"),
    outboxId: z.string().regex(/^[a-f\d]{24}$/i),
  }),
]);

type PushJobData = z.infer<typeof jobSchema>;
const retained = {
  removeOnComplete: { age: 24 * 60 * 60, count: 2_000 },
  removeOnFail: { age: 30 * 24 * 60 * 60, count: 5_000 },
} as const;

export const createBullMqPushJobs = (
  dependencies: PushDeliveryDependencies & {
    logger: Logger;
    notificationRepository: NotificationRepository;
    redisUrl: string;
    redisKeyPrefix: string;
    telemetry?: BackgroundJobTelemetry;
  },
): BackgroundJobComponent => {
  const prefix = `${dependencies.redisKeyPrefix}:bullmq`;
  const queueConnection = createBullMqConnection(
    dependencies.redisUrl,
    "push-queue",
    dependencies.logger,
  );
  const workerConnection = createBullMqConnection(
    dependencies.redisUrl,
    "push-worker",
    dependencies.logger,
  );
  const queue = new Queue<PushJobData>(QUEUE_NAME, {
    connection: queueConnection.connection,
    prefix,
  });

  const replaceFinishedJob = async (jobId: string) => {
    const existing = await queue.getJob(jobId);
    const state = await existing?.getState();
    if (existing && (state === "completed" || state === "failed")) {
      await existing.remove();
    }
  };

  const worker = new Worker<PushJobData>(
    QUEUE_NAME,
    async (job) => {
      const data = jobSchema.parse(job.data);
      if (data.kind === "RECONCILE") {
        await reconcilePushOutbox(
          dependencies.notificationRepository,
          dependencies,
        );
        const now = dependencies.now?.() ?? new Date();
        const staleBefore = new Date(now.getTime() - STALE_MS);
        const [dispatchable, receipts] = await Promise.all([
          dependencies.outbox.listDispatchable(now, staleBefore, BATCH_SIZE),
          dependencies.outbox.listReceiptReady(now, staleBefore, BATCH_SIZE),
        ]);
        for (const record of dispatchable) {
          const jobId = `push-dispatch-${record.id}`;
          await replaceFinishedJob(jobId);
          await queue.add(
            "dispatch",
            { kind: "DISPATCH", outboxId: record.id },
            { jobId, ...retained },
          );
          await dependencies.outbox.markQueued(record.id, now, "DISPATCH");
        }
        for (const record of receipts) {
          const jobId = `push-receipt-${record.id}`;
          await replaceFinishedJob(jobId);
          await queue.add(
            "receipt",
            { kind: "RECEIPT", outboxId: record.id },
            { jobId, ...retained },
          );
          await dependencies.outbox.markQueued(record.id, now, "RECEIPT");
        }
        return;
      }

      const now = dependencies.now?.() ?? new Date();
      if (data.kind === "DISPATCH") {
        const record = await dependencies.outbox.claimDispatch(
          data.outboxId,
          now,
          new Date(now.getTime() + PUSH_LEASE_MS),
        );
        if (!record) return;
        try {
          await deliverPush(dependencies, record);
        } catch (error) {
          await handlePushDeliveryFailure(dependencies, record, error);
        }
        return;
      }

      const record = await dependencies.outbox.claimReceipt(
        data.outboxId,
        now,
        new Date(now.getTime() + PUSH_LEASE_MS),
      );
      if (!record) return;
      try {
        await checkPushReceipts(dependencies, record);
      } catch (error) {
        await dependencies.outbox.scheduleReceiptRetry(
          record.id,
          new Date(now.getTime() + 60_000),
          error instanceof Error ? error.name : "PUSH_RECEIPT_ERROR",
        );
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
      const counts = await queue.getJobCounts(
        "wait",
        "active",
        "delayed",
        "failed",
      );
      return {
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        waiting: counts.wait ?? 0,
      };
    },
  );
  let started = false;

  queue.on("error", (error) =>
    dependencies.logger.error({ err: error }, "Push queue error"),
  );
  worker.on("error", (error) =>
    dependencies.logger.error({ err: error }, "Push worker error"),
  );
  worker.on("completed", (job: Job<PushJobData>) => {
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
  worker.on("failed", (job: Job<PushJobData> | undefined) => {
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
      await queue.setGlobalConcurrency(5);
      await queue.setGlobalRateLimit(20, 1_000);
      await queue.upsertJobScheduler(
        "push-outbox-reconcile-v1",
        { every: RECONCILE_INTERVAL_MS },
        {
          name: "reconcile",
          data: { kind: "RECONCILE" },
          opts: retained,
        },
      );
      started = true;
      void worker.run().catch((error: unknown) => {
        dependencies.logger.error({ err: error }, "Push worker stopped");
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
