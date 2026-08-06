import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validateRequest.js";
import type { MessageController } from "./message.controller.js";
import {
  conversationMessagesParamsSchema,
  createMessageSchema,
  messageHistoryQuerySchema,
  messageParamsSchema,
  updateMessageSchema,
} from "./message.schemas.js";

export const createConversationMessageRouter = (
  controller: MessageController,
  requireAccessToken: RequestHandler,
  createMessageLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/:conversationId/messages")
    .get(
      validateParams(conversationMessagesParamsSchema),
      validateQuery(messageHistoryQuerySchema),
      controller.list,
    )
    .post(
      createMessageLimit,
      validateParams(conversationMessagesParamsSchema),
      validateBody(createMessageSchema),
      controller.create,
    );
  return router;
};

export const createMessageRouter = (
  controller: MessageController,
  requireAccessToken: RequestHandler,
  mutateMessageLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/:messageId")
    .patch(
      mutateMessageLimit,
      validateParams(messageParamsSchema),
      validateBody(updateMessageSchema),
      controller.update,
    )
    .delete(
      mutateMessageLimit,
      validateParams(messageParamsSchema),
      controller.delete,
    );
  return router;
};
