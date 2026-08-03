import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import type { MessageBroadcaster } from "../src/broadcasting/messageBroadcaster.js";
import createConversationPolicy from "../src/modules/conversations/conversation.policy.js";
import type { ConversationRecord } from "../src/modules/conversations/conversation.types.js";
import { MembershipRole } from "../src/modules/memberships/membership.types.js";
import type { MessageRepository } from "../src/modules/message/message.repository.js";
import createMessageService from "../src/modules/message/message.service.js";
import {
  MessageType,
  type MessageRecord,
} from "../src/modules/message/message.types.js";

const userId = "507f1f77bcf86cd799439011";
const conversationId = "507f1f77bcf86cd799439012";
const now = new Date("2026-08-03T00:00:00.000Z");
const conversation: ConversationRecord = {
  id: conversationId,
  organizationId: "507f1f77bcf86cd799439010",
  categoryId: "507f1f77bcf86cd799439014",
  name: "general",
  type: ConversationType.CHANNEL,
  visibility: ConversationVisibility.PUBLIC,
  position: 0,
  createdAt: now,
  updatedAt: now,
};
const message: MessageRecord = {
  id: "507f1f77bcf86cd799439013",
  conversationId,
  senderId: userId,
  content: "Hello",
  messageType: MessageType.TEXT,
  editedAt: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};

const createRepository = (
  overrides: Partial<MessageRepository> = {},
): MessageRepository => ({
  create: async () => message,
  findById: async () => message,
  listByConversation: async () => [message],
  updateContent: async () => ({ ...message, editedAt: now }),
  redact: async () => ({ ...message, content: null, deletedAt: now }),
  deleteByConversationId: async () => 0,
  deleteByConversationIds: async () => 0,
  ...overrides,
});

const createBroadcaster = (): MessageBroadcaster & {
  created: MessageRecord[];
} => ({
  created: [],
  messageCreated(createdMessage) {
    this.created.push(createdMessage);
  },
  messageUpdated() {},
  messageDeleted() {},
});

const createService = (
  repository: MessageRepository,
  broadcaster: MessageBroadcaster,
) =>
  createMessageService({
    broadcaster,
    conversationPolicy: createConversationPolicy(),
    conversations: {
      getAccessible: async () => conversation,
    },
    memberships: {
      findForUser: async () => ({
        id: "membership-1",
        userId,
        organizationId: conversation.organizationId,
        role: MembershipRole.MEMBER,
        joinedAt: now,
      }),
    },
    messages: repository,
  });

describe("messageService", () => {
  test("returns cursor-paginated history", async () => {
    const service = createService(createRepository(), createBroadcaster());
    const result = await service.list(userId, conversationId, { limit: 50 });
    assert.deepEqual(result, { messages: [message], nextCursor: null });
  });

  test("creates and broadcasts a scoped message", async () => {
    const broadcaster = createBroadcaster();
    const service = createService(createRepository(), broadcaster);
    const result = await service.create(userId, conversationId, {
      content: "Hello",
    });
    assert.equal(result, message);
    assert.deepEqual(broadcaster.created, [message]);
  });

  test("does not redact an already deleted message again", async () => {
    let redactions = 0;
    const service = createService(
      createRepository({
        findById: async () => ({ ...message, content: null, deletedAt: now }),
        redact: async () => {
          redactions += 1;
          return null;
        },
      }),
      createBroadcaster(),
    );
    await service.delete(userId, message.id);
    assert.equal(redactions, 0);
  });
});
