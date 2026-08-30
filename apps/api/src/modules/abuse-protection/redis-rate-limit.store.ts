import ServiceUnavailableError from "../../errors/ServiceUnavailableError.js";
import type { RedisClient } from "../../infrastructure/redis/index.js";
import type { RateLimitDecision, RateLimitStore } from "./rate-limit.types.js";

const TOKEN_BUCKET_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local capacity = tonumber(ARGV[1])
local refillIntervalMs = tonumber(ARGV[2])
local idleTtlMs = tonumber(ARGV[3])
local current = redis.call("HMGET", KEYS[1], "tokens", "updatedAtMs", "limitedNotified")
local tokens = tonumber(current[1]) or capacity
local updatedAtMs = tonumber(current[2]) or nowMs
local limitedNotified = tonumber(current[3]) or 0
local elapsedMs = math.max(0, nowMs - updatedAtMs)
local refilledTokens = math.min(capacity, tokens + (elapsedMs / refillIntervalMs))
local allowed = 0
local notify = 0
local retryAfterMs = 0

if refilledTokens >= 1 then
  allowed = 1
  refilledTokens = refilledTokens - 1
  limitedNotified = 0
else
  if limitedNotified == 0 then
    notify = 1
  end
  limitedNotified = 1
  retryAfterMs = math.max(1, math.ceil((1 - refilledTokens) * refillIntervalMs))
end

redis.call(
  "HSET",
  KEYS[1],
  "tokens", tostring(refilledTokens),
  "updatedAtMs", tostring(nowMs),
  "limitedNotified", tostring(limitedNotified)
)
redis.call("PEXPIRE", KEYS[1], idleTtlMs)
return { allowed, notify, retryAfterMs }
`;

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number.NaN;
};

export const createRedisRateLimitStore = (
  client: RedisClient,
  keyPrefix: string,
  idleTtlMs = 15 * 60 * 1000,
): RateLimitStore => ({
  async consume(key, policy) {
    try {
      const result: unknown = await client.eval(TOKEN_BUCKET_SCRIPT, {
        keys: [`${keyPrefix}:rate:${key}`],
        arguments: [
          String(policy.capacity),
          String(policy.refillIntervalMs),
          String(idleTtlMs),
        ],
      });
      if (!Array.isArray(result) || result.length !== 3) {
        throw new Error("Redis returned an invalid token-bucket result");
      }
      const allowed = toNumber(result[0]);
      const notify = toNumber(result[1]);
      const retryAfterMs = toNumber(result[2]);
      if (
        !Number.isFinite(allowed) ||
        !Number.isFinite(notify) ||
        !Number.isFinite(retryAfterMs)
      ) {
        throw new Error("Redis returned an invalid token-bucket value");
      }
      return {
        allowed: allowed === 1,
        notify: notify === 1,
        retryAfterMs,
      } satisfies RateLimitDecision;
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error;
      throw new ServiceUnavailableError("Runtime state is unavailable");
    }
  },
  close() {},
});
