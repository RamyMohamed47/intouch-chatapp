import { Queue, Worker } from "bullmq";
import type { Logger } from "pino";
import { z } from "zod";

import { createBullMqConnection } from "../../infrastructure/background-jobs/index.js";
import type {
  BackgroundJobComponent,
  BackgroundJobTelemetry,
} from "../../infrastructure/background-jobs/index.js";

export const VoiceCallJobKind = {
  CONNECT_TIMEOUT: "CONNECT_TIMEOUT",
  DISCONNECT_TIMEOUT: "DISCONNECT_TIMEOUT",
  RING_TIMEOUT: "RING_TIMEOUT",
  RECONCILE: "RECONCILE",
} as const;

export type VoiceCallJobKindValue =
  (typeof VoiceCallJobKind)[keyof typeof VoiceCallJobKind];

const voiceCallJobSchema = z.discriminatedUnion("kind", [
  z
    .object({
      callId: z.string().regex(/^[a-f\d]{24}$/i),
      kind: z.enum([
        VoiceCallJobKind.CONNECT_TIMEOUT,
        VoiceCallJobKind.DISCONNECT_TIMEOUT,
        VoiceCallJobKind.RING_TIMEOUT,
      ]),
    })
    .strict(),
  z.object({ kind: z.literal(VoiceCallJobKind.RECONCILE) }).strict(),
]);

type VoiceCallJobData = z.infer<typeof voiceCallJobSchema>;
type VoiceCallJobHandler = (data: VoiceCallJobData) => Promise<void>;

export interface VoiceCallJobs extends BackgroundJobComponent {
  schedule(
    callId: string,
    kind: VoiceCallJobKindValue,
    delayMs: number,
  ): Promise<void>;
  setHandler(handler: VoiceCallJobHandler): void;
}

export const createInMemoryVoiceCallJobs = (): VoiceCallJobs => {
  let handler: VoiceCallJobHandler | undefined;
  const timers = new Set<NodeJS.Timeout>();
  let reconcileTimer: NodeJS.Timeout | undefined;
  return {
    isReady: () => true,
    start() {
      if (!reconcileTimer) {
        reconcileTimer = setInterval(() => {
          void handler?.({ kind: VoiceCallJobKind.RECONCILE });
        }, 30_000);
        reconcileTimer.unref();
      }
      return Promise.resolve();
    },
    setHandler(next) {
      handler = next;
    },
    schedule(callId, kind, delayMs) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        void handler?.({ callId, kind });
      }, delayMs);
      timer.unref();
      timers.add(timer);
      return Promise.resolve();
    },
    close() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (reconcileTimer) clearInterval(reconcileTimer);
      reconcileTimer = undefined;
      return Promise.resolve();
    },
  };
};

export const createBullMqVoiceCallJobs = (dependencies: {
  logger: Logger;
  redisKeyPrefix: string;
  redisUrl: string;
  telemetry?: BackgroundJobTelemetry;
}): VoiceCallJobs => {
  const queueName = "voice-call-lifecycle";
  const prefix = `${dependencies.redisKeyPrefix}:bullmq`;
  const queueConnection = createBullMqConnection(
    dependencies.redisUrl,
    "voice-call-queue",
    dependencies.logger,
  );
  const workerConnection = createBullMqConnection(
    dependencies.redisUrl,
    "voice-call-worker",
    dependencies.logger,
  );
  const queue = new Queue<VoiceCallJobData>(queueName, {
    connection: queueConnection.connection,
    prefix,
  });
  let handler: VoiceCallJobHandler | undefined;
  const worker = new Worker<VoiceCallJobData>(
    queueName,
    async (job) => {
      const data = voiceCallJobSchema.parse(job.data);
      if (!handler) throw new Error("Voice call job handler is unavailable");
      await handler(data);
    },
    {
      autorun: false,
      concurrency: 10,
      connection: workerConnection.connection,
      prefix,
    },
  );
  let started = false;
  const unregisterQueueMetrics =
    dependencies.telemetry?.registerBackgroundQueue(queueName, async () => {
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
    });

  queue.on("error", (error) => {
    dependencies.logger.error({ err: error }, "Voice call queue error");
  });
  worker.on("error", (error) => {
    dependencies.logger.error({ err: error }, "Voice call worker error");
  });
  worker.on("completed", (job) => {
    dependencies.telemetry?.recordBackgroundJob({
      durationSeconds:
        Math.max(
          0,
          (job.finishedOn ?? Date.now()) - (job.processedOn ?? Date.now()),
        ) / 1_000,
      job: job.name,
      queue: queueName,
      result: "completed",
    });
  });
  worker.on("failed", (job) => {
    dependencies.telemetry?.recordBackgroundJob({
      durationSeconds: job?.processedOn
        ? Math.max(0, Date.now() - job.processedOn) / 1_000
        : 0,
      job: job?.name ?? "unknown",
      queue: queueName,
      result: "failed",
    });
  });

  return {
    isReady: () =>
      started &&
      queueConnection.isReady() &&
      workerConnection.isReady() &&
      worker.isRunning(),
    setHandler(next) {
      handler = next;
    },
    async schedule(callId, kind, delayMs) {
      await queue.add(
        kind.toLowerCase(),
        { callId, kind },
        {
          delay: delayMs,
          jobId: `${kind.toLowerCase()}-${callId}`,
          removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 2_000 },
        },
      );
    },
    async start() {
      if (started) return;
      await Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]);
      await queue.upsertJobScheduler(
        "voice-session-reconciliation",
        { every: 30_000 },
        {
          name: "reconcile",
          data: { kind: VoiceCallJobKind.RECONCILE },
          opts: {
            removeOnComplete: { age: 60 * 60, count: 100 },
            removeOnFail: { age: 24 * 60 * 60, count: 500 },
          },
        },
      );
      started = true;
      void worker.run().catch((error: unknown) => {
        dependencies.logger.error({ err: error }, "Voice call worker stopped");
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
