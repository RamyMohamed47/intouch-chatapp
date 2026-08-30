import { Queue, UnrecoverableError, Worker, type Job } from "bullmq";
import { z } from "zod";

import { createBullMqConnection } from "../../infrastructure/background-jobs/index.js";
import type { BackgroundJobComponent } from "../../infrastructure/background-jobs/index.js";
import {
  deliverClaimedMail,
  getMailErrorCode,
  MAIL_LEASE_MS,
  MAIL_MAX_ATTEMPTS,
  MAIL_RETRY_DELAYS_MS,
  type MailDeliveryDependencies,
} from "./mail.delivery.js";

const MAIL_QUEUE_NAME = "mail-delivery";
const RECONCILE_JOB_NAME = "reconcile";
const DELIVER_JOB_NAME = "deliver";
const RECONCILE_INTERVAL_MS = 2_000;
const DISPATCH_STALE_MS = 5 * 60 * 1000;
const DISPATCH_BATCH_SIZE = 100;

const mailJobSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("RECONCILE") }),
  z.strictObject({
    kind: z.literal("DELIVER"),
    outboxId: z.string().regex(/^[a-f\d]{24}$/i),
  }),
]);

type MailJobData = z.infer<typeof mailJobSchema>;

const retainedJobOptions = {
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 30 * 24 * 60 * 60, count: 5_000 },
} as const;

export const parseMailJobData = (data: unknown): MailJobData =>
  mailJobSchema.parse(data);

export const createBullMqMailJobs = (
  dependencies: Omit<MailDeliveryDependencies, "now"> & {
    redisUrl: string;
    redisKeyPrefix: string;
    now?: () => Date;
  },
): BackgroundJobComponent => {
  const now = dependencies.now ?? (() => new Date());
  const prefix = `${dependencies.redisKeyPrefix}:bullmq`;
  const queueConnection = createBullMqConnection(
    dependencies.redisUrl,
    "mail-queue",
    dependencies.logger,
  );
  const workerConnection = createBullMqConnection(
    dependencies.redisUrl,
    "mail-worker",
    dependencies.logger,
  );
  const queue = new Queue<MailJobData>(MAIL_QUEUE_NAME, {
    connection: queueConnection.connection,
    prefix,
  });
  const worker = new Worker<MailJobData>(
    MAIL_QUEUE_NAME,
    async (job) => {
      const data = parseMailJobData(job.data);
      if (data.kind === "RECONCILE") {
        const dispatchedAt = now();
        const records = await dependencies.outbox.listDispatchable(
          dispatchedAt,
          new Date(dispatchedAt.getTime() - DISPATCH_STALE_MS),
          DISPATCH_BATCH_SIZE,
        );
        for (const record of records) {
          const jobId = `mail-${record.id}`;
          if (record.dispatchedAt === undefined) {
            const existingJob = await queue.getJob(jobId);
            const existingState = await existingJob?.getState();
            if (
              existingJob &&
              (existingState === "completed" || existingState === "failed")
            ) {
              await existingJob.remove();
            }
          }
          await queue.add(
            DELIVER_JOB_NAME,
            { kind: "DELIVER", outboxId: record.id },
            {
              jobId,
              attempts: MAIL_MAX_ATTEMPTS,
              backoff: { type: "mail-delivery" },
              ...retainedJobOptions,
            },
          );
          await dependencies.outbox.markDispatched(record.id, dispatchedAt);
        }
        return;
      }

      const claimedAt = now();
      const record = await dependencies.outbox.claimById(
        data.outboxId,
        claimedAt,
        new Date(claimedAt.getTime() + MAIL_LEASE_MS),
      );
      if (!record) return;

      try {
        await deliverClaimedMail({ ...dependencies, now }, record);
      } catch (error) {
        const failedAt = now();
        const errorCode = getMailErrorCode(error);
        const retryDelay = MAIL_RETRY_DELAYS_MS[record.attempts - 1];
        const canRetry =
          record.attempts < MAIL_MAX_ATTEMPTS &&
          retryDelay !== undefined &&
          failedAt.getTime() + retryDelay < record.expiresAt.getTime();

        if (canRetry) {
          await dependencies.outbox.scheduleRetry(
            record.id,
            new Date(failedAt.getTime() + retryDelay),
            errorCode,
          );
        } else {
          await dependencies.outbox.markFailed(record.id, failedAt, errorCode);
        }

        dependencies.logger.warn(
          {
            mailJobId: record.id,
            mailKind: record.kind,
            attempt: record.attempts,
            retryScheduled: canRetry,
            errorCode,
          },
          "Transactional email delivery failed",
        );
        if (!canRetry) throw new UnrecoverableError(errorCode);
        throw error instanceof Error ? error : new Error(errorCode);
      }
    },
    {
      autorun: false,
      concurrency: 5,
      connection: workerConnection.connection,
      prefix,
      settings: {
        backoffStrategy: (attemptsMade, type) => {
          if (type !== "mail-delivery") return 0;
          return MAIL_RETRY_DELAYS_MS[attemptsMade - 1] ?? 0;
        },
      },
    },
  );
  let started = false;

  queue.on("error", (error) => {
    dependencies.logger.error({ err: error }, "Mail queue error");
  });
  worker.on("error", (error) => {
    dependencies.logger.error({ err: error }, "Mail worker error");
  });
  worker.on("failed", (job: Job<MailJobData> | undefined, error) => {
    dependencies.logger.warn(
      {
        errorCode: getMailErrorCode(error),
        bullMqJobId: job?.id,
        bullMqJobName: job?.name,
      },
      "Mail queue job failed",
    );
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
      await queue.setGlobalRateLimit(10, 1_000);
      await queue.upsertJobScheduler(
        "mail-outbox-reconcile-v1",
        { every: RECONCILE_INTERVAL_MS },
        {
          name: RECONCILE_JOB_NAME,
          data: { kind: "RECONCILE" },
          opts: retainedJobOptions,
        },
      );
      started = true;
      void worker.run().catch((error: unknown) => {
        dependencies.logger.error({ err: error }, "Mail worker stopped");
      });
    },
    async close() {
      started = false;
      await worker.close();
      await queue.close();
    },
  };
};
