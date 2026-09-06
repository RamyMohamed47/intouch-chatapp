import { randomUUID } from "node:crypto";

import ServiceUnavailableError from "../../errors/ServiceUnavailableError.js";
import type { RedisClient } from "../../infrastructure/redis/index.js";
import { nextUtcMidnight, type AiQuotaOptions } from "./ai-quota.store.js";
import type { AiAdmission, AiQuotaStatus, AiQuotaStore } from "./ai.types.js";

const ADMIT_SCRIPT = `
local userCount = tonumber(redis.call("GET", KEYS[1])) or 0
local organizationCount = tonumber(redis.call("GET", KEYS[2])) or 0
local concurrency = tonumber(redis.call("GET", KEYS[3])) or 0
if userCount >= tonumber(ARGV[1]) then return {0, 1, userCount, organizationCount} end
if organizationCount >= tonumber(ARGV[2]) then return {0, 2, userCount, organizationCount} end
if concurrency >= tonumber(ARGV[3]) then return {0, 3, userCount, organizationCount} end
userCount = redis.call("INCR", KEYS[1])
organizationCount = redis.call("INCR", KEYS[2])
redis.call("PEXPIRE", KEYS[1], ARGV[4])
redis.call("PEXPIRE", KEYS[2], ARGV[4])
redis.call("INCR", KEYS[3])
redis.call("PEXPIRE", KEYS[3], ARGV[5])
redis.call("SET", KEYS[4], "1", "PX", ARGV[5])
return {1, 0, userCount, organizationCount}
`;

const RELEASE_SCRIPT = `
if redis.call("DEL", KEYS[2]) == 1 then
  local current = tonumber(redis.call("GET", KEYS[1])) or 0
  if current <= 1 then redis.call("DEL", KEYS[1]) else redis.call("DECR", KEYS[1]) end
end
return 1
`;

const numeric = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed))
    throw new Error("Redis returned invalid AI quota data");
  return parsed;
};

export const createRedisAiQuotaStore = (
  client: RedisClient,
  keyPrefix: string,
  options: AiQuotaOptions,
): AiQuotaStore => {
  const now = options.now ?? (() => new Date());
  const day = (value: Date) => value.toISOString().slice(0, 10);
  const keys = (userId: string, organizationId: string, leaseId: string) => {
    const suffix = day(now());
    return {
      user: `${keyPrefix}:ai:daily:user:${suffix}:${userId}`,
      organization: `${keyPrefix}:ai:daily:organization:${suffix}:${organizationId}`,
      concurrency: `${keyPrefix}:ai:concurrency`,
      lease: `${keyPrefix}:ai:lease:${leaseId}`,
    };
  };
  const toStatus = (
    userCount: number,
    organizationCount: number,
  ): AiQuotaStatus => ({
    userRemaining: Math.max(0, options.dailyUserRequests - userCount),
    organizationRemaining: Math.max(
      0,
      options.dailyOrganizationRequests - organizationCount,
    ),
    resetsAt: nextUtcMidnight(now()),
  });

  return {
    async admit(userId, organizationId) {
      const leaseId = randomUUID();
      const names = keys(userId, organizationId, leaseId);
      try {
        const ttl = Math.max(
          1,
          nextUtcMidnight(now()).getTime() - now().getTime(),
        );
        const result: unknown = await client.eval(ADMIT_SCRIPT, {
          keys: [
            names.user,
            names.organization,
            names.concurrency,
            names.lease,
          ],
          arguments: [
            String(options.dailyUserRequests),
            String(options.dailyOrganizationRequests),
            String(options.maxConcurrentRequests),
            String(ttl),
            String(90_000),
          ],
        });
        if (!Array.isArray(result) || result.length !== 4) {
          throw new Error("Redis returned an invalid AI admission result");
        }
        const allowed = numeric(result[0]) === 1;
        const reasonCode = numeric(result[1]);
        const status = toStatus(numeric(result[2]), numeric(result[3]));
        if (allowed) return { allowed: true, leaseId, status };
        const retryAfterSeconds =
          reasonCode === 3 ? 5 : Math.max(1, Math.ceil(ttl / 1_000));
        const reason =
          reasonCode === 1
            ? "USER_DAILY"
            : reasonCode === 2
              ? "ORGANIZATION_DAILY"
              : "CONCURRENCY";
        return {
          allowed: false,
          reason,
          retryAfterSeconds,
          status,
        } satisfies AiAdmission;
      } catch (error) {
        if (error instanceof ServiceUnavailableError) throw error;
        throw new ServiceUnavailableError("Runtime state is unavailable");
      }
    },
    async getStatus(userId, organizationId) {
      const names = keys(userId, organizationId, "status");
      try {
        const [userCount, organizationCount] = await client.mGet([
          names.user,
          names.organization,
        ]);
        return toStatus(Number(userCount ?? 0), Number(organizationCount ?? 0));
      } catch {
        throw new ServiceUnavailableError("Runtime state is unavailable");
      }
    },
    async release(leaseId) {
      const names = keys("unused", "unused", leaseId);
      try {
        await client.eval(RELEASE_SCRIPT, {
          keys: [names.concurrency, names.lease],
          arguments: [],
        });
      } catch {
        throw new ServiceUnavailableError("Runtime state is unavailable");
      }
    },
    close() {},
  };
};
