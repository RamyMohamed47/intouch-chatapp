import type { Logger } from "pino";

import type { PresenceService } from "./presence.service.js";
import type { PresenceStore } from "./presence.store.js";

export interface PresenceExpiryWorker {
  close(): void;
  start(): void;
}

export const createPresenceExpiryWorker = (
  store: PresenceStore,
  presence: Pick<PresenceService, "publishExpiredOffline">,
  logger: Logger,
  intervalMs = 1_000,
): PresenceExpiryWorker => {
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  const run = async () => {
    if (running || !store.claimExpired) return;
    running = true;
    try {
      const userIds = await store.claimExpired(100);
      await Promise.all(
        userIds.map((userId) =>
          presence.publishExpiredOffline(userId).catch((error: unknown) => {
            logger.error(
              { err: error, userId },
              "Expired presence transition failed",
            );
          }),
        ),
      );
    } catch (error) {
      logger.error({ err: error }, "Presence expiry scan failed");
    } finally {
      running = false;
    }
  };

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => void run(), intervalMs);
      timer.unref();
    },
    close() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
};
