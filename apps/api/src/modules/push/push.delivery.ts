import { NotificationType } from "@intouch/shared/notifications";
import type { Logger } from "pino";

import { getObservabilityMetrics } from "../../infrastructure/observability/index.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { PushTokenCipher } from "./push.crypto.js";
import type { PushDeviceRepository } from "./push-device.repository.js";
import type { PushOutboxRepository } from "./push-outbox.repository.js";
import type { PushOutboxRecord, PushProvider } from "./push.types.js";

export const PUSH_LEASE_MS = 60_000;
export const PUSH_MAX_ATTEMPTS = 5;
export const PUSH_RECEIPT_MAX_ATTEMPTS = 4;
export const PUSH_RETRY_DELAYS_MS = [
  5_000,
  30_000,
  2 * 60_000,
  10 * 60_000,
] as const;
export const PUSH_RECEIPT_DELAY_MS = 15 * 60_000;

const getErrorCode = (error: unknown) =>
  error instanceof Error && error.name ? error.name : "PUSH_PROVIDER_ERROR";

const notificationCopy = (
  notification: Awaited<ReturnType<NotificationService["findForPush"]>>,
) => {
  if (!notification) return null;
  const value = notification.notification;
  switch (value.type) {
    case NotificationType.ORGANIZATION_INVITATION_RECEIVED:
      return {
        title: `${value.actor.displayName} invited you`,
        body: `Join ${value.organization.name} on InTouch.`,
      };
    case NotificationType.ORGANIZATION_INVITATION_ACCEPTED:
      return {
        title: `${value.actor.displayName} accepted your invitation`,
        body: `They joined ${value.organization.name}.`,
      };
    case NotificationType.DIRECT_MESSAGE_RECEIVED:
      return {
        title: `${value.actor.displayName} sent you a direct message`,
        body: `Open the conversation in ${value.organization.name}.`,
      };
    case NotificationType.MESSAGE_REACTION_RECEIVED:
      return {
        title: `${value.actor.displayName} reacted ${value.emoji}`,
        body: `They reacted to your message in ${value.organization.name}.`,
      };
    case NotificationType.CHANNEL_MENTION_RECEIVED:
      return {
        title: `${value.actor.displayName} mentioned you`,
        body: `Open the conversation in ${value.organization.name}.`,
      };
    case NotificationType.MESSAGE_REPLY_RECEIVED:
      return {
        title: `${value.actor.displayName} replied to you`,
        body: `Open the conversation in ${value.organization.name}.`,
      };
  }
};

const notificationData = (
  notification: NonNullable<
    Awaited<ReturnType<NotificationService["findForPush"]>>
  >["notification"],
) => ({
  notificationId: notification.id,
  type: notification.type,
  organizationId: notification.organization.id,
  ...(notification.type === NotificationType.ORGANIZATION_INVITATION_RECEIVED
    ? { invitationId: notification.invitationId }
    : {}),
  ...(notification.type === NotificationType.DIRECT_MESSAGE_RECEIVED
    ? {
        conversationId: notification.conversationId,
        messageId: notification.latestMessageId,
      }
    : {}),
  ...(notification.type === NotificationType.MESSAGE_REACTION_RECEIVED
    ? {
        conversationId: notification.conversationId,
        messageId: notification.messageId,
      }
    : {}),
  ...(notification.type === NotificationType.CHANNEL_MENTION_RECEIVED ||
  notification.type === NotificationType.MESSAGE_REPLY_RECEIVED
    ? {
        conversationId: notification.conversationId,
        messageId: notification.messageId,
      }
    : {}),
});

export const notificationThread = (notification: {
  conversationId?: string;
  organization: { id: string };
}) =>
  notification.conversationId
    ? `conversation:${notification.conversationId}`
    : `organization:${notification.organization.id}`;

export interface PushDeliveryDependencies {
  cipher: PushTokenCipher;
  devices: PushDeviceRepository;
  logger: Pick<Logger, "warn">;
  notifications: Pick<NotificationService, "findForPush">;
  outbox: PushOutboxRepository;
  provider: PushProvider;
  now?: () => Date;
}

