import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { OrganizationVisibility } from "@intouch/shared/organizations";

import {
  InvitationConflictError,
  InvitationNotFoundError,
  InvitationTargetNotFoundError,
  type InvitationRecord,
  type InvitationRepository,
} from "../src/modules/invitations/index.js";
import createInvitationService, {
  INVITATION_LIFETIME_MS,
} from "../src/modules/invitations/invitation.service.js";
import { MembershipConflictError } from "../src/modules/memberships/membership.errors.js";
import {
  MembershipRole,
  type MembershipRecord,
  type MembershipService,
} from "../src/modules/memberships/index.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";
import type { OrganizationRepository } from "../src/modules/organizations/organization.repository.js";
import type { OrganizationRecord } from "../src/modules/organizations/organization.types.js";
import type { OrganizationUnitOfWork } from "../src/modules/organizations/organization.unit-of-work.js";
import type { AuthUserRepository } from "../src/modules/user/user.repository.js";
import { EmailVerificationStatus } from "../src/modules/user/user.types.js";
import type { PublicUser } from "../src/modules/user/user.types.js";
import {
  emptyCommunicationContext,
  testMailFactory,
} from "./unitOfWorkContext.js";

const now = new Date("2026-07-30T00:00:00.000Z");
const inviterUserId = "507f1f77bcf86cd799439011";
const invitedUserId = "507f1f77bcf86cd799439012";
const organizationId = "507f1f77bcf86cd799439013";
const invitationId = "507f1f77bcf86cd799439014";

const organization: OrganizationRecord = {
  id: organizationId,
  name: "Product Team",
  slug: "product-team",
  visibility: OrganizationVisibility.PRIVATE,
  createdAt: now,
  updatedAt: now,
};
const invitedUser: PublicUser = {
  id: invitedUserId,
  username: "new_member",
  displayName: "New Member",
  email: "member@example.com",
  createdAt: now,
  updatedAt: now,
};

interface HarnessOptions {
  existingInvitation?: InvitationRecord;
  invitedUserExists?: boolean;
  targetIsMember?: boolean;
}

const createHarness = ({
  existingInvitation,
  invitedUserExists = true,
  targetIsMember = false,
}: HarnessOptions = {}) => {
  const records = existingInvitation ? [existingInvitation] : [];
  const membershipEvents: { organizationId: string; userId: string }[] = [];
  let targetMembership: MembershipRecord | null = targetIsMember
    ? {
        id: "507f1f77bcf86cd799439015",
        userId: invitedUserId,
        organizationId,
        role: MembershipRole.MEMBER,
        joinedAt: now,
      }
    : null;
  const ownerMembership: MembershipRecord = {
    id: "507f1f77bcf86cd799439016",
    userId: inviterUserId,
    organizationId,
    role: MembershipRole.OWNER,
    joinedAt: now,
  };

  const invitations: InvitationRepository = {
    async create(input) {
      const record: InvitationRecord = {
        id: invitationId,
        ...input,
        createdAt: now,
      };
      records.push(record);
      return record;
    },
    async findById(id) {
      return records.find((record) => record.id === id) ?? null;
    },
    async findByOrganizationAndUser(orgId, userId) {
      return (
        records.find(
          (record) =>
            record.organizationId === orgId && record.invitedUserId === userId,
        ) ?? null
      );
    },
    async findPendingByUser(userId, currentTime) {
      return records.filter(
        (record) =>
          record.invitedUserId === userId && record.expiresAt > currentTime,
      );
    },
    async deleteById(id) {
      const index = records.findIndex((record) => record.id === id);

      if (index < 0) {
        return false;
      }

      records.splice(index, 1);
      return true;
    },
    async deleteByOrganizationAndUser(orgId, userId) {
      const before = records.length;
      for (let index = records.length - 1; index >= 0; index -= 1) {
        const record = records[index];

        if (
          record?.organizationId === orgId &&
          record.invitedUserId === userId
        ) {
          records.splice(index, 1);
        }
      }
      return before - records.length;
    },
    async deleteExpiredByOrganizationAndUser(orgId, userId, currentTime) {
      const before = records.length;
      for (let index = records.length - 1; index >= 0; index -= 1) {
        const record = records[index];

        if (
          record?.organizationId === orgId &&
          record.invitedUserId === userId &&
          record.expiresAt <= currentTime
        ) {
          records.splice(index, 1);
        }
      }
      return before - records.length;
    },
    async deleteByOrganizationId(orgId) {
      const before = records.length;
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (records[index]?.organizationId === orgId) {
          records.splice(index, 1);
        }
      }
      return before - records.length;
    },
  };
  const organizations: OrganizationRepository = {
    create: async () => organization,
    findById: async () => organization,
    findByIds: async () => [organization],
    lockForMutation: async () => true,
    updateById: async () => organization,
    deleteById: async () => true,
  };
  const memberships: MembershipService = {
    createOwner: async () => ownerMembership,
    createMember: async () => {
      targetMembership = {
        id: "507f1f77bcf86cd799439017",
        userId: invitedUserId,
        organizationId,
        role: MembershipRole.MEMBER,
        joinedAt: now,
      };
      return targetMembership;
    },
    findForUser: async (userId) =>
      userId === inviterUserId ? ownerMembership : targetMembership,
    listForUser: async () => [],
    listForOrganization: async () => [ownerMembership],
    deleteForOrganization: async () => 0,
  };
  const users: AuthUserRepository = {
    hasIdentityConflict: async () => false,
    createPasswordUser: async () => invitedUser,
    createGoogleUser: async () => invitedUser,
    findPasswordUserByEmail: async () => null,
    findAuthAccountByEmail: async () => ({
      user: invitedUser,
      hasPassword: true,
      emailVerificationStatus: EmailVerificationStatus.VERIFIED,
    }),
    findVerifiedPublicByEmail: async () =>
      invitedUserExists ? invitedUser : null,
    findPublicByEmail: async () => (invitedUserExists ? invitedUser : null),
    findPublicById: async () => invitedUser,
    findPublicByIds: async () => [invitedUser],
    findLastSeenByIds: async () => [],
    linkGoogleProvider: async () => invitedUser,
    touchPasswordProvider: async () => undefined,
    useGoogleProvider: async () => invitedUser,
    usernameExists: async () => false,
    updateLastSeen: async () => undefined,
    markEmailVerified: async () => true,
    updatePasswordAndVerify: async () => invitedUser,
  };
  const unitOfWork: OrganizationUnitOfWork = {
    run: (work) =>
      work({
        ...emptyCommunicationContext,
        organizations,
        memberships,
        invitations,
      }),
  };
  const service = createInvitationService({
    invitations,
    organizations,
    policy: createOrganizationPolicy(),
    realtime: {
      membershipJoined(event) {
        membershipEvents.push(event);
      },
    },
    unitOfWork,
    users,
    now: () => now,
    mail: testMailFactory,
  });

  return { membershipEvents, records, service };
};

