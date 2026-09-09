import { model, Schema, type Types } from "mongoose";

import type { NotificationCategoryPreferences } from "@intouch/shared/notifications";

export interface NotificationPreferenceDocument {
  userId: Types.ObjectId;
  categories: NotificationCategoryPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<NotificationCategoryPreferences>(
  {
    invitations: { type: Boolean, default: true, required: true },
    directMessages: { type: Boolean, default: true, required: true },
    mentionsAndReplies: { type: Boolean, default: true, required: true },
    reactions: { type: Boolean, default: true, required: true },
  },
  { _id: false },
);

const notificationPreferenceSchema = new Schema<NotificationPreferenceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    categories: { type: categorySchema, required: true },
  },
  { timestamps: true },
);

notificationPreferenceSchema.index(
  { userId: 1 },
  { name: "unique_notification_preferences_user", unique: true },
);

export const NotificationPreferenceModel =
  model<NotificationPreferenceDocument>(
    "NotificationPreference",
    notificationPreferenceSchema,
  );
