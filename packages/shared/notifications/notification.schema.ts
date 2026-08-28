import { z } from "zod";

export const NotificationStatus = {
  ALL: "ALL",
  UNREAD: "UNREAD",
} as const;

export const notificationStatusSchema = z.enum(NotificationStatus);

export const notificationListQuerySchema = z
  .object({
    status: notificationStatusSchema.default(NotificationStatus.ALL),
    cursor: z.string().min(1).max(1_024).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type NotificationStatusValue = z.infer<typeof notificationStatusSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
