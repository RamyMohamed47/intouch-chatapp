import {
  notificationListQuerySchema,
  notificationMuteRequestSchema,
  updateNotificationPreferencesSchema,
} from "@intouch/shared/notifications";
import { z } from "zod";

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Notification ID must be a valid MongoDB ID");

export { notificationListQuerySchema };
export { notificationMuteRequestSchema, updateNotificationPreferencesSchema };

export const notificationIdParamsSchema = z
  .object({ notificationId: mongoIdSchema })
  .strict();

export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;

export const organizationMuteParamsSchema = z
  .object({ organizationId: mongoIdSchema })
  .strict();
export const conversationMuteParamsSchema = z
  .object({ conversationId: mongoIdSchema })
  .strict();
export type OrganizationMuteParams = z.infer<
  typeof organizationMuteParamsSchema
>;
export type ConversationMuteParams = z.infer<
  typeof conversationMuteParamsSchema
>;
