import { createNodeRedisClient } from "bullmq";
import { createClient } from "redis";
import type { Logger } from "pino";

const createClientOptions = (url: string) => ({
  url,
  socket: {
    connectTimeout: 5_000,
    reconnectStrategy: (retries: number) => Math.min(100 * 2 ** retries, 2_000),
  },
});

export const createBullMqConnection = (
  url: string,
  role: string,
  logger: Logger,
) => {
  const client = createClient(createClientOptions(url));
  client.on("error", (error) => {
    logger.error({ err: error, bullMqRole: role }, "BullMQ Redis client error");
  });
  client.on("reconnecting", () => {
    logger.warn({ bullMqRole: role }, "BullMQ Redis client reconnecting");
  });
  return {
    connection: createNodeRedisClient(client),
    isReady: () => client.isReady,
  };
};
