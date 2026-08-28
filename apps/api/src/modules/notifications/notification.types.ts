import type {
  NotificationDto,
  NotificationTypeValue,
} from "@intouch/shared/notifications";

export interface NotificationRecord {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  organizationId: string;
  type: NotificationTypeValue;
  invitationId?: string;
  conversationId?: string;
  conversationType?: "CHANNEL" | "DIRECT";
  messageId?: string;
  latestMessageId?: string;
  messageCount?: number;
  emoji?: string;
  readAt: Date | null;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationCursor {
  lastActivityAt: Date;
  id: string;
}

export interface NotificationPage {
  notifications: NotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface CreateNotificationInput {
  recipientUserId: string;
  actorUserId: string;
  organizationId: string;
  type: NotificationTypeValue;
  dedupeKey: string;
  invitationId?: string;
  conversationId?: string;
  conversationType?: "CHANNEL" | "DIRECT";
  messageId?: string;
  emoji?: string;
  lastActivityAt: Date;
  expiresAt: Date;
}

export interface UpsertDirectMessageNotificationInput {
  recipientUserId: string;
  actorUserId: string;
  organizationId: string;
  conversationId: string;
  latestMessageId: string;
  lastActivityAt: Date;
  expiresAt: Date;
}

export interface UpsertReactionNotificationInput {
  recipientUserId: string;
  actorUserId: string;
  organizationId: string;
  conversationId: string;
  conversationType: "CHANNEL" | "DIRECT";
  messageId: string;
  emoji: string;
  lastActivityAt: Date;
  expiresAt: Date;
}
