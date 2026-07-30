import type { RequestHandler } from "express";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import catchAsync from "../../utils/catchAsync.js";
import type { AuthLocals } from "../auth/auth.types.js";
import type { OrganizationIdParams } from "../organizations/organization.schemas.js";
import type { MembershipAccessService } from "./membership.access.service.js";

export interface MembershipController {
  joinPublic: RequestHandler;
}

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) {
    throw new UnauthorizedError();
  }

  return locals.userId;
};

const createMembershipController = (
  service: MembershipAccessService,
): MembershipController => ({
  joinPublic: catchAsync(async (req, res) => {
    const { id } = req.params as unknown as OrganizationIdParams;
    const membership = await service.joinPublic(
      getUserId(res.locals as AuthLocals),
      id,
    );

    res.status(201).json({ membership });
  }),
});

export default createMembershipController;
