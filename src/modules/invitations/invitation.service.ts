import type { InviteMemberInput } from "@intouch/shared/memberships";

import type { UserRepository } from "../user/index.js";
import { MembershipConflictError } from "../memberships/membership.errors.js";
import { MembershipPersistenceConflictError } from "../memberships/membership.repository.js";
import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import { OrganizationNotFoundError } from "../organizations/organization.errors.js";
import type { OrganizationRepository } from "../organizations/organization.repository.js";
import type { OrganizationRecord } from "../organizations/organization.types.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import {
  InvitationConflictError,
  InvitationNotFoundError,
  InvitationTargetNotFoundError,
} from "./invitation.errors.js";
import {
  InvitationPersistenceConflictError,
  type InvitationRepository,
} from "./invitation.repository.js";
import type { InvitationRecord, PublicInvitation } from "./invitation.types.js";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface InvitationServiceDependencies {
  invitations: InvitationRepository;
  organizations: OrganizationRepository;
  policy: OrganizationPolicy;
  unitOfWork: OrganizationUnitOfWork;
  users: UserRepository;
  now?: () => Date;
}

const toPublicInvitation = (
  invitation: InvitationRecord,
  organization: OrganizationRecord,
): PublicInvitation => {
  const result: PublicInvitation = {
    ...invitation,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      visibility: organization.visibility,
    },
  };

  if (organization.logoUrl) {
    result.organization.logoUrl = organization.logoUrl;
  }

  return result;
};

const createInvitationService = ({
  invitations,
  organizations,
  policy,
  unitOfWork,
  users,
  now = () => new Date(),
}: InvitationServiceDependencies) => ({
  async create(
    inviterUserId: string,
    organizationId: string,
    input: InviteMemberInput,
  ) {
    const invitedUser = await users.findPublicByEmail(input.email);

    if (!invitedUser) {
      throw new InvitationTargetNotFoundError();
    }

    const currentTime = now();
    const expiresAt = new Date(currentTime.getTime() + INVITATION_LIFETIME_MS);

    try {
      return await unitOfWork.run(async (context) => {
        const organization =
          await context.organizations.findById(organizationId);
        const inviterMembership = await context.memberships.findForUser(
          inviterUserId,
          organizationId,
        );
        const authorizedOrganization = policy.assertCanInvite(
          organization,
          inviterMembership,
        );
        if (!(await context.organizations.lockForMutation(organizationId))) {
          throw new OrganizationNotFoundError();
        }
        const invitedUserMembership = await context.memberships.findForUser(
          invitedUser.id,
          organizationId,
        );

        if (invitedUserMembership) {
          throw new MembershipConflictError();
        }

        await context.invitations.deleteExpiredByOrganizationAndUser(
          organizationId,
          invitedUser.id,
          currentTime,
        );
        const existingInvitation =
          await context.invitations.findByOrganizationAndUser(
            organizationId,
            invitedUser.id,
          );

        if (existingInvitation) {
          throw new InvitationConflictError();
        }

        const invitation = await context.invitations.create({
          organizationId,
          invitedUserId: invitedUser.id,
          invitedByUserId: inviterUserId,
          expiresAt,
        });

        return toPublicInvitation(invitation, authorizedOrganization);
      });
    } catch (error) {
      if (error instanceof InvitationPersistenceConflictError) {
        throw new InvitationConflictError();
      }

      throw error;
    }
  },

  async listForUser(userId: string) {
    const pendingInvitations = await invitations.findPendingByUser(
      userId,
      now(),
    );
    const invitationByOrganizationId = new Map(
      pendingInvitations.map((invitation) => [
        invitation.organizationId,
        invitation,
      ]),
    );
    const invitationOrganizations = await organizations.findByIds([
      ...invitationByOrganizationId.keys(),
    ]);

    return invitationOrganizations.flatMap((organization) => {
      const invitation = invitationByOrganizationId.get(organization.id);
      return invitation ? [toPublicInvitation(invitation, organization)] : [];
    });
  },

  async accept(userId: string, invitationId: string) {
    const currentTime = now();

    try {
      return await unitOfWork.run(async (context) => {
        const invitation = policy.assertInvitationRecipient(
          await context.invitations.findById(invitationId),
          userId,
          currentTime,
        );
        const organization = await context.organizations.findById(
          invitation.organizationId,
        );

        if (!organization) {
          throw new InvitationNotFoundError();
        }
        if (
          !(await context.organizations.lockForMutation(
            invitation.organizationId,
          ))
        ) {
          throw new InvitationNotFoundError();
        }

        const membership = await context.memberships.findForUser(
          userId,
          invitation.organizationId,
        );

        if (membership) {
          throw new MembershipConflictError();
        }

        const createdMembership = await context.memberships.createMember(
          userId,
          invitation.organizationId,
        );
        const consumed = await context.invitations.deleteById(invitation.id);

        if (!consumed) {
          throw new InvitationNotFoundError();
        }

        return createdMembership;
      });
    } catch (error) {
      if (error instanceof MembershipPersistenceConflictError) {
        throw new MembershipConflictError();
      }

      throw error;
    }
  },

  async decline(userId: string, invitationId: string) {
    const invitation = policy.assertInvitationRecipient(
      await invitations.findById(invitationId),
      userId,
      now(),
    );
    const deleted = await invitations.deleteById(invitation.id);

    if (!deleted) {
      throw new InvitationNotFoundError();
    }
  },
});

export type InvitationService = ReturnType<typeof createInvitationService>;

export { INVITATION_LIFETIME_MS };
export default createInvitationService;
