import type { RequestHandler } from "express";

import {
  createInvitationController,
  createInvitationRouter,
  createInvitationService,
  createMongooseInvitationRepository,
} from "../invitations/index.js";
import {
  createMembershipAccessService,
  createMembershipController,
  createMembershipService,
  createMongooseMembershipRepository,
  createOrganizationAccessRouter,
} from "../memberships/index.js";
import { createMongooseUserRepository } from "../user/index.js";
import createOrganizationController from "./organization.controller.js";
import createOrganizationPolicy from "./organization.policy.js";
import createMongooseOrganizationRepository from "./organization.repository.js";
import createOrganizationRouter from "./organization.routes.js";
import createOrganizationService from "./organization.service.js";
import createMongooseOrganizationUnitOfWork from "./organization.unit-of-work.js";

export interface OrganizationModuleDependencies {
  requireAccessToken: RequestHandler;
}

const createOrganizationModule = ({
  requireAccessToken,
}: OrganizationModuleDependencies) => {
  const organizations = createMongooseOrganizationRepository();
  const invitations = createMongooseInvitationRepository();
  const memberships = createMembershipService(
    createMongooseMembershipRepository(),
  );
  const users = createMongooseUserRepository();
  const unitOfWork = createMongooseOrganizationUnitOfWork();
  const policy = createOrganizationPolicy();
  const service = createOrganizationService({
    organizations,
    memberships,
    unitOfWork,
    policy,
  });
  const controller = createOrganizationController(service);
  const invitationService = createInvitationService({
    invitations,
    organizations,
    policy,
    unitOfWork,
    users,
  });
  const membershipAccessService = createMembershipAccessService({
    policy,
    unitOfWork,
  });
  const invitationController = createInvitationController(invitationService);
  const membershipController = createMembershipController(
    membershipAccessService,
  );
  const router = createOrganizationRouter(controller, requireAccessToken);
  const accessRouter = createOrganizationAccessRouter(
    membershipController,
    invitationController,
    requireAccessToken,
  );
  const invitationRouter = createInvitationRouter(
    invitationController,
    requireAccessToken,
  );

  return { accessRouter, invitationRouter, router };
};

export default createOrganizationModule;
export { default as createOrganizationController } from "./organization.controller.js";
export { default as createMongooseOrganizationRepository } from "./organization.repository.js";
export { default as createOrganizationRouter } from "./organization.routes.js";
export { default as createOrganizationService } from "./organization.service.js";
export { default as createMongooseOrganizationUnitOfWork } from "./organization.unit-of-work.js";
export { default as createOrganizationPolicy } from "./organization.policy.js";
export type { OrganizationController } from "./organization.controller.js";
export type { OrganizationRepository } from "./organization.repository.js";
export type { OrganizationService } from "./organization.service.js";
export type { OrganizationUnitOfWork } from "./organization.unit-of-work.js";
export type { OrganizationPolicy } from "./organization.policy.js";