describe("invitation service", () => {
  test("creates a seven-day invitation for a registered user", async () => {
    const { records, service } = createHarness();
    const result = await service.create(inviterUserId, organizationId, {
      email: invitedUser.email,
    });

    assert.equal(records.length, 1);
    assert.equal(result.invitedUserId, invitedUserId);
    assert.equal(
      result.expiresAt.getTime(),
      now.getTime() + INVITATION_LIFETIME_MS,
    );
    assert.equal(result.organization.name, organization.name);
  });

  test("rejects unknown users, existing members, and duplicate invitations", async () => {
    await assert.rejects(
      createHarness({ invitedUserExists: false }).service.create(
        inviterUserId,
        organizationId,
        { email: "missing@example.com" },
      ),
      InvitationTargetNotFoundError,
    );
    await assert.rejects(
      createHarness({ targetIsMember: true }).service.create(
        inviterUserId,
        organizationId,
        { email: invitedUser.email },
      ),
      MembershipConflictError,
    );
    await assert.rejects(
      createHarness({
        existingInvitation: {
          id: invitationId,
          organizationId,
          invitedUserId,
          invitedByUserId: inviterUserId,
          expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
          createdAt: now,
        },
      }).service.create(inviterUserId, organizationId, {
        email: invitedUser.email,
      }),
      InvitationConflictError,
    );
  });

  test("replaces an expired invitation", async () => {
    const { records, service } = createHarness({
      existingInvitation: {
        id: "507f1f77bcf86cd799439099",
        organizationId,
        invitedUserId,
        invitedByUserId: inviterUserId,
        expiresAt: new Date(now.getTime() - 1),
        createdAt: now,
      },
    });

    const result = await service.create(inviterUserId, organizationId, {
      email: invitedUser.email,
    });

    assert.equal(records.length, 1);
    assert.equal(result.id, invitationId);
  });

  test("lists only current invitations with organization summaries", async () => {
    const { service } = createHarness({
      existingInvitation: {
        id: invitationId,
        organizationId,
        invitedUserId,
        invitedByUserId: inviterUserId,
        expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
        createdAt: now,
      },
    });

    const result = await service.listForUser(invitedUserId);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.organization.slug, organization.slug);
  });

  test("accepts and consumes an invitation", async () => {
    const { membershipEvents, records, service } = createHarness({
      existingInvitation: {
        id: invitationId,
        organizationId,
        invitedUserId,
        invitedByUserId: inviterUserId,
        expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
        createdAt: now,
      },
    });

    const result = await service.accept(invitedUserId, invitationId);

    assert.equal(result.role, MembershipRole.MEMBER);
    assert.equal(records.length, 0);
    assert.deepEqual(membershipEvents, [
      { organizationId, userId: invitedUserId },
    ]);
  });

  test("rejects expired or mismatched invitation access", async () => {
    const expired = createHarness({
      existingInvitation: {
        id: invitationId,
        organizationId,
        invitedUserId,
        invitedByUserId: inviterUserId,
        expiresAt: now,
        createdAt: now,
      },
    });

    await assert.rejects(
      expired.service.accept(invitedUserId, invitationId),
      InvitationNotFoundError,
    );
    await assert.rejects(
      expired.service.decline(inviterUserId, invitationId),
      InvitationNotFoundError,
    );
  });

  test("allows the recipient to decline", async () => {
    const { records, service } = createHarness({
      existingInvitation: {
        id: invitationId,
        organizationId,
        invitedUserId,
        invitedByUserId: inviterUserId,
        expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
        createdAt: now,
      },
    });

    await service.decline(invitedUserId, invitationId);
    assert.equal(records.length, 0);
  });
});
