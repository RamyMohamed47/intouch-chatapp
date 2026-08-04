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
      validateParams(conversationMessagesParamsSchema),
      validateBody(createMessageSchema),
      controller.create,
    );
  return router;
};

export const createMessageRouter = (
  controller: MessageController,
  requireAccessToken: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/:messageId")
    .patch(
      validateParams(messageParamsSchema),
      validateBody(updateMessageSchema),
      controller.update,
    )
    .delete(validateParams(messageParamsSchema), controller.delete);
  return router;
};
