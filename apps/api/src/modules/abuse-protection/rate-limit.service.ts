import type {
  AuthenticatedRateLimiter,
  RateLimitAction,
  RateLimitStore,
  TokenBucketPolicy,
} from "./rate-limit.types.js";
import { RateLimitAction as Action } from "./rate-limit.types.js";

const balancedPolicies: Readonly<Record<RateLimitAction, TokenBucketPolicy>> = {
  [Action.DIRECT_MESSAGE_CREATE]: { capacity: 5, refillIntervalMs: 12_000 },
  [Action.MESSAGE_CREATE]: { capacity: 10, refillIntervalMs: 2_000 },
  [Action.MESSAGE_MUTATE]: { capacity: 10, refillIntervalMs: 3_000 },
  [Action.READ_RECEIPT_UPDATE]: { capacity: 30, refillIntervalMs: 500 },
  [Action.SOCKET_CONNECT]: { capacity: 10, refillIntervalMs: 3_000 },
  [Action.SOCKET_SUBSCRIBE]: { capacity: 20, refillIntervalMs: 1_000 },
  [Action.SOCKET_TYPING]: { capacity: 10, refillIntervalMs: 2_000 },
};

export interface RateLimitServiceDependencies {
  now?: () => Date;
  onLimited?: (event: {
    action: RateLimitAction;
    retryAfterMs: number;
    userId: string;
  }) => void;
  policies?: Readonly<Record<RateLimitAction, TokenBucketPolicy>>;
  store: RateLimitStore;
}

const createRateLimitService = ({
  now = () => new Date(),
  onLimited = () => undefined,
  policies = balancedPolicies,
  store,
}: RateLimitServiceDependencies): AuthenticatedRateLimiter => ({
  async consume(userId, action) {
    const decision = await store.consume(
      `${action}:${userId}`,
      policies[action],
      now(),
    );
    if (!decision.allowed && decision.notify) {
      onLimited({ action, retryAfterMs: decision.retryAfterMs, userId });
    }
    return decision;
  },
});

export { balancedPolicies };
export default createRateLimitService;
