import ServiceUnavailableError from "../../errors/ServiceUnavailableError.js";
import type { RedisClient } from "../../infrastructure/redis/index.js";
import type { TypingIdentity, TypingStore } from "./typing.store.js";

const MARK_TYPING_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local timeoutMs = tonumber(ARGV[3])
local expiredSocketIds = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", nowMs)
for _, expiredSocketId in ipairs(expiredSocketIds) do
  redis.call("SREM", ARGV[4] .. expiredSocketId, ARGV[2])
end
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
local firstSocket = redis.call("ZCARD", KEYS[1]) == 0
redis.call("ZADD", KEYS[1], nowMs + timeoutMs, ARGV[1])
redis.call("SADD", KEYS[2], ARGV[2])
redis.call("SADD", KEYS[3], ARGV[2])
redis.call("ZADD", KEYS[4], nowMs + timeoutMs, ARGV[2])
redis.call("PEXPIRE", KEYS[1], timeoutMs * 12)
redis.call("PEXPIRE", KEYS[2], timeoutMs * 3)
redis.call("PEXPIRE", KEYS[3], timeoutMs * 3)
if firstSocket then return 1 end
return 0
`;

const MARK_STOPPED_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
redis.call("ZREM", KEYS[1], ARGV[1])
redis.call("SREM", KEYS[2], ARGV[2])
local expiredSocketIds = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", nowMs)
for _, expiredSocketId in ipairs(expiredSocketIds) do
  redis.call("SREM", ARGV[3] .. expiredSocketId, ARGV[2])
end
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", nowMs)
if redis.call("ZCARD", KEYS[1]) == 0 then
  redis.call("DEL", KEYS[1])
  redis.call("SREM", KEYS[3], ARGV[2])
  if redis.call("ZREM", KEYS[4], ARGV[2]) == 1 then return 1 end
  return 0
end
local latest = redis.call("ZRANGE", KEYS[1], -1, -1, "WITHSCORES")
redis.call("ZADD", KEYS[4], tonumber(latest[2]), ARGV[2])
return 0
`;

const REMOVE_SOCKET_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local identities = redis.call("SMEMBERS", KEYS[1])
local stopped = {}
for _, identity in ipairs(identities) do
  local identityKey = ARGV[2] .. identity
  redis.call("ZREM", identityKey, ARGV[1])
  redis.call("ZREMRANGEBYSCORE", identityKey, "-inf", nowMs)
  if redis.call("ZCARD", identityKey) == 0 then
    local separator = string.find(identity, ":")
    local conversationId = string.sub(identity, 1, separator - 1)
    redis.call("DEL", identityKey)
    redis.call("SREM", ARGV[3] .. conversationId, identity)
    if redis.call("ZREM", KEYS[2], identity) == 1 then
      table.insert(stopped, identity)
    end
  else
    local latest = redis.call("ZRANGE", identityKey, -1, -1, "WITHSCORES")
    redis.call("ZADD", KEYS[2], tonumber(latest[2]), identity)
  end
end
redis.call("DEL", KEYS[1])
return stopped
`;

const CLEAR_USER_SCRIPT = `
local socketIds = redis.call("ZRANGE", KEYS[1], 0, -1)
for _, socketId in ipairs(socketIds) do
  redis.call("SREM", ARGV[2] .. socketId, ARGV[1])
end
redis.call("DEL", KEYS[1])
redis.call("SREM", KEYS[2], ARGV[1])
if redis.call("ZREM", KEYS[3], ARGV[1]) == 1 then return 1 end
return 0
`;

const CLEAR_CONVERSATION_SCRIPT = `
local identities = redis.call("SMEMBERS", KEYS[1])
local stopped = {}
for _, identity in ipairs(identities) do
  local identityKey = ARGV[1] .. identity
  local socketIds = redis.call("ZRANGE", identityKey, 0, -1)
  for _, socketId in ipairs(socketIds) do
    redis.call("SREM", ARGV[2] .. socketId, identity)
  end
  redis.call("DEL", identityKey)
  if redis.call("ZREM", KEYS[2], identity) == 1 then
    table.insert(stopped, identity)
  end
