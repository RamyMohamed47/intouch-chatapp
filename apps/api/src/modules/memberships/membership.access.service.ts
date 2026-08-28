import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import { OrganizationNotFoundError } from "../organizations/organization.errors.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import type { NotificationService } from "../notifications/index.js";
import { MembershipConflictError } from "./membership.errors.js";
import {
  createNoopMembershipRealtime,
  type MembershipRealtime,
} from "./membership.realtime.js";
import { MembershipPersistenceConflictError } from "./membership.repository.js";

export interface MembershipAccessServiceDependencies {
  policy: OrganizationPolicy;
  realtime?: MembershipRealtime;
  unitOfWork: OrganizationUnitOfWork;
  notificationDelivery?: Pick<NotificationService, "publishDeleted">;
}

const createMembershipAccessService = ({
  policy,
  realtime = createNoopMembershipRealtime(),
  unitOfWork,
  notificationDelivery = { publishDeleted: () => undefined },
}: MembershipAccessServiceDependencies) => ({
  async joinPublic(userId: string, organizationId: string) {
    try {
      const result = await unitOfWork.run(async (context) => {
        const organization =
          await context.organizations.findById(organizationId);
        const membership = await context.memberships.findForUser(
          userId,
          organizationId,
        );
        policy.assertCanJoinPublic(organization, membership);
        if (!(await context.organizations.lockForMutation(organizationId))) {
          throw new OrganizationNotFoundError();
        }

        const createdMembership = await context.memberships.createMember(
          userId,
          organizationId,
        );
        const invitation = await context.invitations.findByOrganizationAndUser(
          organizationId,
          userId,
        );
        await context.invitations.deleteByOrganizationAndUser(
          organizationId,
          userId,
        );
        const removedNotifications = invitation
          ? await context.notifications.deleteByInvitationId(invitation.id)
          : [];

        return { membership: createdMembership, removedNotifications };
      });
      for (const notification of result.removedNotifications) {
        notificationDelivery.publishDeleted(notification);
      }
      realtime.membershipJoined({ organizationId, userId });
      return result.membership;
    } catch (error) {
      if (error instanceof MembershipPersistenceConflictError) {
        throw new MembershipConflictError();
      }

      throw error;
    }
  },
});

export type MembershipAccessService = ReturnType<
  typeof createMembershipAccessService
>;

export default createMembershipAccessService;
