import ServiceUnavailableError from "../../errors/ServiceUnavailableError.js";
import type { RedisClient } from "../../infrastructure/redis/index.js";
import type { SocketConnectionStore } from "./socket-connection.store.js";

const ADD_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local maximum = tonumber(ARGV[2])
local leaseMs = tonumber(ARGV[3])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
if redis.call("ZSCORE", KEYS[1], ARGV[1]) then
  redis.call("ZADD", KEYS[1], nowMs + leaseMs, ARGV[1])
  redis.call("PEXPIRE", KEYS[1], leaseMs * 2)
  return 1
end
if redis.call("ZCARD", KEYS[1]) >= maximum then
  return 0
end
redis.call("ZADD", KEYS[1], nowMs + leaseMs, ARGV[1])
redis.call("PEXPIRE", KEYS[1], leaseMs * 2)
return 1
`;

const REFRESH_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local leaseMs = tonumber(ARGV[2])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
redis.call("ZADD", KEYS[1], nowMs + leaseMs, ARGV[1])
redis.call("PEXPIRE", KEYS[1], leaseMs * 2)
return 1
`;

const REMOVE_SCRIPT = `
redis.call("ZREM", KEYS[1], ARGV[1])
if redis.call("ZCARD", KEYS[1]) == 0 then
  redis.call("DEL", KEYS[1])
end
return 1
`;

const execute = async (
  client: RedisClient,
  script: string,
  key: string,
  arguments_: readonly string[],
) => {
  try {
    return await client.eval(script, {
      keys: [key],
      arguments: [...arguments_],
    });
  } catch {
    throw new ServiceUnavailableError("Runtime state is unavailable");
  }
};

export const createRedisSocketConnectionStore = (
  client: RedisClient,
  keyPrefix: string,
  leaseMs = 45_000,
): SocketConnectionStore => {
  const keyFor = (userId: string) => `${keyPrefix}:sockets:user:${userId}`;
  return {
    async add(userId, socketId, maximum) {
      const result = await execute(client, ADD_SCRIPT, keyFor(userId), [
        socketId,
        String(maximum),
        String(leaseMs),
      ]);
      return Number(result) === 1;
    },
    async refresh(userId, socketId) {
      await execute(client, REFRESH_SCRIPT, keyFor(userId), [
        socketId,
        String(leaseMs),
      ]);
    },
    async remove(userId, socketId) {
      await execute(client, REMOVE_SCRIPT, keyFor(userId), [socketId]);
    },
  };
};