end
redis.call("DEL", KEYS[1])
return stopped
`;

const CLAIM_EXPIRED_SCRIPT = `
local now = redis.call("TIME")
local nowMs = (tonumber(now[1]) * 1000) + math.floor(tonumber(now[2]) / 1000)
local due = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", nowMs, "LIMIT", 0, tonumber(ARGV[4]))
local stopped = {}
for _, identity in ipairs(due) do
  local identityKey = ARGV[1] .. identity
  local expiredSocketIds = redis.call("ZRANGEBYSCORE", identityKey, "-inf", nowMs)
  for _, socketId in ipairs(expiredSocketIds) do
    redis.call("SREM", ARGV[2] .. socketId, identity)
  end
  redis.call("ZREMRANGEBYSCORE", identityKey, "-inf", nowMs)
  if redis.call("ZCARD", identityKey) == 0 then
    local separator = string.find(identity, ":")
    local conversationId = string.sub(identity, 1, separator - 1)
    redis.call("DEL", identityKey)
    redis.call("SREM", ARGV[3] .. conversationId, identity)
    redis.call("ZREM", KEYS[1], identity)
    table.insert(stopped, identity)
  else
    local latest = redis.call("ZRANGE", identityKey, -1, -1, "WITHSCORES")
    redis.call("ZADD", KEYS[1], tonumber(latest[2]), identity)
  end
end
return stopped
`;

const identityValue = ({ conversationId, userId }: TypingIdentity) =>
  `${conversationId}:${userId}`;

const parseIdentity = (value: string): TypingIdentity => {
  const [conversationId, userId, extra] = value.split(":");
  if (!conversationId || !userId || extra !== undefined) {
    throw new Error("Redis returned an invalid typing identity");
  }
  return { conversationId, userId };
};

const parseIdentities = (value: unknown) => {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error("Redis returned an invalid typing result");
  }
  return value.map(parseIdentity);
};

export const createRedisTypingStore = (
  client: RedisClient,
  keyPrefix: string,
  timeoutMs = 5_000,
): TypingStore => {
  const expiriesKey = `${keyPrefix}:typing:expiries`;
  const identityKeyPrefix = `${keyPrefix}:typing:identity:`;
  const socketKeyPrefix = `${keyPrefix}:typing:socket:`;
  const conversationKeyPrefix = `${keyPrefix}:typing:conversation:`;
  const identityKey = (identity: TypingIdentity) =>
    `${identityKeyPrefix}${identityValue(identity)}`;
  const socketKey = (socketId: string) => `${socketKeyPrefix}${socketId}`;
  const conversationKey = (conversationId: string) =>
    `${conversationKeyPrefix}${conversationId}`;
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
    async markTyping(identity, socketId) {
      const value = identityValue(identity);
      return (
        Number(
          await evaluate(
            MARK_TYPING_SCRIPT,
            [
              identityKey(identity),
              socketKey(socketId),
              conversationKey(identity.conversationId),
              expiriesKey,
            ],
            [socketId, value, String(timeoutMs), socketKeyPrefix],
          ),
        ) === 1
      );
    },
    async markStopped(identity, socketId) {
      const value = identityValue(identity);
      return (
        Number(
          await evaluate(
            MARK_STOPPED_SCRIPT,
            [
              identityKey(identity),
              socketKey(socketId),
              conversationKey(identity.conversationId),
              expiriesKey,
            ],
            [socketId, value, socketKeyPrefix],
          ),
        ) === 1
      );
    },
    async removeSocket(socketId) {
      return parseIdentities(
        await evaluate(
          REMOVE_SOCKET_SCRIPT,
          [socketKey(socketId), expiriesKey],
          [socketId, identityKeyPrefix, conversationKeyPrefix],
        ),
      );
    },
    async clearUser(identity) {
      const value = identityValue(identity);
      return (
        Number(
          await evaluate(
            CLEAR_USER_SCRIPT,
            [
              identityKey(identity),
              conversationKey(identity.conversationId),
              expiriesKey,
            ],
            [value, socketKeyPrefix],
          ),
        ) === 1
      );
    },
    async clearConversation(conversationId) {
      return parseIdentities(
        await evaluate(
          CLEAR_CONVERSATION_SCRIPT,
          [conversationKey(conversationId), expiriesKey],
          [identityKeyPrefix, socketKeyPrefix],
        ),
      );
    },
    async claimExpired(limit) {
      return parseIdentities(
        await evaluate(
          CLAIM_EXPIRED_SCRIPT,
          [expiriesKey],
          [
            identityKeyPrefix,
            socketKeyPrefix,
            conversationKeyPrefix,
            String(limit),
          ],
        ),
      );
    },
  };
};
