import type { NotificationDto } from "@intouch/shared/notifications";

export interface PushOutboxRecord {
  id: string;
  notificationId: string;
  recipientUserId: string;
  pushVersion: number;
  attempts: number;
  receiptAttempts: number;
  availableAt: Date;
  expiresAt: Date;
  dispatchedAt?: Date;
  leaseUntil?: Date;
  receiptAvailableAt?: Date;
  receiptDispatchedAt?: Date;
  tickets: { deviceId: string; ticketId: string }[];
}

export interface PushProviderMessage {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  badge?: number;
  threadId?: string;
}

export interface PushProviderTicket {
  status: "OK" | "ERROR";
  ticketId?: string;
  errorCode?: string;
}

export interface PushProviderReceipt {
  status: "OK" | "ERROR" | "PENDING";
  errorCode?: string;
}

export interface PushProvider {
  send(messages: readonly PushProviderMessage[]): Promise<PushProviderTicket[]>;
  receipts(
    ticketIds: readonly string[],
  ): Promise<Map<string, PushProviderReceipt>>;
}

export interface PushNotificationView {
  notification: NotificationDto;
  recipientUserId: string;
  unreadCount?: number;
}
