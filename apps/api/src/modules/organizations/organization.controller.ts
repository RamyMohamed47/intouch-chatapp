import type { RequestHandler } from "express";
import {
  organizationListResponseSchema,
  organizationResponseSchema,
} from "@intouch/shared/organizations";

import UnauthorizedError from "../../errors/UnauthorizedError.js";
import type { AuthLocals } from "../auth/auth.types.js";
import catchAsync from "../../utils/catchAsync.js";
import type { OrganizationIdParams } from "./organization.schemas.js";
import type { OrganizationService } from "./organization.service.js";
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "./organization.types.js";

export interface OrganizationController {
  create: RequestHandler;
  list: RequestHandler;
  getById: RequestHandler;
  update: RequestHandler;
  delete: RequestHandler;
}

const getUserId = (locals: AuthLocals) => {
  if (!locals.userId) {
    throw new UnauthorizedError();
  }

  return locals.userId;
};

const createOrganizationController = (
  service: OrganizationService,
): OrganizationController => ({
  create: catchAsync(async (req, res) => {
    const organization = await service.create(
      getUserId(res.locals as AuthLocals),
      req.body as CreateOrganizationInput,
    );

    res.status(201).json(organizationResponseSchema.parse({ organization }));
  }),

  list: catchAsync(async (_req, res) => {
    const organizations = await service.listForUser(
      getUserId(res.locals as AuthLocals),
    );

    res
      .status(200)
      .json(organizationListResponseSchema.parse({ organizations }));
  }),

  getById: catchAsync(async (req, res) => {
    const { id } = req.params as unknown as OrganizationIdParams;
    const organization = await service.getById(
      getUserId(res.locals as AuthLocals),
      id,
    );

    res.status(200).json(organizationResponseSchema.parse({ organization }));
  }),

  update: catchAsync(async (req, res) => {
    const { id } = req.params as unknown as OrganizationIdParams;
    const organization = await service.update(
      getUserId(res.locals as AuthLocals),
      id,
      req.body as UpdateOrganizationInput,
    );

    res.status(200).json(organizationResponseSchema.parse({ organization }));
  }),

  delete: catchAsync(async (req, res) => {
    const { id } = req.params as unknown as OrganizationIdParams;
    await service.delete(getUserId(res.locals as AuthLocals), id);

    res.status(204).send();
  }),
});

export default createOrganizationController;
