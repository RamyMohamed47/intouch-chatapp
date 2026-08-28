import { notificationListQuerySchema } from "@intouch/shared/notifications";
import { z } from "zod";

const mongoIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Notification ID must be a valid MongoDB ID");

export { notificationListQuerySchema };

export const notificationIdParamsSchema = z
  .object({ notificationId: mongoIdSchema })
  .strict();

export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
