import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { OrganizationVisibility } from "@intouch/shared/organizations";

import { InvitationNotFoundError } from "../src/modules/invitations/index.js";
import { MembershipConflictError } from "../src/modules/memberships/membership.errors.js";
import {
  MembershipRole,
  type MembershipRecord,
} from "../src/modules/memberships/membership.types.js";
import {
  OrganizationForbiddenError,
  OrganizationNotFoundError,
} from "../src/modules/organizations/organization.errors.js";
import createOrganizationPolicy from "../src/modules/organizations/organization.policy.js";
import type { OrganizationRecord } from "../src/modules/organizations/organization.types.js";

const now = new Date("2026-07-30T00:00:00.000Z");
const userId = "507f1f77bcf86cd799439011";
const organization: OrganizationRecord = {
  id: "507f1f77bcf86cd799439012",
  name: "Product Team",
  slug: "product-team",
  visibility: OrganizationVisibility.PRIVATE,
  createdAt: now,
  updatedAt: now,
};
const member = (role: MembershipRecord["role"]): MembershipRecord => ({
  id: "507f1f77bcf86cd799439013",
  userId,
  organizationId: organization.id,
  role,
  joinedAt: now,
});

describe("organization policy", () => {
  const policy = createOrganizationPolicy();

  test("allows members to view private organizations", () => {
    assert.equal(
      policy.assertVisible(organization, member(MembershipRole.MEMBER)),
      organization,
    );
  });

  test("conceals private organizations from non-members", () => {
    assert.throws(
      () => policy.assertVisible(organization, null),
      OrganizationNotFoundError,
    );
  });

  test("requires owners for invitation management", () => {
    assert.equal(
      policy.assertCanInvite(organization, member(MembershipRole.OWNER)),
      organization,
    );
    assert.throws(
      () => policy.assertCanInvite(organization, member(MembershipRole.MEMBER)),
      OrganizationForbiddenError,
    );
  });

  test("allows only non-members to join public organizations", () => {
    const publicOrganization = {
      ...organization,
      visibility: OrganizationVisibility.PUBLIC,
    };

    assert.equal(
      policy.assertCanJoinPublic(publicOrganization, null),
      publicOrganization,
    );
    assert.throws(
      () =>
        policy.assertCanJoinPublic(
          publicOrganization,
          member(MembershipRole.MEMBER),
        ),
      MembershipConflictError,
    );
    assert.throws(
      () => policy.assertCanJoinPublic(organization, null),
      OrganizationNotFoundError,
    );
  });

  test("allows only the unexpired invitation recipient", () => {
    const invitation = {
      id: "507f1f77bcf86cd799439014",
      organizationId: organization.id,
      invitedUserId: userId,
      invitedByUserId: "507f1f77bcf86cd799439015",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: now,
    };

    assert.equal(
      policy.assertInvitationRecipient(invitation, userId, now),
      invitation,
    );
    assert.throws(
      () =>
        policy.assertInvitationRecipient(
          invitation,
          "507f1f77bcf86cd799439099",
          now,
        ),
      InvitationNotFoundError,
    );
    assert.throws(
      () =>
        policy.assertInvitationRecipient(
          invitation,
          userId,
          invitation.expiresAt,
        ),
      InvitationNotFoundError,
    );
  });
});
