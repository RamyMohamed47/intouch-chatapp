import { Expo, type ExpoPushMessage } from "expo-server-sdk";

import type {
  PushProvider,
  PushProviderMessage,
  PushProviderReceipt,
  PushProviderTicket,
} from "./push.types.js";

const errorCode = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  typeof value.error === "string"
    ? value.error
    : "PUSH_PROVIDER_ERROR";

export const createExpoPushProvider = (accessToken: string): PushProvider => {
  const expo = new Expo({ accessToken });

  return {
    async send(messages: readonly PushProviderMessage[]) {
      const providerMessages: ExpoPushMessage[] = messages.map((message) => ({
        to: message.token,
        title: message.title,
        body: message.body,
        data: message.data,
        ...(message.badge === undefined ? {} : { badge: message.badge }),
        channelId: "intouch-activity-v2",
        sound: "default",
        priority: "high",
      }));
      const tickets = (
        await Promise.all(
          expo
            .chunkPushNotifications(providerMessages)
            .map((chunk) => expo.sendPushNotificationsAsync(chunk)),
        )
      ).flat();
      return tickets.map<PushProviderTicket>((ticket) =>
        ticket.status === "ok"
          ? { status: "OK", ticketId: ticket.id }
          : { status: "ERROR", errorCode: errorCode(ticket.details) },
      );
    },
    async receipts(ticketIds: readonly string[]) {
      const result = new Map<string, PushProviderReceipt>();
      for (const chunk of expo.chunkPushNotificationReceiptIds([
        ...ticketIds,
      ])) {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
        for (const [ticketId, receipt] of Object.entries(receipts)) {
          result.set(
            ticketId,
            receipt.status === "ok"
              ? { status: "OK" }
              : {
                  status: "ERROR",
                  errorCode: errorCode(receipt.details),
                },
          );
        }
      }
      for (const ticketId of ticketIds) {
        if (!result.has(ticketId)) result.set(ticketId, { status: "PENDING" });
      }
      return result;
    },
  };
};
