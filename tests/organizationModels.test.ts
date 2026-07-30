import assert from "node:assert/strict";
import { describe, test } from "node:test";

import InvitationModel from "../src/modules/invitations/invitation.model.js";
import MembershipModel from "../src/modules/memberships/membership.model.js";
import { MembershipRole } from "../src/modules/memberships/membership.types.js";
import OrganizationModel from "../src/modules/organizations/organization.model.js";

describe("organization persistence indexes", () => {
  test("enforces unique organization slugs", () => {
    const slugIndex = OrganizationModel.schema
      .indexes()
      .find(([, options]) => options.name === "unique_organization_slug");

    assert.ok(slugIndex);
    assert.equal(slugIndex[1].unique, true);
  });

  test("enforces one membership per user and one owner per organization", () => {
    const indexes = MembershipModel.schema.indexes();
    const membershipIndex = indexes.find(
      ([, options]) => options.name === "unique_organization_membership",
    );
    const ownerIndex = indexes.find(
      ([, options]) => options.name === "unique_organization_owner",
    );

    assert.ok(membershipIndex);
    assert.equal(membershipIndex[1].unique, true);
    assert.ok(ownerIndex);
    assert.equal(ownerIndex[1].unique, true);
    assert.deepEqual(ownerIndex[1].partialFilterExpression, {
      role: MembershipRole.OWNER,
    });
  });

  test("indexes pending invitations for uniqueness, recipients, and expiry", () => {
    const indexes = InvitationModel.schema.indexes();
    const uniqueIndex = indexes.find(
      ([, options]) =>
        options.name === "unique_pending_organization_invitation",
    );
    const recipientIndex = indexes.find(
      ([, options]) => options.name === "pending_invitations_by_user",
    );
    const expiryIndex = indexes.find(
      ([, options]) => options.name === "expire_pending_invitations",
    );

    assert.ok(uniqueIndex);
    assert.equal(uniqueIndex[1].unique, true);
    assert.ok(recipientIndex);
    assert.ok(expiryIndex);
    assert.equal(expiryIndex[1].expireAfterSeconds, 0);
  });
});
