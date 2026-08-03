import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validateRequest.js";
import type { ConversationController } from "./conversation.controller.js";
import {
  addConversationParticipantSchema,
  conversationParamsSchema,
  conversationParticipantParamsSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  organizationConversationsParamsSchema,
  updateConversationSchema,
} from "./conversation.schemas.js";

export const createOrganizationConversationRouter = (
  controller: ConversationController,
  requireAccessToken: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.get(
    "/:organizationId/members",
    validateParams(organizationConversationsParamsSchema),
    controller.listOrganizationMembers,
  );
  router
    .route("/:organizationId/conversations")
    .get(
      validateParams(organizationConversationsParamsSchema),
      validateQuery(listConversationsQuerySchema),
      controller.list,
    )
    .post(
      validateParams(organizationConversationsParamsSchema),
      validateBody(createConversationSchema),
      controller.create,
    );
  return router;
};

export const createConversationRouter = (
  controller: ConversationController,
  requireAccessToken: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/:conversationId")
    .get(validateParams(conversationParamsSchema), controller.getById)
    .patch(
      validateParams(conversationParamsSchema),
      validateBody(updateConversationSchema),
      controller.update,
    )
    .delete(validateParams(conversationParamsSchema), controller.delete);
  router
    .route("/:conversationId/participants")
    .get(validateParams(conversationParamsSchema), controller.listParticipants)
    .post(
      validateParams(conversationParamsSchema),
      validateBody(addConversationParticipantSchema),
      controller.addParticipant,
    );
  router.delete(
    "/:conversationId/participants/:userId",
    validateParams(conversationParticipantParamsSchema),
    controller.removeParticipant,
  );
  return router;
};
