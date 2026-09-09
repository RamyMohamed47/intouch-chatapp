import type { Logger } from "pino";

import type { NotificationRepository } from "../notifications/notification.repository.js";
import {
  checkPushReceipts,
  deliverPush,
  handlePushDeliveryFailure,
  PUSH_LEASE_MS,
  type PushDeliveryDependencies,
} from "./push.delivery.js";

const POLL_INTERVAL_MS = 2_000;
const STALE_MS = 5 * 60_000;
const BATCH_SIZE = 100;

export const reconcilePushOutbox = async (
  notifications: NotificationRepository,
  dependencies: PushDeliveryDependencies,
) => {
  const now = dependencies.now?.() ?? new Date();
  const candidates = await notifications.listPendingPush(now, BATCH_SIZE);
  for (const candidate of candidates) {
    await dependencies.outbox.enqueue({
      notificationId: candidate.id,
      recipientUserId: candidate.recipientUserId,
      pushVersion: candidate.pushVersion,
      now,
    });
    await notifications.markPushEnqueued(candidate.id, candidate.pushVersion);
  }
};

export const createPushWorker = (
  dependencies: PushDeliveryDependencies & {
    logger: Logger;
    notificationRepository: NotificationRepository;
  },
) => {
  let timer: NodeJS.Timeout | undefined;
  let active: Promise<void> | undefined;
  let stopping = false;

  const runOnce = async () => {
    await reconcilePushOutbox(
      dependencies.notificationRepository,
      dependencies,
    );
    const now = dependencies.now?.() ?? new Date();
    const staleBefore = new Date(now.getTime() - STALE_MS);
    const [dispatch] = await dependencies.outbox.listDispatchable(
      now,
      staleBefore,
      1,
    );
    if (dispatch) {
      const claimed = await dependencies.outbox.claimDispatch(
        dispatch.id,
        now,
        new Date(now.getTime() + PUSH_LEASE_MS),
      );
      if (claimed) {
        try {
          await deliverPush(dependencies, claimed);
        } catch (error) {
          await handlePushDeliveryFailure(dependencies, claimed, error);
        }
      }
      return;
    }
    const [receipt] = await dependencies.outbox.listReceiptReady(
      now,
      staleBefore,
      1,
    );
    if (!receipt) return;
    const claimed = await dependencies.outbox.claimReceipt(
      receipt.id,
      now,
      new Date(now.getTime() + PUSH_LEASE_MS),
    );
    if (!claimed) return;
    try {
      await checkPushReceipts(dependencies, claimed);
    } catch (error) {
      await dependencies.outbox.scheduleReceiptRetry(
        claimed.id,
        new Date(now.getTime() + 60_000),
        error instanceof Error ? error.name : "PUSH_RECEIPT_ERROR",
      );
    }
  };

  const pump = () => {
    if (stopping || active) return;
    active = runOnce()
      .catch((error: unknown) => {
        dependencies.logger.error(
          { err: error },
          "Push worker iteration failed",
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
