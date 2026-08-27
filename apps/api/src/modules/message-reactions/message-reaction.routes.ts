import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validateRequest.js";
import type { MessageReactionController } from "./message-reaction.controller.js";
import {
  messageReactionParamsSchema,
  messageReactionUsersQuerySchema,
  setMessageReactionSchema,
} from "./message-reaction.schemas.js";

const createMessageReactionRouter = (
  controller: MessageReactionController,
  requireAccessToken: RequestHandler,
  mutateReactionLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router.get(
    "/:messageId/reactions",
    validateParams(messageReactionParamsSchema),
    controller.getState,
  );
  router.get(
    "/:messageId/reactions/users",
    validateParams(messageReactionParamsSchema),
    validateQuery(messageReactionUsersQuerySchema),
    controller.listUsers,
  );
  router
    .route("/:messageId/reactions/me")
    .put(
      mutateReactionLimit,
      validateParams(messageReactionParamsSchema),
      validateBody(setMessageReactionSchema),
      controller.set,
    )
    .delete(
      mutateReactionLimit,
      validateParams(messageReactionParamsSchema),
      controller.remove,
    );
  return router;
};

export default createMessageReactionRouter;
