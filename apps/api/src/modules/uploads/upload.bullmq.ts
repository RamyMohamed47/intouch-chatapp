import { Queue, UnrecoverableError, Worker, type Job } from "bullmq";
import type { Logger } from "pino";
import { z } from "zod";

import { createBullMqConnection } from "../../infrastructure/background-jobs/index.js";
import type {
  BackgroundJobComponent,
  BackgroundJobTelemetry,
} from "../../infrastructure/background-jobs/index.js";
import {
  ASSET_CLEANUP_BULL_ATTEMPTS,
  ASSET_CLEANUP_LEASE_MS,
  getAssetCleanupErrorCode,
  getAssetCleanupRetryDelay,
  performClaimedAssetCleanup,
} from "./upload.cleanup.js";
import type { StoredAssetRepository } from "./upload.repository.js";
import { StoredAssetStatus, type ObjectStorage } from "./upload.types.js";

const ASSET_QUEUE_NAME = "asset-cleanup";
const RECONCILE_JOB_NAME = "reconcile";
const CLEANUP_JOB_NAME = "cleanup";
const RECONCILE_INTERVAL_MS = 5_000;
const RECONCILE_BATCH_SIZE = 20;

const assetCleanupJobSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("RECONCILE") }),
  z.strictObject({
    kind: z.literal("CLEANUP"),
    assetId: z.string().regex(/^[a-f\d]{24}$/i),
    mode: z.enum(["DELETE", "STAGING"]),
    cleanupAttempt: z.number().int().positive(),
  }),
]);

type AssetCleanupJobData = z.infer<typeof assetCleanupJobSchema>;

const retainedJobOptions = {
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 30 * 24 * 60 * 60, count: 5_000 },
} as const;

export const parseAssetCleanupJobData = (data: unknown): AssetCleanupJobData =>
  assetCleanupJobSchema.parse(data);

export const createBullMqAssetCleanupJobs = (dependencies: {
  assets: StoredAssetRepository;
  storage: ObjectStorage;
  logger: Logger;
  redisUrl: string;
  redisKeyPrefix: string;
  now?: () => Date;
  telemetry?: BackgroundJobTelemetry;
}): BackgroundJobComponent => {
  const now = dependencies.now ?? (() => new Date());
  const prefix = `${dependencies.redisKeyPrefix}:bullmq`;
  const queueConnection = createBullMqConnection(
    dependencies.redisUrl,
    "asset-queue",
    dependencies.logger,
  );
  const workerConnection = createBullMqConnection(
    dependencies.redisUrl,
    "asset-worker",
    dependencies.logger,
  );
  const queue = new Queue<AssetCleanupJobData>(ASSET_QUEUE_NAME, {
    connection: queueConnection.connection,
    prefix,
  });
  const worker = new Worker<AssetCleanupJobData>(
    ASSET_QUEUE_NAME,
    async (job) => {
      const data = parseAssetCleanupJobData(job.data);
      if (data.kind === "RECONCILE") {
        const candidates = await dependencies.assets.listCleanupCandidates(
          now(),
          RECONCILE_BATCH_SIZE,
        );
        for (const candidate of candidates) {
          const cleanupAttempt = candidate.asset.cleanupAttempts + 1;
          await queue.add(
            CLEANUP_JOB_NAME,
            {
              kind: "CLEANUP",
              assetId: candidate.asset.id,
              mode: candidate.mode,
              cleanupAttempt,
            },
            {
              jobId: `asset-${candidate.mode.toLowerCase()}-${candidate.asset.id}-${cleanupAttempt}`,
              attempts: ASSET_CLEANUP_BULL_ATTEMPTS,
              backoff: { type: "exponential", delay: 5_000 },
              ...retainedJobOptions,
            },
          );
        }
        return;
      }

      const claimedAt = now();
      const asset =
        job.attemptsMade === 0
          ? await dependencies.assets.claimCleanupById(
              data.assetId,
              data.mode,
              claimedAt,
              new Date(claimedAt.getTime() + ASSET_CLEANUP_LEASE_MS),
            )
          : await dependencies.assets.findById(data.assetId);
      const stillOwned =
        asset !== null &&
        asset.cleanupAttempts === data.cleanupAttempt &&
        asset.cleanupLeaseUntil !== undefined &&
        asset.cleanupLeaseUntil > claimedAt &&
        (data.mode === "STAGING"
          ? asset.status === StoredAssetStatus.READY &&
            asset.stagingKey !== undefined
          : asset.status === StoredAssetStatus.DELETE_PENDING);
      if (!stillOwned) return;

      try {
        await performClaimedAssetCleanup(dependencies, asset, data.mode);
      } catch (error) {
        const finalAttempt =
          job.attemptsMade + 1 >=
          (job.opts.attempts ?? ASSET_CLEANUP_BULL_ATTEMPTS);
        if (finalAttempt) {
          await dependencies.assets.scheduleCleanupRetry(
            asset.id,
            new Date(
              now().getTime() +
                getAssetCleanupRetryDelay(asset.cleanupAttempts),
            ),
          );
        }
        dependencies.logger.warn(
          {
            errorCode: getAssetCleanupErrorCode(error),
            assetId: asset.id,
            purpose: asset.purpose,
            attempt: asset.cleanupAttempts,
            retryScheduled: finalAttempt,
          },
          "Stored asset cleanup failed",
        );
        if (finalAttempt) throw new UnrecoverableError("ASSET_CLEANUP_FAILED");
        throw error instanceof Error
          ? error
          : new Error("ASSET_CLEANUP_FAILED");
      }
    },
    {
      autorun: false,
      concurrency: 5,
      connection: workerConnection.connection,
      prefix,
    },
  );
  const unregisterQueueMetrics =
    dependencies.telemetry?.registerBackgroundQueue(
      ASSET_QUEUE_NAME,
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

  queue.on("error", (error) => {
    dependencies.logger.error({ err: error }, "Asset cleanup queue error");
  });
  worker.on("error", (error) => {
    dependencies.logger.error({ err: error }, "Asset cleanup worker error");
  });
  worker.on("completed", (job: Job<AssetCleanupJobData>) => {
    dependencies.telemetry?.recordBackgroundJob({
      durationSeconds:
        Math.max(
          0,
          (job.finishedOn ?? Date.now()) - (job.processedOn ?? Date.now()),
        ) / 1_000,
      job: job.name,
      queue: ASSET_QUEUE_NAME,
      result: "completed",
    });
  });
  worker.on("failed", (job: Job<AssetCleanupJobData> | undefined, error) => {
    dependencies.telemetry?.recordBackgroundJob({
      durationSeconds: job?.processedOn
        ? Math.max(0, Date.now() - job.processedOn) / 1_000
        : 0,
      job: job?.name ?? "unknown",
      queue: ASSET_QUEUE_NAME,
      result: "failed",
    });
    dependencies.logger.warn(
      {
        errorCode: getAssetCleanupErrorCode(error),
        bullMqJobId: job?.id,
        bullMqJobName: job?.name,
      },
      "Asset cleanup queue job failed",
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
      await queue.upsertJobScheduler(
        "asset-cleanup-reconcile-v1",
        { every: RECONCILE_INTERVAL_MS },
        {
          name: RECONCILE_JOB_NAME,
          data: { kind: "RECONCILE" },
          opts: retainedJobOptions,
        },
      );
      started = true;
      void worker.run().catch((error: unknown) => {
        dependencies.logger.error(
          { err: error },
          "Asset cleanup worker stopped",
        );
      });
    },
    async close() {
      started = false;
      unregisterQueueMetrics?.();
      await worker.close();
      await queue.close();
    },
  };
};
