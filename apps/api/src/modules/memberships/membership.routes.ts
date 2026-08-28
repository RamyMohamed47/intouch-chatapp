import express, { type RequestHandler } from "express";

import {
  validateBody,
  validateParams,
} from "../../middleware/validateRequest.js";
import type { InvitationController } from "../invitations/invitation.controller.js";
import { inviteMemberSchema } from "../invitations/invitation.schemas.js";
import { organizationIdParamsSchema } from "../organizations/organization.schemas.js";
import type { MembershipController } from "./membership.controller.js";

const createOrganizationAccessRouter = (
  membershipController: MembershipController,
  invitationController: InvitationController,
  requireAccessToken: RequestHandler,
  createInvitationLimit: RequestHandler = (_req, _res, next) => next(),
) => {
  const router = express.Router();

  router.use(requireAccessToken);
  router.post(
    "/:id/join",
    validateParams(organizationIdParamsSchema),
    membershipController.joinPublic,
  );
  router.get(
    "/:id/members",
    validateParams(organizationIdParamsSchema),
    membershipController.listMembers,
  );
  router.post(
    "/:id/invitations",
    validateParams(organizationIdParamsSchema),
    createInvitationLimit,
    validateBody(inviteMemberSchema),
    invitationController.create,
  );

  return router;
};

export default createOrganizationAccessRouter;
