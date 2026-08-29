import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { ChatWallpaperController } from "./chat-wallpaper.controller.js";
import {
  chatWallpaperConversationParamsSchema,
  updateChatWallpaperSchema,
} from "./chat-wallpaper.schemas.js";

export const createUserChatWallpaperRouter = (
  controller: ChatWallpaperController,
  requireAccessToken: RequestHandler,
  mutateLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/me/chat-wallpaper")
    .get(controller.getDefault)
    .put(
      mutateLimit,
      validateBody(updateChatWallpaperSchema),
      controller.setDefault,
    );
  return router;
};

export const createConversationChatWallpaperRouter = (
  controller: ChatWallpaperController,
  requireAccessToken: RequestHandler,
  mutateLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/:conversationId/chat-wallpaper")
    .get(
      validateParams(chatWallpaperConversationParamsSchema),
      controller.getForConversation,
    )
    .put(
      mutateLimit,
      validateParams(chatWallpaperConversationParamsSchema),
      validateBody(updateChatWallpaperSchema),
      controller.setForConversation,
    )
    .delete(
      mutateLimit,
      validateParams(chatWallpaperConversationParamsSchema),
      controller.resetConversation,
    );
  return router;
};
