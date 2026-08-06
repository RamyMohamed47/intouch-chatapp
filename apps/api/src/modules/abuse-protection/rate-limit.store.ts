import type { RateLimitDecision, RateLimitStore } from "./rate-limit.types.js";

interface TokenBucketEntry {
  lastSeenAtMs: number;
  limitedNotified: boolean;
  tokens: number;
  updatedAtMs: number;
}

export interface InMemoryRateLimitStoreOptions {
  idleTtlMs?: number;
  now?: () => Date;
  sweepIntervalMs?: number;
}

const createInMemoryRateLimitStore = ({
  idleTtlMs = 15 * 60 * 1000,
  now = () => new Date(),
  sweepIntervalMs = 5 * 60 * 1000,
}: InMemoryRateLimitStoreOptions = {}): RateLimitStore => {
  const entries = new Map<string, TokenBucketEntry>();
  const prune = () => {
    const cutoff = now().getTime() - idleTtlMs;
    for (const [key, entry] of entries) {
      if (entry.lastSeenAtMs < cutoff) entries.delete(key);
    }
  };
  const sweepTimer = setInterval(prune, sweepIntervalMs);
  sweepTimer.unref();

  return {
    consume(key, policy, currentTime) {
      const nowMs = currentTime.getTime();
      const current = entries.get(key) ?? {
        lastSeenAtMs: nowMs,
        limitedNotified: false,
        tokens: policy.capacity,
        updatedAtMs: nowMs,
      };
      const elapsedMs = Math.max(0, nowMs - current.updatedAtMs);
      const refilledTokens = Math.min(
        policy.capacity,
        current.tokens + elapsedMs / policy.refillIntervalMs,
      );

      if (refilledTokens >= 1) {
        entries.set(key, {
          lastSeenAtMs: nowMs,
          limitedNotified: false,
          tokens: refilledTokens - 1,
          updatedAtMs: nowMs,
        });
        return Promise.resolve({
          allowed: true,
          notify: false,
          retryAfterMs: 0,
        });
      }

      const notify = !current.limitedNotified;
      entries.set(key, {
        lastSeenAtMs: nowMs,
        limitedNotified: true,
        tokens: refilledTokens,
        updatedAtMs: nowMs,
      });
      return Promise.resolve({
        allowed: false,
        notify,
        retryAfterMs: Math.max(
          1,
          Math.ceil((1 - refilledTokens) * policy.refillIntervalMs),
        ),
      } satisfies RateLimitDecision);
    },

    close() {
      clearInterval(sweepTimer);
      entries.clear();
    },
  };
};

export default createInMemoryRateLimitStore;
