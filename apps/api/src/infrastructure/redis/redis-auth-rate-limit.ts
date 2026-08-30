import { RedisStore, type RedisReply } from "rate-limit-redis";

import ServiceUnavailableError from "../../errors/ServiceUnavailableError.js";
import type { RedisClient } from "./redis.runtime.js";

export const createRedisAuthRateLimitStoreFactory =
  (client: RedisClient, keyPrefix: string) => (limiter: string) =>
    new RedisStore({
      prefix: `${keyPrefix}:auth-rate:${limiter}:`,
      async sendCommand(...args: string[]): Promise<RedisReply> {
        try {
          return await client.sendCommand(args);
        } catch {
          throw new ServiceUnavailableError("Runtime state is unavailable");
        }
      },
    });
