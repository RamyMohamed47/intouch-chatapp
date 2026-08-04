import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import { OrganizationNotFoundError } from "../organizations/organization.errors.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import { MembershipConflictError } from "./membership.errors.js";
import { MembershipPersistenceConflictError } from "./membership.repository.js";

export interface MembershipAccessServiceDependencies {
  policy: OrganizationPolicy;
  unitOfWork: OrganizationUnitOfWork;
}

const createMembershipAccessService = ({
  policy,
  unitOfWork,
}: MembershipAccessServiceDependencies) => ({
  async joinPublic(userId: string, organizationId: string) {
    try {
      return await unitOfWork.run(async (context) => {
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
        await context.invitations.deleteByOrganizationAndUser(
          organizationId,
          userId,
        );

        return createdMembership;
      });
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
