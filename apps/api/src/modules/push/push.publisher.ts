import type { NotificationRepository } from "../notifications/notification.repository.js";
import type { NotificationRecord } from "../notifications/notification.types.js";
import type { PushOutboxRepository } from "./push-outbox.repository.js";

export interface PushPublisher {
  enqueue(record: NotificationRecord): Promise<void>;
}

export const createPushPublisher = (
  outbox: PushOutboxRepository,
  notifications: Pick<NotificationRepository, "markPushEnqueued">,
  now: () => Date = () => new Date(),
): PushPublisher => ({
  async enqueue(record) {
    if (record.pushVersion <= record.pushEnqueuedVersion) return;
    await outbox.enqueue({
      notificationId: record.id,
      recipientUserId: record.recipientUserId,
      pushVersion: record.pushVersion,
      now: now(),
    });
    await notifications.markPushEnqueued(record.id, record.pushVersion);
  },
});