export const deliverPush = async (
  dependencies: PushDeliveryDependencies,
  record: PushOutboxRecord,
) => {
  const now = dependencies.now?.() ?? new Date();
  const notification = await dependencies.notifications.findForPush(
    record.notificationId,
    record.pushVersion,
  );
  if (!notification) {
    getObservabilityMetrics().recordPushOutcome("suppressed");
    await dependencies.outbox.markComplete(record.id, now);
    return;
  }
  const devices = await dependencies.devices.listEnabledForUser(
    record.recipientUserId,
  );
  if (devices.length === 0) {
    getObservabilityMetrics().recordPushOutcome("suppressed");
    await dependencies.outbox.markComplete(record.id, now);
    return;
  }
  const copy = notificationCopy(notification);
  if (!copy) {
    await dependencies.outbox.markComplete(record.id, now);
    return;
  }
  const tickets = await dependencies.provider.send(
    devices.map((device) => ({
      token: dependencies.cipher.decrypt(device),
      ...copy,
      data: notificationData(notification.notification),
      badge: notification.unreadCount ?? 0,
      threadId: notificationThread(notification.notification),
    })),
  );
  if (tickets.length !== devices.length) {
    throw new Error("Push provider returned an unexpected ticket count");
  }
  const accepted: PushOutboxRecord["tickets"] = [];
  for (let index = 0; index < tickets.length; index += 1) {
    const ticket = tickets[index];
    const device = devices[index];
    if (!ticket || !device) continue;
    if (ticket.status === "OK" && ticket.ticketId) {
      accepted.push({ deviceId: device.id, ticketId: ticket.ticketId });
      getObservabilityMetrics().recordPushOutcome("sent");
      continue;
    }
    getObservabilityMetrics().recordPushOutcome("rejected");
    if (ticket.errorCode === "DeviceNotRegistered") {
      await dependencies.devices.disableById(device.id, now);
    }
    dependencies.logger.warn(
      { pushOutboxId: record.id, errorCode: ticket.errorCode },
      "Push notification ticket rejected",
    );
  }
  await dependencies.outbox.markDispatched(
    record.id,
    now,
    new Date(now.getTime() + PUSH_RECEIPT_DELAY_MS),
    accepted,
  );
};

export const checkPushReceipts = async (
  dependencies: PushDeliveryDependencies,
  record: PushOutboxRecord,
) => {
  const now = dependencies.now?.() ?? new Date();
  if (record.tickets.length === 0) {
    await dependencies.outbox.markComplete(record.id, now);
    return;
  }
  const receipts = await dependencies.provider.receipts(
    record.tickets.map(({ ticketId }) => ticketId),
  );
  let pending = false;
  for (const ticket of record.tickets) {
    const receipt = receipts.get(ticket.ticketId);
    if (!receipt || receipt.status === "PENDING") {
      pending = true;
      continue;
    }
    if (
      receipt.status === "ERROR" &&
      receipt.errorCode === "DeviceNotRegistered"
    ) {
      await dependencies.devices.disableById(ticket.deviceId, now);
    }
    if (receipt.status === "ERROR") {
      getObservabilityMetrics().recordPushOutcome("rejected");
      dependencies.logger.warn(
        { pushOutboxId: record.id, errorCode: receipt.errorCode },
        "Push notification receipt reported a failure",
      );
    }
  }
  if (pending && record.receiptAttempts < PUSH_RECEIPT_MAX_ATTEMPTS) {
    await dependencies.outbox.scheduleReceiptRetry(
      record.id,
      new Date(now.getTime() + PUSH_RECEIPT_DELAY_MS),
      "PUSH_RECEIPT_PENDING",
    );
    return;
  }
  await dependencies.outbox.markComplete(record.id, now);
};

export const handlePushDeliveryFailure = async (
  dependencies: PushDeliveryDependencies,
  record: PushOutboxRecord,
  error: unknown,
) => {
  const now = dependencies.now?.() ?? new Date();
  const delay = PUSH_RETRY_DELAYS_MS[record.attempts - 1];
  const canRetry =
    record.attempts < PUSH_MAX_ATTEMPTS &&
    delay !== undefined &&
    now.getTime() + delay < record.expiresAt.getTime();
  const errorCode = getErrorCode(error);
  if (canRetry) {
    getObservabilityMetrics().recordPushOutcome("retried");
    await dependencies.outbox.scheduleDispatchRetry(
      record.id,
      new Date(now.getTime() + delay),
      errorCode,
    );
  } else {
    getObservabilityMetrics().recordPushOutcome("failed");
    await dependencies.outbox.markFailed(record.id, now, errorCode);
  }
  dependencies.logger.warn(
    {
      pushOutboxId: record.id,
      attempt: record.attempts,
      retryScheduled: canRetry,
      errorCode,
    },
    "Push notification delivery failed",
  );
};
