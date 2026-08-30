import type { Logger } from "pino";

import type { TypingService } from "./typing.service.js";
import type { TypingStore } from "./typing.store.js";

export interface TypingExpiryWorker {
  close(): void;
  start(): void;
}

export const createTypingExpiryWorker = (
  store: TypingStore,
  typing: Pick<TypingService, "publishExpired">,
  logger: Logger,
  intervalMs = 1_000,
): TypingExpiryWorker => {
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  const run = async () => {
    if (running || !store.claimExpired) return;
    running = true;
    try {
      const identities = await store.claimExpired(100);
      for (const identity of identities) typing.publishExpired(identity);
    } catch (error) {
      logger.error({ err: error }, "Typing expiry scan failed");
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
