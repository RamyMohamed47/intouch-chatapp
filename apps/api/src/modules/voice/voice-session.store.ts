import ServiceUnavailableError from "../../errors/ServiceUnavailableError.js";
import type { RedisClient } from "../../infrastructure/redis/index.js";
import type { VoiceSessionRecord } from "./voice.types.js";

export interface VoiceReservationResult {
  capacityExceeded: boolean;
  conflict: VoiceSessionRecord | null;
  replaced: VoiceSessionRecord[];
}

export interface VoiceSessionStore {
  activate(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<VoiceSessionRecord | null>;
  claimWebhook(eventId: string): Promise<boolean>;
  getById(sessionId: string): Promise<VoiceSessionRecord | null>;
  getByUser(userId: string): Promise<VoiceSessionRecord | null>;
  heartbeat(userId: string, sessionId: string): Promise<boolean>;
  listByConversation(conversationId: string): Promise<VoiceSessionRecord[]>;
  listReserved(): Promise<VoiceSessionRecord[]>;
  listReservedByConversation(
    conversationId: string,
  ): Promise<VoiceSessionRecord[]>;
  markDisconnected(
    userId: string,
    sessionId: string,
  ): Promise<VoiceSessionRecord | null>;
  releaseUsers(userIds: readonly string[]): Promise<VoiceSessionRecord[]>;
  releaseSessions(
    sessions: readonly Pick<
      VoiceSessionRecord,
      "id" | "userId" | "conversationId"
    >[],
  ): Promise<VoiceSessionRecord[]>;
  reserve(
    sessions: readonly VoiceSessionRecord[],
    replaceUserId?: string,
    maxConversationParticipants?: number,
  ): Promise<VoiceReservationResult>;
}

interface StoredVoiceSession {
  record: VoiceSessionRecord;
  expiresAt: number;
}

const PENDING_TTL_MS = 2 * 60 * 1000;
const ACTIVE_TTL_MS = 90 * 1000;
const WEBHOOK_TTL_MS = 24 * 60 * 60 * 1000;

/* eslint-disable @typescript-eslint/require-await -- The in-memory adapter implements the async store contract synchronously. */
export const createInMemoryVoiceSessionStore = (): VoiceSessionStore => {
  const byUser = new Map<string, StoredVoiceSession>();
  const webhookIds = new Map<string, number>();

  const getCurrent = (userId: string) => {
    const stored = byUser.get(userId);
    if (!stored) return null;
    if (stored.expiresAt <= Date.now()) {
      byUser.delete(userId);
      return null;
    }
    return stored;
  };

  return {
    async reserve(sessions, replaceUserId, maxConversationParticipants) {
      const replaced: VoiceSessionRecord[] = [];
      for (const session of sessions) {
        const current = getCurrent(session.userId);
        if (!current) continue;
        if (session.userId !== replaceUserId) {
          return {
            capacityExceeded: false,
            conflict: current.record,
            replaced: [],
          };
        }
        replaced.push(current.record);
      }
      if (maxConversationParticipants !== undefined) {
        const conversationId = sessions[0]?.conversationId;
        const candidateUserIds = new Set(sessions.map(({ userId }) => userId));
        const retainedCount = conversationId
          ? [...byUser.keys()]
              .map((userId) => getCurrent(userId)?.record)
              .filter(
                (record) =>
                  record?.conversationId === conversationId &&
                  !candidateUserIds.has(record.userId),
              ).length
          : 0;
        if (
          retainedCount + candidateUserIds.size >
          maxConversationParticipants
        ) {
          return {
            capacityExceeded: true,
            conflict: null,
            replaced: [],
          };
        }
      }
      for (const session of sessions) {
        byUser.set(session.userId, {
          record: session,
          expiresAt: Date.now() + PENDING_TTL_MS,
        });
      }
      return { capacityExceeded: false, conflict: null, replaced };
    },
    async getByUser(userId) {
      return getCurrent(userId)?.record ?? null;
    },
    async getById(sessionId) {
      return (
        [...byUser.keys()]
          .map((userId) => getCurrent(userId)?.record)
          .find((record) => record?.id === sessionId) ?? null
      );
    },
    async activate(userId, sessionId, now) {
      const current = getCurrent(userId);
      if (!current || current.record.id !== sessionId) return null;
      current.record = { ...current.record, connectedAt: now };
      current.expiresAt = Date.now() + ACTIVE_TTL_MS;
      return current.record;
    },
    async heartbeat(userId, sessionId) {
      const current = getCurrent(userId);
      if (!current || current.record.id !== sessionId) return false;
      current.expiresAt = Date.now() + ACTIVE_TTL_MS;
      return true;
    },
    async markDisconnected(userId, sessionId) {
      const current = getCurrent(userId);
      if (!current || current.record.id !== sessionId) return null;
      current.record = { ...current.record, connectedAt: null };
      current.expiresAt = Date.now() + 15_000;
      return current.record;
    },
    async releaseUsers(userIds) {
      const released: VoiceSessionRecord[] = [];
      for (const userId of userIds) {
        const current = getCurrent(userId);
        if (current) released.push(current.record);
        byUser.delete(userId);
      }
      return released;
    },
    async releaseSessions(sessions) {
      const released: VoiceSessionRecord[] = [];
      for (const session of sessions) {
        const current = getCurrent(session.userId);
        if (current?.record.id === session.id) {
          released.push(current.record);
          byUser.delete(session.userId);
        }
      }
      return released;
    },
    async listByConversation(conversationId) {
      return [...byUser.keys()]
        .map((userId) => getCurrent(userId)?.record)
        .filter(
          (record): record is VoiceSessionRecord =>
            record?.conversationId === conversationId &&
            record.connectedAt !== null,
        );
    },
    async listReservedByConversation(conversationId) {
      return [...byUser.keys()]
        .map((userId) => getCurrent(userId)?.record)
        .filter(
          (record): record is VoiceSessionRecord =>
            record?.conversationId === conversationId,
        );
    },
    async listReserved() {
      return [...byUser.keys()]
        .map((userId) => getCurrent(userId)?.record)
        .filter((record): record is VoiceSessionRecord => record !== undefined);
    },
    async claimWebhook(eventId) {
      const now = Date.now();
      for (const [id, expiresAt] of webhookIds) {
        if (expiresAt <= now) webhookIds.delete(id);
      }
      if (webhookIds.has(eventId)) return false;
      webhookIds.set(eventId, now + WEBHOOK_TTL_MS);
      return true;
    },
  };
};
/* eslint-enable @typescript-eslint/require-await */

const RESERVE_SCRIPT = `
local sessionCount = tonumber(ARGV[1])
local replaceUserId = ARGV[2]
local ttlMs = tonumber(ARGV[3])
local capacity = tonumber(ARGV[4])
local conversationKey = KEYS[(sessionCount * 2) + 1]
local sessionsKey = KEYS[(sessionCount * 2) + 2]
local replaced = {}
for i = 1, sessionCount do
  local current = redis.call("GET", KEYS[i])
  local candidate = cjson.decode(ARGV[i + 4])
  if current then
    local decoded = cjson.decode(current)
    if candidate.userId ~= replaceUserId then
      return {0, current}
    end
    table.insert(replaced, current)
  end
end
if capacity > 0 then
  local additions = 0
  for i = 1, sessionCount do
    local candidate = cjson.decode(ARGV[i + 4])
    if redis.call("HEXISTS", conversationKey, candidate.userId) == 0 then
      additions = additions + 1
    end
  end
  if redis.call("HLEN", conversationKey) + additions > capacity then
    return {-1}
  end
end
for i = 1, sessionCount do
  local serialized = ARGV[i + 4]
  local candidate = cjson.decode(serialized)
  redis.call("SET", KEYS[i], serialized, "PX", ttlMs)
  redis.call("SET", KEYS[sessionCount + i], candidate.userId, "PX", ttlMs)
  redis.call("HSET", conversationKey, candidate.userId, serialized)
  redis.call("HSET", sessionsKey, candidate.userId, serialized)
end
redis.call("PEXPIRE", conversationKey, ttlMs * 2)
local response = {1, tostring(#replaced)}
for i = 1, #replaced do table.insert(response, replaced[i]) end
return response
`;

const ACTIVATE_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then return nil end
local decoded = cjson.decode(current)
if decoded.id ~= ARGV[1] then return nil end
decoded.connectedAt = ARGV[2]
local updated = cjson.encode(decoded)
redis.call("SET", KEYS[1], updated, "PX", tonumber(ARGV[3]))
redis.call("HSET", KEYS[2], decoded.userId, updated)
redis.call("HSET", KEYS[3], decoded.userId, updated)
redis.call("PEXPIRE", KEYS[2], tonumber(ARGV[3]) * 2)
return updated
`;

const HEARTBEAT_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then return 0 end
local decoded = cjson.decode(current)
if decoded.id ~= ARGV[1] then return 0 end
redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[2]))
if decoded.connectedAt then
  redis.call("HSET", KEYS[2], decoded.userId, current)
  redis.call("HSET", KEYS[3], decoded.userId, current)
  redis.call("PEXPIRE", KEYS[2], tonumber(ARGV[2]) * 2)
end
return 1
`;

const parseRecord = (value: string): VoiceSessionRecord => {
  const parsed = JSON.parse(value) as Omit<
    VoiceSessionRecord,
    "participantIdentity"
  > & {
    participantIdentity?: string;
    connectedAt: string | null;
  };
  return {
    ...parsed,
    participantIdentity: parsed.participantIdentity ?? parsed.id,
    connectedAt: parsed.connectedAt ? new Date(parsed.connectedAt) : null,
  };
};

export const createRedisVoiceSessionStore = (
  client: RedisClient,
  keyPrefix: string,
): VoiceSessionStore => {
  const userKey = (userId: string) => `${keyPrefix}:voice:user:${userId}`;
  const conversationKey = (conversationId: string) =>
    `${keyPrefix}:voice:conversation:${conversationId}`;
  const sessionKey = (sessionId: string) =>
    `${keyPrefix}:voice:session:${sessionId}`;
  const sessionsKey = `${keyPrefix}:voice:sessions`;
  const unavailable = (): never => {
    throw new ServiceUnavailableError("Runtime state is unavailable");
  };

  return {
    async reserve(sessions, replaceUserId = "", maxConversationParticipants) {
      if (sessions.length === 0) {
        return { capacityExceeded: false, conflict: null, replaced: [] };
      }
      try {
        const conversationId = sessions[0]?.conversationId;
        if (!conversationId) {
          throw new Error("Voice reservation requires a conversation");
        }
        if (maxConversationParticipants !== undefined) {
          await this.listReservedByConversation(conversationId);
        }
        const result: unknown = await client.eval(RESERVE_SCRIPT, {
          keys: [
            ...sessions.map(({ userId }) => userKey(userId)),
            ...sessions.map(({ id }) => sessionKey(id)),
            conversationKey(conversationId),
            sessionsKey,
          ],
          arguments: [
            String(sessions.length),
            replaceUserId,
            String(PENDING_TTL_MS),
            String(maxConversationParticipants ?? 0),
            ...sessions.map((session) => JSON.stringify(session)),
          ],
        });
        if (!Array.isArray(result) || result.length < 2) {
          throw new Error("Redis returned an invalid voice reservation");
        }
        if (Number(result[0]) === -1) {
          return {
            capacityExceeded: true,
            conflict: null,
            replaced: [],
          };
        }
        if (Number(result[0]) === 0) {
          return {
            capacityExceeded: false,
            conflict: parseRecord(String(result[1])),
            replaced: [],
          };
        }
        return {
          capacityExceeded: false,
          conflict: null,
          replaced: result.slice(2).map((value) => parseRecord(String(value))),
        };
      } catch {
        return unavailable();
      }
    },
    async getByUser(userId) {
      try {
        const value = await client.get(userKey(userId));
        return value ? parseRecord(value) : null;
      } catch {
        return unavailable();
      }
    },
    async getById(sessionId) {
      try {
        const userId = await client.get(sessionKey(sessionId));
        if (!userId) return null;
        const current = await client.get(userKey(userId));
        if (!current) {
          await client.del(sessionKey(sessionId));
          return null;
        }
        const record = parseRecord(current);
        if (record.id !== sessionId) {
          await client.del(sessionKey(sessionId));
          return null;
        }
        return record;
      } catch {
        return unavailable();
      }
    },
    async activate(userId, sessionId, now) {
      try {
        const current = await client.get(userKey(userId));
        if (!current) return null;
        const record = parseRecord(current);
        const result = await client.eval(ACTIVATE_SCRIPT, {
          keys: [
            userKey(userId),
            conversationKey(record.conversationId),
            sessionsKey,
          ],
          arguments: [sessionId, now.toISOString(), String(ACTIVE_TTL_MS)],
        });
        if (typeof result === "string") {
          await client.set(sessionKey(sessionId), userId, {
            PX: ACTIVE_TTL_MS,
          });
        }
        return typeof result === "string" ? parseRecord(result) : null;
      } catch {
        return unavailable();
      }
    },
    async heartbeat(userId, sessionId) {
      try {
        const current = await client.get(userKey(userId));
        if (!current) return false;
        const record = parseRecord(current);
        const result = await client.eval(HEARTBEAT_SCRIPT, {
          keys: [
            userKey(userId),
            conversationKey(record.conversationId),
            sessionsKey,
          ],
          arguments: [sessionId, String(ACTIVE_TTL_MS)],
        });
        if (Number(result) === 1) {
          await client.set(sessionKey(sessionId), userId, {
            PX: ACTIVE_TTL_MS,
          });
        }
        return Number(result) === 1;
      } catch {
        return unavailable();
      }
    },
    async markDisconnected(userId, sessionId) {
      try {
        const key = userKey(userId);
        const current = await client.get(key);
        if (!current) return null;
        const record = parseRecord(current);
        if (record.id !== sessionId) return null;
        const updated = { ...record, connectedAt: null };
        await client.set(key, JSON.stringify(updated), { PX: 15_000 });
        await client.set(sessionKey(sessionId), userId, { PX: 15_000 });
        await client.hDel(conversationKey(record.conversationId), userId);
        await client.hSet(sessionsKey, userId, JSON.stringify(updated));
        return updated;
      } catch {
        return unavailable();
      }
    },
    async releaseUsers(userIds) {
      try {
        const released: VoiceSessionRecord[] = [];
        for (const userId of [...new Set(userIds)]) {
          const value = await client.getDel(userKey(userId));
          if (!value) continue;
          const record = parseRecord(value);
          released.push(record);
          await client.del(sessionKey(record.id));
          await client.hDel(conversationKey(record.conversationId), userId);
          await client.hDel(sessionsKey, userId);
        }
        return released;
      } catch {
        return unavailable();
      }
    },
    async releaseSessions(sessions) {
      try {
        const released: VoiceSessionRecord[] = [];
        for (const session of sessions) {
          const key = userKey(session.userId);
          const current = await client.get(key);
          await client.del(sessionKey(session.id));
          if (!current) {
            await client.hDel(sessionsKey, session.userId);
            await client.hDel(
              conversationKey(session.conversationId),
              session.userId,
            );
            continue;
          }
          const record = parseRecord(current);
          if (record.id === session.id) {
            await client.del(key);
            released.push(record);
            await client.hDel(sessionsKey, session.userId);
            await client.hDel(
              conversationKey(session.conversationId),
              session.userId,
            );
            continue;
          }
          if (record.conversationId !== session.conversationId) {
            await client.hDel(
              conversationKey(session.conversationId),
              session.userId,
            );
          }
        }
        return released;
      } catch {
        return unavailable();
      }
    },
    async listByConversation(conversationId) {
      try {
        const values = await client.hGetAll(conversationKey(conversationId));
        const active: VoiceSessionRecord[] = [];
        for (const [userId, value] of Object.entries(values)) {
          const current = await client.get(userKey(userId));
          if (!current) {
            await client.hDel(conversationKey(conversationId), userId);
            continue;
          }
          const record = parseRecord(value);
          const currentRecord = parseRecord(current);
          if (record.id !== currentRecord.id) {
            await client.hDel(conversationKey(conversationId), userId);
            continue;
          }
          if (record.connectedAt) active.push(record);
        }
        return active;
      } catch {
        return unavailable();
      }
    },
    async listReservedByConversation(conversationId) {
      try {
        const values = await client.hGetAll(conversationKey(conversationId));
        const reserved: VoiceSessionRecord[] = [];
        for (const [userId, value] of Object.entries(values)) {
          const current = await client.get(userKey(userId));
          if (!current) {
            await client.hDel(conversationKey(conversationId), userId);
            continue;
          }
          const record = parseRecord(value);
          const currentRecord = parseRecord(current);
          if (record.id !== currentRecord.id) {
            await client.hDel(conversationKey(conversationId), userId);
            continue;
          }
          if (record.conversationId === conversationId) reserved.push(record);
        }
        return reserved;
      } catch {
        return unavailable();
      }
    },
    async listReserved() {
      try {
        const values = await client.hGetAll(sessionsKey);
        const reserved: VoiceSessionRecord[] = [];
        for (const [userId, value] of Object.entries(values)) {
          const current = await client.get(userKey(userId));
          if (!current) {
            await client.hDel(sessionsKey, userId);
            continue;
          }
          const record = parseRecord(value);
          const currentRecord = parseRecord(current);
          if (record.id !== currentRecord.id) {
            await client.hSet(sessionsKey, userId, current);
            reserved.push(currentRecord);
            continue;
          }
          reserved.push(record);
        }
        return reserved;
      } catch {
        return unavailable();
      }
    },
    async claimWebhook(eventId) {
      try {
        const result = await client.set(
          `${keyPrefix}:voice:webhook:${eventId}`,
          "1",
          { NX: true, PX: WEBHOOK_TTL_MS },
        );
        return result === "OK";
      } catch {
        return unavailable();
      }
    },
  };
};
