import { randomUUID } from "node:crypto";

import type { AiQuotaStatus, AiQuotaStore } from "./ai.types.js";

export interface AiQuotaOptions {
  dailyOrganizationRequests: number;
  dailyUserRequests: number;
  maxConcurrentRequests: number;
  now?: () => Date;
}

const nextUtcMidnight = (now: Date) =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

export const createInMemoryAiQuotaStore = ({
  dailyOrganizationRequests,
  dailyUserRequests,
  maxConcurrentRequests,
  now = () => new Date(),
}: AiQuotaOptions): AiQuotaStore => {
  const counts = new Map<string, number>();
  const leases = new Map<string, NodeJS.Timeout>();

  const day = (value: Date) => value.toISOString().slice(0, 10);
  const status = (userId: string, organizationId: string): AiQuotaStatus => {
    const current = now();
    return {
      userRemaining: Math.max(
        0,
        dailyUserRequests - (counts.get(`user:${day(current)}:${userId}`) ?? 0),
      ),
      organizationRemaining: Math.max(
        0,
        dailyOrganizationRequests -
          (counts.get(`organization:${day(current)}:${organizationId}`) ?? 0),
      ),
      resetsAt: nextUtcMidnight(current),
    };
  };

  return {
    admit(userId, organizationId) {
      const current = now();
      const currentStatus = status(userId, organizationId);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          (currentStatus.resetsAt.getTime() - current.getTime()) / 1_000,
        ),
      );
      if (currentStatus.userRemaining === 0) {
        return Promise.resolve({
          allowed: false as const,
          reason: "USER_DAILY" as const,
          retryAfterSeconds,
          status: currentStatus,
        });
      }
      if (currentStatus.organizationRemaining === 0) {
        return Promise.resolve({
          allowed: false,
          reason: "ORGANIZATION_DAILY" as const,
          retryAfterSeconds,
          status: currentStatus,
        });
      }
      if (leases.size >= maxConcurrentRequests) {
        return Promise.resolve({
          allowed: false,
          reason: "CONCURRENCY" as const,
          retryAfterSeconds: 5,
          status: currentStatus,
        });
      }
      const userKey = `user:${day(current)}:${userId}`;
      const organizationKey = `organization:${day(current)}:${organizationId}`;
      counts.set(userKey, (counts.get(userKey) ?? 0) + 1);
      counts.set(organizationKey, (counts.get(organizationKey) ?? 0) + 1);
      const leaseId = randomUUID();
      const timeout = setTimeout(() => leases.delete(leaseId), 90_000);
      timeout.unref();
      leases.set(leaseId, timeout);
      return Promise.resolve({
        allowed: true as const,
        leaseId,
        status: status(userId, organizationId),
      });
    },
    getStatus(userId, organizationId) {
      return Promise.resolve(status(userId, organizationId));
    },
    release(leaseId) {
      const timeout = leases.get(leaseId);
      if (timeout) clearTimeout(timeout);
      leases.delete(leaseId);
      return Promise.resolve();
    },
    close() {
      counts.clear();
      for (const timeout of leases.values()) clearTimeout(timeout);
      leases.clear();
    },
  };
};

export { nextUtcMidnight };
