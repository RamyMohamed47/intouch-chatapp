import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { OrganizationVisibility } from "@intouch/shared/organizations";

import createMembershipDirectoryService from "../src/modules/memberships/membership-directory.service.js";
import { MembershipRole } from "../src/modules/memberships/membership.types.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";
import { PresenceStatus } from "../src/modules/presence/presence.types.js";

const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const now = new Date("2026-08-03T12:00:00.000Z");

describe("membershipDirectoryService", () => {
  test("allows members to list safe roster summaries with runtime presence", async () => {
    const membership = {
      id: "507f1f77bcf86cd799439013",
      userId,
      organizationId,
      role: MembershipRole.MEMBER,
      joinedAt: now,
    };
    const service = createMembershipDirectoryService({
      memberships: {
        createOwner: async () => membership,
        createMember: async () => membership,
        findForUser: async () => membership,
        listForUser: async () => [membership],
        listForOrganization: async () => [membership],
        deleteForOrganization: async () => 0,
      },
      organizations: {
        create: async () => {
          throw new Error("unused");
        },
        findById: async () => ({
          id: organizationId,
          name: "Team",
          slug: "team",
          visibility: OrganizationVisibility.PRIVATE,
          createdAt: now,
          updatedAt: now,
        }),
        findByIds: async () => [],
        lockForMutation: async () => true,
        updateById: async () => null,
        replaceLogoAsset: async () => null,
        deleteById: async () => false,
      },
      policy: createOrganizationPolicy(),
      presence: {
        getMany: async () => [
          {
            userId,
            status: PresenceStatus.ONLINE,
            lastSeenAt: null,
          },
        ],
      },
      users: {
        findPublicByIds: async () => [
          {
            id: userId,
            username: "member",
            displayName: "Member",
            email: "private@example.com",
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    });

    const [member] = await service.listMembers(userId, organizationId);
    assert.deepEqual(member?.user, {
      id: userId,
      username: "member",
      displayName: "Member",
      avatarAssetId: null,
      status: PresenceStatus.ONLINE,
      lastSeenAt: null,
    });
    assert.equal("email" in (member?.user ?? {}), false);
  });
});
