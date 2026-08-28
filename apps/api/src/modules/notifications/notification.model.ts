import { Schema, model, type Types } from "mongoose";

import {
  NotificationType,
  type NotificationTypeValue,
} from "@intouch/shared/notifications";

interface NotificationDocument {
  recipientUserId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  organizationId: Types.ObjectId;
  type: NotificationTypeValue;
  invitationId?: Types.ObjectId;
  conversationId?: Types.ObjectId;
  conversationType?: "CHANNEL" | "DIRECT";
  messageId?: Types.ObjectId;
  latestMessageId?: Types.ObjectId;
  messageCount?: number;
  emoji?: string;
  dedupeKey?: string;
  activeGroupKey?: string;
  readAt?: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    recipientUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    actorUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Organization",
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    invitationId: { type: Schema.Types.ObjectId, ref: "Invitation" },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    conversationType: { type: String, enum: ["CHANNEL", "DIRECT"] },
    messageId: { type: Schema.Types.ObjectId, ref: "Message" },
    latestMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    messageCount: { type: Number, min: 1 },
    emoji: { type: String },
    dedupeKey: { type: String },
    activeGroupKey: { type: String },
    readAt: { type: Date },
    lastActivityAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

notificationSchema.index(
  { recipientUserId: 1, lastActivityAt: -1, _id: -1 },
  { name: "notifications_by_recipient_activity" },
);
notificationSchema.index(
  { recipientUserId: 1, readAt: 1, lastActivityAt: -1 },
  { name: "unread_notifications_by_recipient" },
);
notificationSchema.index(
  { recipientUserId: 1, dedupeKey: 1 },
  {
    name: "unique_notification_dedupe_key",
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  },
);
notificationSchema.index(
  { recipientUserId: 1, activeGroupKey: 1 },
  {
    name: "unique_active_notification_group",
    unique: true,
    partialFilterExpression: { activeGroupKey: { $type: "string" } },
  },
);
notificationSchema.index(
  { organizationId: 1 },
  { name: "notifications_by_organization" },
);
notificationSchema.index(
  { conversationId: 1, recipientUserId: 1 },
  { name: "notifications_by_conversation_recipient" },
);
notificationSchema.index(
  { messageId: 1 },
  { name: "notifications_by_message" },
);
notificationSchema.index(
  { invitationId: 1 },
  { name: "notifications_by_invitation" },
);
notificationSchema.index(
  { expiresAt: 1 },
  { name: "notification_expiry", expireAfterSeconds: 0 },
);

const NotificationModel = model<NotificationDocument>(
  "Notification",
  notificationSchema,
);

export type { NotificationDocument };
export default NotificationModel;
