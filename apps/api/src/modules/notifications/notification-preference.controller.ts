import {
  notificationPreferencesResponseSchema,
  type NotificationMuteInput,
  type UpdateNotificationPreferencesInput,
} from "@intouch/shared/notifications";
import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { NotificationPreferenceService } from "./notification-preference.service.js";
import type {
  ConversationMuteParams,
  OrganizationMuteParams,
} from "./notification.schemas.js";

const userIdFrom = (locals: AuthLocals) => {
  if (!locals.userId) throw new UnauthorizedError();
  return locals.userId;
};

export interface NotificationPreferenceController {
  get: RequestHandler;
  update: RequestHandler;
  muteOrganization: RequestHandler;
  unmuteOrganization: RequestHandler;
  muteConversation: RequestHandler;
  unmuteConversation: RequestHandler;
}

const createNotificationPreferenceController = (
  service: NotificationPreferenceService,
): NotificationPreferenceController => ({
  get: catchAsync(async (_req, res) => {
    const preferences = await service.get(userIdFrom(res.locals as AuthLocals));
    res
      .status(200)
      .json(notificationPreferencesResponseSchema.parse({ preferences }));
  }),
  update: catchAsync(async (req, res) => {
    const input = req.body as UpdateNotificationPreferencesInput;
    const preferences = await service.update(
      userIdFrom(res.locals as AuthLocals),
      input.categories,
    );
    res
      .status(200)
      .json(notificationPreferencesResponseSchema.parse({ preferences }));
  }),
  muteOrganization: catchAsync(async (req, res) => {
    const { organizationId } = req.params as unknown as OrganizationMuteParams;
    const { mutedUntil } = req.body as NotificationMuteInput;
    const preferences = await service.muteOrganization(
      userIdFrom(res.locals as AuthLocals),
      organizationId,
      mutedUntil,
    );
    res
      .status(200)
      .json(notificationPreferencesResponseSchema.parse({ preferences }));
  }),
  unmuteOrganization: catchAsync(async (req, res) => {
    const { organizationId } = req.params as unknown as OrganizationMuteParams;
    const preferences = await service.unmuteOrganization(
      userIdFrom(res.locals as AuthLocals),
      organizationId,
    );
    res
      .status(200)
      .json(notificationPreferencesResponseSchema.parse({ preferences }));
  }),
  muteConversation: catchAsync(async (req, res) => {
    const { conversationId } = req.params as unknown as ConversationMuteParams;
    const { mutedUntil } = req.body as NotificationMuteInput;
    const preferences = await service.muteConversation(
      userIdFrom(res.locals as AuthLocals),
      conversationId,
      mutedUntil,
    );
    res
      .status(200)
      .json(notificationPreferencesResponseSchema.parse({ preferences }));
  }),
  unmuteConversation: catchAsync(async (req, res) => {
    const { conversationId } = req.params as unknown as ConversationMuteParams;
    const preferences = await service.unmuteConversation(
      userIdFrom(res.locals as AuthLocals),
      conversationId,
    );
    res
      .status(200)
      .json(notificationPreferencesResponseSchema.parse({ preferences }));
  }),
});

export default createNotificationPreferenceController;
