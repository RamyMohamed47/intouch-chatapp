import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import {
  ConversationConflictError,
  ConversationForbiddenError,
  ConversationNotFoundError,
} from "../src/modules/conversations/conversation.errors.js";
import createConversationPolicy from "../src/modules/conversations/conversation.policy.js";
import type {
  ConversationParticipantRecord,
  ConversationRecord,
} from "../src/modules/conversations/conversation.types.js";
import {
  MembershipRole,
  type MembershipRecord,
} from "../src/modules/memberships/index.js";
import { MessageForbiddenError } from "../src/modules/message/message.errors.js";
import {
  MessageType,
  type MessageRecord,
} from "../src/modules/message/message.types.js";

const now = new Date("2026-08-03T00:00:00.000Z");
const userId = "507f1f77bcf86cd799439011";
const organizationId = "507f1f77bcf86cd799439012";
const conversation: ConversationRecord = {
  id: "507f1f77bcf86cd799439013",
  organizationId,
  categoryId: "507f1f77bcf86cd799439014",
  name: "general",
  type: ConversationType.CHANNEL,
  visibility: ConversationVisibility.PUBLIC,
  position: 0,
  createdAt: now,
  updatedAt: now,
};
const member: MembershipRecord = {
  id: "507f1f77bcf86cd799439015",
  userId,
  organizationId,
  role: MembershipRole.MEMBER,
  joinedAt: now,
};
const participant: ConversationParticipantRecord = {
  id: "507f1f77bcf86cd799439016",
  organizationId,
  conversationId: conversation.id,
  userId,
  addedByUserId: userId,
  joinedAt: now,
};

describe("conversation policy", () => {
  const policy = createConversationPolicy();

  test("allows organization members into public channels", () => {
    assert.equal(
      policy.assertAccessible(conversation, member, null),
      conversation,
    );
  });

  test("conceals private channels from nonparticipants", () => {
    const privateConversation = {
      ...conversation,
      visibility: ConversationVisibility.PRIVATE,
    };
    assert.throws(
      () => policy.assertAccessible(privateConversation, member, null),
      ConversationNotFoundError,
    );
    assert.equal(
      policy.assertAccessible(privateConversation, member, participant),
      privateConversation,
    );
  });

  test("requires owners to manage channels and private participants", () => {
    assert.throws(
      () => policy.assertOwner(conversation, member),
      ConversationForbiddenError,
    );
    assert.throws(
      () =>
        policy.assertPrivateOwner(conversation, {
          ...member,
          role: MembershipRole.OWNER,
        }),
      ConversationConflictError,
    );
    assert.throws(
      () =>
        policy.assertOwner(
          { ...conversation, visibility: ConversationVisibility.PRIVATE },
          member,
        ),
      ConversationNotFoundError,
    );
  });

  test("allows senders or owners to delete messages", () => {
    const message: MessageRecord = {
      id: "507f1f77bcf86cd799439017",
      conversationId: conversation.id,
      senderId: userId,
      content: "hello",
      messageType: MessageType.TEXT,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      attachments: [],
    };
    assert.equal(
      policy.assertMessageDeletable(message, conversation, userId, member),
      message,
    );
    assert.throws(
      () =>
        policy.assertMessageDeletable(
          message,
          conversation,
          "other-user",
          member,
        ),
      MessageForbiddenError,
    );
    assert.equal(
      policy.assertMessageDeletable(message, conversation, "other-user", {
        ...member,
        role: MembershipRole.OWNER,
      }),
      message,
    );
  });

  test("requires DM participation and never grants owner message moderation", () => {
    const directConversation: ConversationRecord = {
      id: "507f1f77bcf86cd799439018",
      organizationId,
      type: ConversationType.DIRECT,
      directParticipantKey: "pair",
      createdAt: now,
      updatedAt: now,
    };
    const message: MessageRecord = {
      id: "507f1f77bcf86cd799439019",
      conversationId: directConversation.id,
      senderId: "another-user",
      content: "private",
      messageType: MessageType.TEXT,
      editedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      attachments: [],
    };
    assert.throws(
      () => policy.assertAccessible(directConversation, member, null),
      ConversationNotFoundError,
    );
    assert.equal(
      policy.assertAccessible(directConversation, member, {
        ...participant,
        conversationId: directConversation.id,
      }),
      directConversation,
    );
    assert.throws(
      () =>
        policy.assertMessageDeletable(message, directConversation, userId, {
          ...member,
          role: MembershipRole.OWNER,
        }),
      MessageForbiddenError,
    );
  });
});
