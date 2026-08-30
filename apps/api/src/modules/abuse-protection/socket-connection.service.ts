import { RateLimitAction } from "./rate-limit.types.js";
import type { AuthenticatedRateLimiter } from "./rate-limit.types.js";
import type { SocketConnectionStore } from "./socket-connection.store.js";

export interface SocketConnectionDecision {
  allowed: boolean;
  retryAfterMs: number;
}

export interface SocketConnectionGuard {
  admit(userId: string, socketId: string): Promise<SocketConnectionDecision>;
  refresh?(userId: string, socketId: string): Promise<void>;
  release(userId: string, socketId: string): Promise<void>;
}

export interface SocketConnectionServiceDependencies {
  activeConnectionRetryMs?: number;
  maximumConnections?: number;
  rateLimits: AuthenticatedRateLimiter;
  store: SocketConnectionStore;
}

const createSocketConnectionService = ({
  activeConnectionRetryMs = 15_000,
  maximumConnections = 5,
  rateLimits,
  store,
}: SocketConnectionServiceDependencies): SocketConnectionGuard => ({
  async admit(userId, socketId) {
    const attempt = await rateLimits.consume(
      userId,
      RateLimitAction.SOCKET_CONNECT,
    );
    if (!attempt.allowed) {
      return { allowed: false, retryAfterMs: attempt.retryAfterMs };
    }
    if (!(await store.add(userId, socketId, maximumConnections))) {
      return { allowed: false, retryAfterMs: activeConnectionRetryMs };
    }
    return { allowed: true, retryAfterMs: 0 };
  },

  release(userId, socketId) {
    return store.remove(userId, socketId);
  },
  refresh(userId, socketId) {
    return store.refresh(userId, socketId);
  },
});

export default createSocketConnectionService;
