import type { Logger } from "pino";

import createInMemoryRateLimitStore from "./rate-limit.store.js";
import createRateLimitService from "./rate-limit.service.js";
import createInMemorySocketConnectionStore from "./socket-connection.store.js";
import createSocketConnectionService from "./socket-connection.service.js";
import type { RateLimitStore } from "./rate-limit.types.js";
import type { SocketConnectionStore } from "./socket-connection.store.js";

export interface AbuseProtectionModuleOptions {
  rateLimitStore?: RateLimitStore;
  socketConnectionStore?: SocketConnectionStore;
}

const createAbuseProtectionModule = (
  logger: Logger,
  options: AbuseProtectionModuleOptions = {},
) => {
  const store = options.rateLimitStore ?? createInMemoryRateLimitStore();
  const rateLimits = createRateLimitService({
    store,
    onLimited: ({ action, retryAfterMs, userId }) => {
      logger.warn(
        { action, retryAfterMs, userId },
        "Authenticated action rate limited",
      );
    },
  });
  const socketConnections = createSocketConnectionService({
    rateLimits,
    store:
      options.socketConnectionStore ?? createInMemorySocketConnectionStore(),
  });

  return {
    close: () => store.close(),
    rateLimits,
    socketConnections,
  };
};

export { default as createInMemoryRateLimitStore } from "./rate-limit.store.js";
export { default as createRateLimitService } from "./rate-limit.service.js";
export { createRedisRateLimitStore } from "./redis-rate-limit.store.js";
export { createRedisSocketConnectionStore } from "./redis-socket-connection.store.js";
export { default as createInMemorySocketConnectionStore } from "./socket-connection.store.js";
export { default as createSocketConnectionService } from "./socket-connection.service.js";
export { RateLimitAction } from "./rate-limit.types.js";
export type {
  AuthenticatedRateLimiter,
  RateLimitDecision,
  RateLimitStore,
  TokenBucketPolicy,
} from "./rate-limit.types.js";
export type { SocketConnectionStore } from "./socket-connection.store.js";
export type { SocketConnectionGuard } from "./socket-connection.service.js";
export default createAbuseProtectionModule;
