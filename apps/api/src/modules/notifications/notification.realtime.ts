import type { NotificationChangedEvent } from "@intouch/shared/notifications";

export interface NotificationRealtime {
  notificationChanged(
    recipientUserId: string,
    event: NotificationChangedEvent,
  ): void;
}

export const createNoopNotificationRealtime = (): NotificationRealtime => ({
  notificationChanged() {},
});
