import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import type { ConversationRecord } from "../src/modules/conversations/conversation.types.js";
import { MembershipRole } from "../src/modules/memberships/membership.types.js";
import { MessageReactionConflictError } from "../src/modules/message-reactions/message-reaction.errors.js";
import type { MessageReactionRepository } from "../src/modules/message-reactions/message-reaction.repository.js";
import createMessageReactionService from "../src/modules/message-reactions/message-reaction.service.js";
import {
  MessageType,
  type MessageRecord,
} from "../src/modules/message/message.types.js";
import { createTestUnitOfWork } from "./unitOfWorkContext.js";

const userId = "507f1f77bcf86cd799439011";
const otherUserId = "507f1f77bcf86cd799439012";
const organizationId = "507f1f77bcf86cd799439013";
const conversationId = "507f1f77bcf86cd799439014";
const messageId = "507f1f77bcf86cd799439015";
const now = new Date("2026-08-28T12:00:00.000Z");
const conversation: ConversationRecord = {
  id: conversationId,
  organizationId,
  categoryId: "507f1f77bcf86cd799439016",
  name: "general",
  type: ConversationType.CHANNEL,
  visibility: ConversationVisibility.PUBLIC,
  position: 0,
  createdAt: now,
  updatedAt: now,
};
const message: MessageRecord = {
  id: messageId,
  conversationId,
  senderId: otherUserId,
  content: "Hello",
  messageType: MessageType.TEXT,
  editedAt: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};

const createReactionRepository = () => {
  let currentEmoji: string | null = null;
  let upserts = 0;
  const repository: MessageReactionRepository = {
    findForUser: async () =>
      currentEmoji
        ? {
            id: "507f1f77bcf86cd799439017",
            conversationId,
            messageId,
            userId,
            emoji: currentEmoji,
            createdAt: now,
            updatedAt: now,
          }
        : null,
    upsert: async (input) => {
      currentEmoji = input.emoji;
      upserts += 1;
      return {
        id: "507f1f77bcf86cd799439017",
        ...input,
        createdAt: now,
        updatedAt: now,
      };
    },
    deleteForUser: async () => {
      const changed = currentEmoji !== null;
      currentEmoji = null;
      return changed;
    },
    summarize: async (_messageIds, _currentUserId, eligibleUserIds) =>
      currentEmoji && eligibleUserIds.includes(userId)
        ? [
            {
              messageId,
              reactions: [{ emoji: currentEmoji, count: 1 }],
              currentUserReaction: currentEmoji,
            },
          ]
        : [],
    listUsers: async (_targetMessageId, emoji, eligibleUserIds) => ({
      total: eligibleUserIds.includes(otherUserId) ? 1 : 0,
      records: eligibleUserIds.includes(otherUserId)
        ? [
            {
              id: "507f1f77bcf86cd799439018",
              conversationId,
              messageId,
              userId: otherUserId,
              emoji,
              createdAt: now,
              updatedAt: now,
            },
          ]
        : [],
    }),
    deleteByMessageId: async () => 0,
    deleteByConversationId: async () => 0,
    deleteByConversationIds: async () => 0,
    deleteByConversationAndUser: async () => 0,
    deleteByConversationExceptUsers: async () => 0,
  };
  return { repository, upserts: () => upserts };
};

const memberships = {
  createOwner: async () => {
    throw new Error("unused");
  },
  createMember: async () => {
    throw new Error("unused");
  },
  findForUser: async () => null,
  listForUser: async () => [],
  listForOrganization: async () => [
    {
      id: "507f1f77bcf86cd799439020",
      organizationId,
      userId,
      role: MembershipRole.MEMBER,
      joinedAt: now,
    },
    {
      id: "507f1f77bcf86cd799439021",
      organizationId,
      userId: otherUserId,
      role: MembershipRole.MEMBER,
      joinedAt: now,
    },
  ],
  deleteForOrganization: async () => 0,
};

const createHarness = (targetMessage: MessageRecord = message) => {
  const reactionHarness = createReactionRepository();
  const events: Array<{ conversationId: string; messageId: string }> = [];
  const messages = {
    create: async () => targetMessage,
    findById: async () => targetMessage,
    listByConversation: async () => [],
    listContext: async () => ({
      messages: [targetMessage],
      hasEarlier: false,
      hasLater: false,
    }),
    updateContent: async () => targetMessage,
    redact: async () => targetMessage,
    deleteByConversationId: async () => 0,
    deleteByConversationIds: async () => 0,
  };
  const service = createMessageReactionService({
    conversations: {
      getAccessible: async () => conversation,
      getAccessibleInContext: async () => conversation,
    },
    logger: { error: () => undefined },
    memberships,
    messages,
    participants: { listByConversation: async () => [] },
    reactions: reactionHarness.repository,
    realtime: {
      messageReactionsChanged: (event) => events.push(event),
    },
    unitOfWork: createTestUnitOfWork({
      memberships,
      messageReactions: reactionHarness.repository,
      messages,
    }),
    users: {
      findPublicByIds: async () => [
        {
          id: otherUserId,
          username: "lina",
          displayName: "Lina Hassan",
          email: "lina@example.com",
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  });
  return { events, reactionHarness, service };
};

describe("messageReactionService", () => {
  test("creates, preserves, replaces, and removes one reaction per user", async () => {
    const harness = createHarness();
    assert.equal(
      (await harness.service.set(userId, messageId, { emoji: "👍" }))
        .currentUserReaction,
      "👍",
    );
    await harness.service.set(userId, messageId, { emoji: "👍" });
    assert.equal(harness.events.length, 1);
    assert.equal(harness.reactionHarness.upserts(), 1);
    assert.equal(
      (await harness.service.set(userId, messageId, { emoji: "❤️" }))
        .currentUserReaction,
      "❤️",
    );
    assert.equal(harness.events.length, 2);
    assert.equal(
      (await harness.service.remove(userId, messageId)).currentUserReaction,
      null,
    );
    await harness.service.remove(userId, messageId);
    assert.equal(harness.events.length, 3);
  });

  test("rejects reactions on deleted messages", async () => {
    const harness = createHarness({ ...message, deletedAt: now });
    await assert.rejects(
      harness.service.set(userId, messageId, { emoji: "👍" }),
      MessageReactionConflictError,
    );
    assert.equal(harness.events.length, 0);
  });

  test("lists only eligible reactors as safe public users", async () => {
    const result = await createHarness().service.listUsers(userId, messageId, {
      emoji: "🎉",
      limit: 30,
    });
    assert.equal(result.total, 1);
    assert.deepEqual(result.users, [
      {
        id: otherUserId,
        username: "lina",
        displayName: "Lina Hassan",
      },
    ]);
  });
});
