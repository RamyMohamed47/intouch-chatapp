import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { OrganizationVisibility } from "@intouch/shared/organizations";

import type { InvitationRepository } from "../src/modules/invitations/index.js";
import createMembershipAccessService from "../src/modules/memberships/membership.access.service.js";
import { MembershipConflictError } from "../src/modules/memberships/membership.errors.js";
import {
  MembershipRole,
  type MembershipRecord,
  type MembershipService,
} from "../src/modules/memberships/index.js";
import { OrganizationNotFoundError } from "../src/modules/organizations/organization.errors.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";
import type { OrganizationRepository } from "../src/modules/organizations/organization.repository.js";
import type { OrganizationRecord } from "../src/modules/organizations/organization.types.js";
import type { OrganizationUnitOfWork } from "../src/modules/organizations/organization.unit-of-work.js";
import { emptyCommunicationContext } from "./unitOfWorkContext.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const now = new Date("2026-07-30T00:00:00.000Z");

const createService = (
  visibility: OrganizationRecord["visibility"],
  existingMembership: MembershipRecord | null = null,
) => {
  const organization: OrganizationRecord = {
    id: organizationId,
    name: "Community",
    slug: "community",
    visibility,
    createdAt: now,
    updatedAt: now,
  };
  let invitationDeleted = false;
  const membershipEvents: { organizationId: string; userId: string }[] = [];
  const organizations: OrganizationRepository = {
    create: async () => organization,
    findById: async () => organization,
    findByIds: async () => [organization],
    lockForMutation: async () => true,
    updateById: async () => organization,
    deleteById: async () => true,
  };
  const memberships: MembershipService = {
    createOwner: async () => {
      throw new Error("unused");
    },
    createMember: async () => ({
      id: "507f1f77bcf86cd799439013",
      userId,
      organizationId,
      role: MembershipRole.MEMBER,
      joinedAt: now,
    }),
    findForUser: async () => existingMembership,
    listForUser: async () => [],
    listForOrganization: async () => [],
    deleteForOrganization: async () => 0,
  };
  const invitations: InvitationRepository = {
    create: async () => {
      throw new Error("unused");
    },
    findById: async () => null,
    findByOrganizationAndUser: async () => null,
    findPendingByUser: async () => [],
    deleteById: async () => false,
    deleteByOrganizationAndUser: async () => {
      invitationDeleted = true;
      return 1;
    },
    deleteExpiredByOrganizationAndUser: async () => 0,
    deleteByOrganizationId: async () => 0,
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

  return {
    service: createMembershipAccessService({
      policy: createOrganizationPolicy(),
      realtime: {
        membershipJoined(event) {
          membershipEvents.push(event);
        },
      },
      unitOfWork,
    }),
    membershipEvents,
    wasInvitationDeleted: () => invitationDeleted,
  };
};

describe("membership access service", () => {
  test("joins a public organization as member and clears pending invites", async () => {
    const harness = createService(OrganizationVisibility.PUBLIC);
    const membership = await harness.service.joinPublic(userId, organizationId);

    assert.equal(membership.role, MembershipRole.MEMBER);
    assert.equal(harness.wasInvitationDeleted(), true);
    assert.deepEqual(harness.membershipEvents, [{ organizationId, userId }]);
  });

  test("conceals private organizations from public joining", async () => {
    await assert.rejects(
      createService(OrganizationVisibility.PRIVATE).service.joinPublic(
        userId,
        organizationId,
      ),
      OrganizationNotFoundError,
    );
  });

  test("rejects users who are already members", async () => {
    await assert.rejects(
      createService(OrganizationVisibility.PUBLIC, {
        id: "507f1f77bcf86cd799439013",
        userId,
        organizationId,
        role: MembershipRole.MEMBER,
        joinedAt: now,
      }).service.joinPublic(userId, organizationId),
      MembershipConflictError,
    );
  });
});
