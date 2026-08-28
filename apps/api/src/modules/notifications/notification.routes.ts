import express, { type RequestHandler } from "express";

import {
  validateParams,
  validateQuery,
} from "../../middleware/validateRequest.js";
import type { NotificationController } from "./notification.controller.js";
import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
} from "./notification.schemas.js";

const createNotificationRouter = (
  controller: NotificationController,
  requireAccessToken: RequestHandler,
  mutateLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.get("/", validateQuery(notificationListQuerySchema), controller.list);
  router.put("/read-all", mutateLimit, controller.markAllRead);
  router.put(
    "/:notificationId/read",
    mutateLimit,
    validateParams(notificationIdParamsSchema),
    controller.markRead,
  );
  return router;
};

export default createNotificationRouter;
