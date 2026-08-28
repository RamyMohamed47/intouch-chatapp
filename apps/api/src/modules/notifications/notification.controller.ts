import {
  notificationListResponseSchema,
  notificationResponseSchema,
  type NotificationListQuery,
} from "@intouch/shared/notifications";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { NotificationIdParams } from "./notification.schemas.js";
import type { NotificationService } from "./notification.service.js";

export interface NotificationController {
  list: RequestHandler;
  markRead: RequestHandler;
  markAllRead: RequestHandler;
}

const userIdFrom = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

const createNotificationController = (
  service: NotificationService,
): NotificationController => ({
  list: catchAsync(async (_req, res) => {
    const result = await service.list(
      userIdFrom(res.locals as AuthLocals),
      (res.locals as { validatedQuery: NotificationListQuery }).validatedQuery,
    );
    res.status(200).json(notificationListResponseSchema.parse(result));
  }),
  markRead: catchAsync(async (req, res) => {
    const { notificationId } = req.params as unknown as NotificationIdParams;
    const notification = await service.markRead(
      userIdFrom(res.locals as AuthLocals),
      notificationId,
    );
    res.status(200).json(notificationResponseSchema.parse({ notification }));
  }),
  markAllRead: catchAsync(async (_req, res) => {
    await service.markAllRead(userIdFrom(res.locals as AuthLocals));
    res.status(204).send();
  }),
});

export default createNotificationController;
