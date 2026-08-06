import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validateRequest.js";
import type { DirectMessageController } from "./direct-message.controller.js";
import {
  createDirectMessageSchema,
  directMessageOrganizationParamsSchema,
  listDirectMessagesQuerySchema,
} from "./direct-message.schemas.js";

const createDirectMessageRouter = (
  controller: DirectMessageController,
  requireAccessToken: RequestHandler,
  createDirectMessageLimit: RequestHandler,
) => {
  const router = express.Router();
  router.use(requireAccessToken);
  router
    .route("/:organizationId/direct-messages")
    .get(
      validateParams(directMessageOrganizationParamsSchema),
      validateQuery(listDirectMessagesQuerySchema),
      controller.list,
    )
    .post(
      createDirectMessageLimit,
      validateParams(directMessageOrganizationParamsSchema),
      validateBody(createDirectMessageSchema),
      controller.create,
    );
  return router;
};

export default createDirectMessageRouter;
