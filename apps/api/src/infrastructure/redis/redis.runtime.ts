import { createClient } from "redis";
import type { Logger } from "pino";

import type { RuntimeStateConfig } from "../../config/env.js";

const createRuntimeClient = (url: string) =>
  createClient({
    url,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 2_000),
    },
  });

export type RedisClient = ReturnType<typeof createRuntimeClient>;

export interface RedisRuntime {
  close(): Promise<void>;
  command?: RedisClient;
  connect(): Promise<void>;
  isReady(): boolean;
  keyPrefix: string;
  provider: "memory" | "redis";
  publisher?: RedisClient;
  subscriber?: RedisClient;
}

const connectWithDeadline = async (
  clients: readonly RedisClient[],
  timeoutMs: number,
) => {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.all(clients.map((client) => client.connect())),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Redis startup connection timed out")),
          timeoutMs,
        );
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const closeClient = async (client: RedisClient) => {
  if (!client.isOpen) return;
  await client.close();
};

export const createRedisRuntime = (
  config: RuntimeStateConfig,
  logger: Logger,
): RedisRuntime => {
  if (config.provider === "memory") {
    return {
      async close() {},
      connect() {
        logger.info(
          { runtimeStateProvider: config.provider },
          "Runtime state provider ready",
        );
        return Promise.resolve();
      },
      isReady: () => true,
      keyPrefix: config.keyPrefix,
      provider: config.provider,
    };
  }

  const command = createRuntimeClient(config.url);
  const publisher = createRuntimeClient(config.url);
  const subscriber = createRuntimeClient(config.url);
  const clients = [command, publisher, subscriber] as const;

  for (const [role, client] of [
    ["command", command],
    ["publisher", publisher],
    ["subscriber", subscriber],
  ] as const) {
    client.on("error", (error) => {
      logger.error({ err: error, redisRole: role }, "Redis client error");
    });
    client.on("reconnecting", () => {
      logger.warn({ redisRole: role }, "Redis client reconnecting");
    });
  }

  return {
    command,
    publisher,
    subscriber,
    provider: config.provider,
    keyPrefix: config.keyPrefix,
    isReady: () => clients.every((client) => client.isReady),
    async connect() {
      try {
        await connectWithDeadline(clients, 30_000);
      } catch (error) {
        await Promise.allSettled(clients.map(closeClient));
        throw error;
      }
      logger.info(
        { runtimeStateProvider: config.provider },
        "Runtime state provider ready",
      );
    },
    async close() {
      await Promise.allSettled(clients.map(closeClient));
    },
  };
};
