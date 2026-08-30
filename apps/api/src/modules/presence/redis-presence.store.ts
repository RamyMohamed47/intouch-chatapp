import ServiceUnavailableError from "../../errors/ServiceUnavailableError.js";
import type { RedisClient } from "../../infrastructure/redis/index.js";
import type { PresenceStore } from "./presence.store.js";

const MARK_ONLINE_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local leaseMs = tonumber(ARGV[2])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
local firstSocket = redis.call("ZCARD", KEYS[1]) == 0
redis.call("ZADD", KEYS[1], nowMs + leaseMs, ARGV[1])
redis.call("ZADD", KEYS[2], nowMs + leaseMs, ARGV[3])
redis.call("ZREM", KEYS[3], ARGV[3])
redis.call("PEXPIRE", KEYS[1], leaseMs * 2)
if firstSocket then return 1 end
return 0
`;

const REFRESH_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local leaseMs = tonumber(ARGV[2])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
local firstSocket = redis.call("ZCARD", KEYS[1]) == 0
redis.call("ZADD", KEYS[1], nowMs + leaseMs, ARGV[1])
redis.call("ZADD", KEYS[2], nowMs + leaseMs, ARGV[3])
redis.call("PEXPIRE", KEYS[1], leaseMs * 2)
if firstSocket then return 1 end
return 0
`;

const MARK_OFFLINE_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
redis.call("ZREM", KEYS[1], ARGV[1])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
if redis.call("ZCARD", KEYS[1]) == 0 then
  redis.call("ZREM", KEYS[2], ARGV[2])
  redis.call("ZADD", KEYS[3], nowMs + tonumber(ARGV[3]), ARGV[2])
  return 1
end
local latest = redis.call("ZRANGE", KEYS[1], -1, -1, "WITHSCORES")
redis.call("ZADD", KEYS[2], tonumber(latest[2]), ARGV[2])
return 0
`;

const CONFIRM_OFFLINE_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
if redis.call("ZCARD", KEYS[1]) > 0 then
  local latest = redis.call("ZRANGE", KEYS[1], -1, -1, "WITHSCORES")
  redis.call("ZADD", KEYS[2], tonumber(latest[2]), ARGV[1])
  redis.call("ZREM", KEYS[3], ARGV[1])
  return 0
end
local dueAt = redis.call("ZSCORE", KEYS[3], ARGV[1])
if not dueAt or tonumber(dueAt) > nowMs then return 0 end
redis.call("DEL", KEYS[1])
redis.call("ZREM", KEYS[2], ARGV[1])
redis.call("ZREM", KEYS[3], ARGV[1])
return 1
`;

const IS_ONLINE_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local activeAt = redis.call("ZSCORE", KEYS[2], ARGV[1])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
if redis.call("ZCARD", KEYS[1]) == 0 then
  redis.call("ZREM", KEYS[2], ARGV[1])
  if activeAt and not redis.call("ZSCORE", KEYS[3], ARGV[1]) then
    redis.call("ZADD", KEYS[3], nowMs + tonumber(ARGV[2]), ARGV[1])
  end
  return 0
end
local latest = redis.call("ZRANGE", KEYS[1], -1, -1, "WITHSCORES")
redis.call("ZADD", KEYS[2], tonumber(latest[2]), ARGV[1])
return 1
`;

const CLAIM_EXPIRED_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local prefix = ARGV[1]
local offlineDelayMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local expiredUsers = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", nowMs, "LIMIT", 0, limit)
for _, userId in ipairs(expiredUsers) do
  local socketsKey = prefix .. userId .. ":sockets"
  redis.call("ZREMRANGEBYSCORE", socketsKey, "-inf", nowMs)
  if redis.call("ZCARD", socketsKey) == 0 then
    redis.call("ZREM", KEYS[1], userId)
    redis.call("ZADD", KEYS[2], nowMs + offlineDelayMs, userId)
  else
    local latest = redis.call("ZRANGE", socketsKey, -1, -1, "WITHSCORES")
    redis.call("ZADD", KEYS[1], tonumber(latest[2]), userId)
  end
end
local dueUsers = redis.call("ZRANGEBYSCORE", KEYS[2], "-inf", nowMs, "LIMIT", 0, limit)
local claimed = {}
for _, userId in ipairs(dueUsers) do
  local socketsKey = prefix .. userId .. ":sockets"
  redis.call("ZREMRANGEBYSCORE", socketsKey, "-inf", nowMs)
  if redis.call("ZCARD", socketsKey) == 0 then
    redis.call("DEL", socketsKey)
    redis.call("ZREM", KEYS[1], userId)
    redis.call("ZREM", KEYS[2], userId)
    table.insert(claimed, userId)
  else
    local latest = redis.call("ZRANGE", socketsKey, -1, -1, "WITHSCORES")
    redis.call("ZADD", KEYS[1], tonumber(latest[2]), userId)
    redis.call("ZREM", KEYS[2], userId)
  end
end
return claimed
`;

const toStringArray = (value: unknown) => {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error("Redis returned an invalid presence result");
  }
  return value;
};

export const createRedisPresenceStore = (
  client: RedisClient,
  keyPrefix: string,
  leaseMs = 45_000,
  offlineDelayMs = 5_000,
): PresenceStore => {
  const activeKey = `${keyPrefix}:presence:active`;
  const offlineDueKey = `${keyPrefix}:presence:offline-due`;
  const userKeyPrefix = `${keyPrefix}:presence:user:`;
  const socketsKey = (userId: string) => `${userKeyPrefix}${userId}:sockets`;
  const evaluate = async (
    script: string,
    keys: readonly string[],
    arguments_: readonly string[],
  ) => {
    try {
      return await client.eval(script, {
        keys: [...keys],
        arguments: [...arguments_],
      });
    } catch {
      throw new ServiceUnavailableError("Runtime state is unavailable");
    }
  };

  return {
    async markOnline(userId, socketId) {
      return (
        Number(
          await evaluate(
            MARK_ONLINE_SCRIPT,
            [socketsKey(userId), activeKey, offlineDueKey],
            [socketId, String(leaseMs), userId],
          ),
        ) === 1
      );
    },
    async refresh(userId, socketId) {
      return (
        Number(
          await evaluate(
            REFRESH_SCRIPT,
            [socketsKey(userId), activeKey],
            [socketId, String(leaseMs), userId],
          ),
        ) === 1
      );
    },
    async markOffline(userId, socketId) {
      return (
        Number(
          await evaluate(
            MARK_OFFLINE_SCRIPT,
            [socketsKey(userId), activeKey, offlineDueKey],
            [socketId, userId, String(offlineDelayMs)],
          ),
        ) === 1
      );
    },
    async confirmOffline(userId) {
      return (
        Number(
          await evaluate(
            CONFIRM_OFFLINE_SCRIPT,
            [socketsKey(userId), activeKey, offlineDueKey],
            [userId],
          ),
        ) === 1
      );
    },
    async isOnline(userId) {
      return (
        Number(
          await evaluate(
            IS_ONLINE_SCRIPT,
            [socketsKey(userId), activeKey, offlineDueKey],
            [userId, String(offlineDelayMs)],
          ),
        ) === 1
      );
    },
    async claimExpired(limit) {
      return toStringArray(
        await evaluate(
          CLAIM_EXPIRED_SCRIPT,
          [activeKey, offlineDueKey],
          [userKeyPrefix, String(offlineDelayMs), String(limit)],
        ),
      );
    },
  };
};
