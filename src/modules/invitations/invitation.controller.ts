import type { RequestHandler } from "express";

import type { InviteMemberInput } from "@intouch/shared/memberships";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { OrganizationIdParams } from "../organizations/organization.schemas.js";
import type { InvitationIdParams } from "./invitation.schemas.js";
import type { InvitationService } from "./invitation.service.js";

export interface InvitationController {
  create: RequestHandler;
  list: RequestHandler;
  accept: RequestHandler;
  decline: RequestHandler;
}

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) {
    throw new UnauthorizedError();
  }

  return locals.userId;
};

const createInvitationController = (
  service: InvitationService,
): InvitationController => ({
  create: catchAsync(async (req, res) => {
    const { id } = req.params as unknown as OrganizationIdParams;
    const invitation = await service.create(
      getUserId(res.locals as AuthLocals),
      id,
      req.body as InviteMemberInput,
    );

    res.status(201).json({ invitation });
  }),

  list: catchAsync(async (_req, res) => {
    const invitations = await service.listForUser(
      getUserId(res.locals as AuthLocals),
    );

    res.status(200).json({ invitations });
  }),

  accept: catchAsync(async (req, res) => {
    const { id } = req.params as unknown as InvitationIdParams;
    const membership = await service.accept(
      getUserId(res.locals as AuthLocals),
      id,
    );

    res.status(201).json({ membership });
  }),

  decline: catchAsync(async (req, res) => {
    const { id } = req.params as unknown as InvitationIdParams;
    await service.decline(getUserId(res.locals as AuthLocals), id);

    res.status(204).send();
  }),
});

export default createInvitationController;
