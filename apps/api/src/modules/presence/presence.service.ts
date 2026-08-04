import type { MembershipService } from "../memberships/index.js";
import type { UserRepository } from "../user/user.repository.js";
import type { PresenceRealtime } from "./presence.realtime.js";
import createInMemoryPresenceTransitionScheduler, {
  type PresenceTransitionScheduler,
} from "./presence.scheduler.js";
import createInMemoryPresenceStore, {
  type PresenceStore,
} from "./presence.store.js";
import { PresenceStatus, type PresenceView } from "./presence.types.js";

export interface PresenceServiceDependencies {
  memberships: Pick<MembershipService, "listForUser">;
  realtime: PresenceRealtime;
  users: Pick<UserRepository, "findLastSeenByIds" | "updateLastSeen">;
  offlineDelayMs?: number;
  now?: () => Date;
  onError?: (error: unknown) => void;
  store?: PresenceStore;
  scheduler?: PresenceTransitionScheduler;
}

const createPresenceService = ({
  memberships,
  realtime,
  users,
  offlineDelayMs = 5_000,
  now = () => new Date(),
  onError = () => undefined,
  store = createInMemoryPresenceStore(),
  scheduler = createInMemoryPresenceTransitionScheduler(),
}: PresenceServiceDependencies) => {
  const organizationIdsForUser = async (userId: string) =>
    (await memberships.listForUser(userId)).map(
      ({ organizationId }) => organizationId,
    );

  const broadcast = async (presence: PresenceView) => {
    realtime.presenceUpdated(
      await organizationIdsForUser(presence.userId),
      presence,
    );
  };

  return {
    async markOnline(userId: string, socketId: string) {
      scheduler.cancel(userId);
      if (!(await store.markOnline(userId, socketId))) return;
      await broadcast({
        userId,
        status: PresenceStatus.ONLINE,
        lastSeenAt: null,
      });
    },

    async markOffline(userId: string, socketId: string) {
      if (!(await store.markOffline(userId, socketId))) return;

      scheduler.schedule(userId, offlineDelayMs, () => {
        void store
          .confirmOffline(userId)
          .then(async (confirmed) => {
            if (!confirmed) return;
            const lastSeenAt = now();
            await users.updateLastSeen(userId, lastSeenAt);
            await broadcast({
              userId,
              status: PresenceStatus.OFFLINE,
              lastSeenAt,
            });
          })
          .catch(onError);
      });
    },

    isOnline(userId: string) {
      return store.isOnline(userId);
    },

    async getMany(userIds: readonly string[]): Promise<PresenceView[]> {
      const stored = await users.findLastSeenByIds(userIds);
      const lastSeenByUser = new Map(
        stored.map(({ userId, lastSeenAt }) => [userId, lastSeenAt]),
      );
      return Promise.all(
        userIds.map(async (userId) => ({
          userId,
          status: (await store.isOnline(userId))
            ? PresenceStatus.ONLINE
            : PresenceStatus.OFFLINE,
          lastSeenAt: lastSeenByUser.get(userId) ?? null,
        })),
      );
    },
  };
};

export type PresenceService = ReturnType<typeof createPresenceService>;
export default createPresenceService;
