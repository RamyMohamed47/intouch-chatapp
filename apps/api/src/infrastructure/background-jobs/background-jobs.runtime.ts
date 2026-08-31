import type { Logger } from "pino";

export interface BackgroundJobComponent {
  close(): Promise<void>;
  isReady(): boolean;
  start(): Promise<void>;
}

export interface BackgroundJobTelemetry {
  recordBackgroundJob(input: {
    durationSeconds: number;
    job: string;
    queue: string;
    result: "completed" | "failed";
  }): void;
  registerBackgroundQueue(
    queue: string,
    check: () => Promise<Record<string, number>>,
  ): () => unknown;
}

export interface BackgroundJobsRuntime extends BackgroundJobComponent {
  provider: "bullmq" | "polling";
}

export const createPollingBackgroundJobsRuntime = (
  components: readonly {
    close(): Promise<void>;
    start(): void;
  }[],
): BackgroundJobsRuntime => ({
  provider: "polling",
  isReady: () => true,
  start() {
    for (const component of components) component.start();
    return Promise.resolve();
  },
  async close() {
    await Promise.allSettled(components.map((component) => component.close()));
  },
});

export const createBullMqBackgroundJobsRuntime = (
  components: readonly BackgroundJobComponent[],
  logger: Logger,
): BackgroundJobsRuntime => ({
  provider: "bullmq",
  isReady: () => components.every((component) => component.isReady()),
  async start() {
    try {
      await Promise.all(components.map((component) => component.start()));
      logger.info(
        { backgroundJobsProvider: "bullmq" },
        "Background jobs provider ready",
      );
    } catch (error) {
      await Promise.allSettled(
        components.map((component) => component.close()),
      );
      throw error;
    }
  },
  async close() {
    await Promise.allSettled(components.map((component) => component.close()));
  },
});
