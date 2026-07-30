import mongoose from "mongoose";

import createMongooseInvitationRepository, {
  type InvitationRepository,
} from "../invitations/invitation.repository.js";
import {
  createMembershipService,
  createMongooseMembershipRepository,
  type MembershipService,
} from "../memberships/index.js";
import createMongooseOrganizationRepository, {
  type OrganizationRepository,
} from "./organization.repository.js";

export interface OrganizationWorkContext {
  organizations: OrganizationRepository;
  memberships: MembershipService;
  invitations: InvitationRepository;
}

export interface OrganizationUnitOfWork {
  run<T>(work: (context: OrganizationWorkContext) => Promise<T>): Promise<T>;
}

const createMongooseOrganizationUnitOfWork = (): OrganizationUnitOfWork => ({
  run(work) {
    return mongoose.connection.transaction((session) => {
      const memberships = createMembershipService(
        createMongooseMembershipRepository(session),
      );
      const organizations = createMongooseOrganizationRepository(session);
      const invitations = createMongooseInvitationRepository(session);

      return work({ organizations, memberships, invitations });
    });
  },
});

export default createMongooseOrganizationUnitOfWork;
