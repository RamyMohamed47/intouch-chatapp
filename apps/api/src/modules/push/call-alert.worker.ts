import type { Logger } from "pino";

import {
  deliverCallAlert,
  handleCallAlertFailure,
  type CallAlertDeliveryDependencies,
} from "./call-alert.delivery.js";

const POLL_INTERVAL_MS = 1_000;
const LEASE_MS = 30_000;
const STALE_MS = 60_000;

export const createCallAlertWorker = (
  dependencies: CallAlertDeliveryDependencies & { logger: Logger },
) => {
  let timer: NodeJS.Timeout | undefined;
  let active: Promise<void> | undefined;
  let stopping = false;

  const runOnce = async () => {
    const now = dependencies.now?.() ?? new Date();
    const [candidate] = await dependencies.outbox.listDispatchable(
      now,
      new Date(now.getTime() - STALE_MS),
      1,
    );
    if (!candidate) return;
    const record = await dependencies.outbox.claim(
      candidate.id,
      now,
      new Date(now.getTime() + LEASE_MS),
    );
    if (!record) return;
    try {
      await deliverCallAlert(dependencies, record);
    } catch (error) {
      await handleCallAlertFailure(dependencies, record, error);
    }
  };

  const pump = () => {
    if (stopping || active) return;
    active = runOnce()
      .catch((error: unknown) => {
        dependencies.logger.error(
          { err: error },
          "Call alert worker iteration failed",
        );
      })
      .finally(() => {
        active = undefined;
      });
  };

  return {
    runOnce,
    start() {
      if (timer) return;
      stopping = false;
      pump();
      timer = setInterval(pump, POLL_INTERVAL_MS);
      timer.unref();
    },
    async close() {
      stopping = true;
      if (timer) clearInterval(timer);
      timer = undefined;
      await active;
    },
  };
};
