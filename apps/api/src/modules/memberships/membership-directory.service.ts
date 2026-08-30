import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import type { OrganizationRepository } from "../organizations/organization.repository.js";
import type { PresenceService } from "../presence/index.js";
import type { UserRepository } from "../user/user.repository.js";
import type { MembershipService } from "./membership.service.js";

export interface MembershipDirectoryServiceDependencies {
  memberships: MembershipService;
  organizations: OrganizationRepository;
  policy: OrganizationPolicy;
  presence: Pick<PresenceService, "getMany">;
  users: Pick<UserRepository, "findPublicByIds">;
}

const createMembershipDirectoryService = ({
  memberships,
  organizations,
  policy,
  presence,
  users,
}: MembershipDirectoryServiceDependencies) => {
  const assertMember = async (userId: string, organizationId: string) => {
    const organization = await organizations.findById(organizationId);
    const membership = await memberships.findForUser(userId, organizationId);
    policy.assertMember(organization, membership);
  };

  return {
    assertMember,

    async listMembers(userId: string, organizationId: string) {
      await assertMember(userId, organizationId);
      const records = await memberships.listForOrganization(organizationId);
      const memberIds = records.map(({ userId: memberId }) => memberId);
      const [publicUsers, presenceRecords] = await Promise.all([
        users.findPublicByIds(memberIds),
        presence.getMany(memberIds),
      ]);
      const usersById = new Map(publicUsers.map((user) => [user.id, user]));
      const presenceById = new Map(
        presenceRecords.map((record) => [record.userId, record]),
      );

      return records.flatMap((record) => {
        const user = usersById.get(record.userId);
        const memberPresence = presenceById.get(record.userId);
        if (!user || !memberPresence) return [];
        return [
          {
            membershipId: record.id,
            role: record.role,
            joinedAt: record.joinedAt,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarAssetId: user.avatarAssetId ?? null,
              ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
              status: memberPresence.status,
              lastSeenAt: memberPresence.lastSeenAt,
            },
          },
        ];
      });
    },
  };
};

export type MembershipDirectoryService = ReturnType<
  typeof createMembershipDirectoryService
>;
export default createMembershipDirectoryService;
