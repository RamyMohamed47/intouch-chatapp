import type { Logger } from "pino";

import createInMemoryRateLimitStore from "./rate-limit.store.js";
import createRateLimitService from "./rate-limit.service.js";
import createInMemorySocketConnectionStore from "./socket-connection.store.js";
import createSocketConnectionService from "./socket-connection.service.js";

const createAbuseProtectionModule = (logger: Logger) => {
  const store = createInMemoryRateLimitStore();
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
    store: createInMemorySocketConnectionStore(),
  });

  return {
    close: () => store.close(),
    rateLimits,
    socketConnections,
  };
};

export { default as createInMemoryRateLimitStore } from "./rate-limit.store.js";
export { default as createRateLimitService } from "./rate-limit.service.js";
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
