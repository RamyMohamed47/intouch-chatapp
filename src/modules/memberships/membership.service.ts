import type { MembershipRepository } from "./membership.repository.js";
import { MembershipRole } from "./membership.types.js";

const createMembershipService = (repository: MembershipRepository) => ({
  createOwner(userId: string, organizationId: string) {
    return repository.create({
      userId,
      organizationId,
      role: MembershipRole.OWNER,
    });
  },

  createMember(userId: string, organizationId: string) {
    return repository.create({
      userId,
      organizationId,
      role: MembershipRole.MEMBER,
    });
  },

  findForUser(userId: string, organizationId: string) {
    return repository.findByUserAndOrganization(userId, organizationId);
  },

  listForUser(userId: string) {
    return repository.findByUser(userId);
  },

  deleteForOrganization(organizationId: string) {
    return repository.deleteByOrganizationId(organizationId);
  },
});

export type MembershipService = ReturnType<typeof createMembershipService>;

export default createMembershipService;
