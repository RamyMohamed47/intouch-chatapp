import assert from "node:assert/strict";
import { describe, test } from "node:test";

import InvitationModel from "../src/modules/invitations/invitation.model.js";
import CategoryModel from "../src/modules/categories/category.model.js";
import ConversationParticipantModel from "../src/modules/conversations/conversation-participant.model.js";
import ConversationModel from "../src/modules/conversations/conversation.model.js";
import MembershipModel from "../src/modules/memberships/membership.model.js";
import { MembershipRole } from "../src/modules/memberships/membership.types.js";
import OrganizationModel from "../src/modules/organizations/organization.model.js";
import MessageModel from "../src/modules/message/message.model.js";
import ConversationReadStateModel from "../src/modules/read-receipts/read-receipt.model.js";

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

  test("indexes ordered categories and unique names per organization", () => {
    const indexes = CategoryModel.schema.indexes();
    const uniqueName = indexes.find(
      ([, options]) => options.name === "unique_category_name_per_organization",
    );
    const ordering = indexes.find(
      ([, options]) => options.name === "categories_by_position",
    );
    assert.equal(uniqueName?.[1].unique, true);
    assert.ok(ordering);
  });

  test("indexes channel names, participants, and message cursors", () => {
    const conversationName = ConversationModel.schema
      .indexes()
      .find(
        ([, options]) => options.name === "unique_channel_name_per_category",
      );
    const directPair = ConversationModel.schema
      .indexes()
      .find(
        ([, options]) => options.name === "unique_direct_conversation_pair",
      );
    const directActivityIndexes = ConversationModel.schema
      .indexes()
      .filter(([, options]) =>
        options.name?.startsWith("direct_conversations_by_"),
      );
    const participant = ConversationParticipantModel.schema
      .indexes()
      .find(
        ([, options]) => options.name === "unique_conversation_participant",
      );
    const messageCursor = MessageModel.schema
      .indexes()
      .find(
        ([, options]) => options.name === "messages_by_conversation_cursor",
      );
    assert.equal(conversationName?.[1].unique, true);
    assert.equal(directPair?.[1].unique, true);
    assert.equal(directActivityIndexes.length, 2);
    assert.equal(participant?.[1].unique, true);
    assert.ok(messageCursor);
    const readState = ConversationReadStateModel.schema
      .indexes()
      .find(
        ([, options]) => options.name === "unique_conversation_read_receipt",
      );
    assert.equal(readState?.[1].unique, true);
  });
});
