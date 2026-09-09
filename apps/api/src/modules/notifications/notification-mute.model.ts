import { model, Schema, type Types } from "mongoose";

export interface NotificationMuteDocument {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  mutedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationMuteSchema = new Schema<NotificationMuteDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    mutedUntil: { type: Date },
  },
  { timestamps: true },
);

notificationMuteSchema.index(
  { userId: 1, organizationId: 1, conversationId: 1 },
  { name: "unique_notification_mute_scope", unique: true },
);
notificationMuteSchema.index(
  { mutedUntil: 1 },
  {
    name: "notification_mute_expiry",
    expireAfterSeconds: 0,
    partialFilterExpression: { mutedUntil: { $type: "date" } },
  },
);

export const NotificationMuteModel = model<NotificationMuteDocument>(
  "NotificationMute",
  notificationMuteSchema,
);
