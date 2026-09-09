import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { NotificationPreferenceController } from "./notification-preference.controller.js";
import {
  conversationMuteParamsSchema,
  notificationMuteRequestSchema,
  organizationMuteParamsSchema,
  updateNotificationPreferencesSchema,
} from "./notification.schemas.js";

const createNotificationPreferenceRouter = (
  controller: NotificationPreferenceController,
  requireAccessToken: RequestHandler,
  mutateLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/me/notification-preferences")
    .get(controller.get)
    .put(
      mutateLimit,
      validateBody(updateNotificationPreferencesSchema),
      controller.update,
    );
  router
    .route("/me/notification-mutes/organizations/:organizationId")
    .put(
      mutateLimit,
      validateParams(organizationMuteParamsSchema),
      validateBody(notificationMuteRequestSchema),
      controller.muteOrganization,
    )
    .delete(
      mutateLimit,
      validateParams(organizationMuteParamsSchema),
      controller.unmuteOrganization,
    );
  router
    .route("/me/notification-mutes/conversations/:conversationId")
    .put(
      mutateLimit,
      validateParams(conversationMuteParamsSchema),
      validateBody(notificationMuteRequestSchema),
      controller.muteConversation,
    )
    .delete(
      mutateLimit,
      validateParams(conversationMuteParamsSchema),
      controller.unmuteConversation,
    );
  return router;
};

export default createNotificationPreferenceRouter;
