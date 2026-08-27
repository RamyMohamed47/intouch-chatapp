export const RateLimitAction = {
  DIRECT_MESSAGE_CREATE: "direct-message:create",
  MESSAGE_CREATE: "message:create",
  MESSAGE_MUTATE: "message:mutate",
  MESSAGE_REACTION: "message:reaction",
  READ_RECEIPT_UPDATE: "read-receipt:update",
  SOCKET_CONNECT: "socket:connect",
  SOCKET_SUBSCRIBE: "socket:subscribe",
  SOCKET_TYPING: "socket:typing",
} as const;

export type RateLimitAction =
  (typeof RateLimitAction)[keyof typeof RateLimitAction];

export interface TokenBucketPolicy {
  capacity: number;
  refillIntervalMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  notify: boolean;
  retryAfterMs: number;
}

export interface RateLimitStore {
  consume(
    key: string,
    policy: TokenBucketPolicy,
    now: Date,
  ): Promise<RateLimitDecision>;
  close(): void;
}

export interface AuthenticatedRateLimiter {
  consume(userId: string, action: RateLimitAction): Promise<RateLimitDecision>;
}
