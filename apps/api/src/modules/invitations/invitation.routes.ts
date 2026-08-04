import express, { type RequestHandler } from "express";

import { validateParams } from "../../middleware/validateRequest.js";
import type { InvitationController } from "./invitation.controller.js";
import { invitationIdParamsSchema } from "./invitation.schemas.js";

const createInvitationRouter = (
  controller: InvitationController,
  requireAccessToken: RequestHandler,
) => {
  const router = express.Router();

  router.use(requireAccessToken);
  router.get("/", controller.list);
  router.post(
    "/:id/accept",
    validateParams(invitationIdParamsSchema),
    controller.accept,
  );
  router.delete(
    "/:id",
    validateParams(invitationIdParamsSchema),
    controller.decline,
  );

  return router;
};

export default createInvitationRouter;
