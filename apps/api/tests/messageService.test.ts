import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import type { MessageBroadcaster } from "../src/broadcasting/messageBroadcaster.js";
import createConversationPolicy from "../src/modules/conversations/conversation.policy.js";
import type { ConversationRecord } from "../src/modules/conversations/conversation.types.js";
import type { MessageRepository } from "../src/modules/message/message.repository.js";
import { MessageNotFoundError } from "../src/modules/message/message.errors.js";
import createMessageService from "../src/modules/message/message.service.js";
import {
  MessageType,
  type MessageRecord,
} from "../src/modules/message/message.types.js";
import { createTestUnitOfWork } from "./unitOfWorkContext.js";

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
  listContext: async () => ({
    messages: [message],
    hasEarlier: false,
    hasLater: false,
  }),
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
  activity: {
    messageCreated: (
      conversation: ConversationRecord,
      userId: string,
    ) => Promise<void>;
    messageDeleted: (
      conversation: ConversationRecord,
      userId: string,
    ) => Promise<void>;
    messageUpdated: (
      conversation: ConversationRecord,
      userId: string,
    ) => Promise<void>;
  } = {
    messageCreated: async () => undefined,
    messageDeleted: async () => undefined,
    messageUpdated: async () => undefined,
  },
) =>
  createMessageService({
    activity,
    broadcaster,
    conversationPolicy: createConversationPolicy(),
    conversations: {
      getAccessible: async () => conversation,
      getAccessibleInContext: async () => conversation,
    },
    messages: repository,
    reactions: {
      decorate: async (_actorUserId, _conversation, records) =>
        records.map((record) => ({
          ...record,
          reactions: [],
          currentUserReaction: null,
        })),
    },
    unitOfWork: createTestUnitOfWork({
      conversations: {
        create: async () => {
          throw new Error("unused");
        },
        findById: async () => conversation,
        findByIds: async () => [],
        findDirectByParticipantKey: async () => null,
        listDirectForParticipant: async () => [],
        listByOrganization: async () => [],
        listIdsByOrganization: async () => [],
        countByCategory: async () => 0,
        updateById: async () => null,
        touchActivity: async () => true,
        shiftPositions: async () => undefined,
        deleteById: async () => false,
        deleteByOrganizationId: async () => 0,
      },
      messages: repository,
    }),
  });

describe("messageService", () => {
  test("returns cursor-paginated history", async () => {
    const service = createService(createRepository(), createBroadcaster());
    const result = await service.list(userId, conversationId, { limit: 50 });
    assert.deepEqual(result, {
      messages: [{ ...message, reactions: [], currentUserReaction: null }],
      nextCursor: null,
    });
  });

  test("returns decorated context around an exact anchor", async () => {
    const service = createService(
      createRepository({
        listContext: async () => ({
          messages: [message],
          hasEarlier: true,
          hasLater: true,
        }),
      }),
      createBroadcaster(),
    );
    assert.deepEqual(
      await service.context(userId, conversationId, message.id),
      {
        anchorMessageId: message.id,
        messages: [{ ...message, reactions: [], currentUserReaction: null }],
        hasEarlier: true,
        hasLater: true,
      },
    );
  });

  test("conceals a missing or mismatched context anchor", async () => {
    const service = createService(
      createRepository({
        listContext: async () => ({
          messages: [],
          hasEarlier: false,
          hasLater: false,
        }),
      }),
      createBroadcaster(),
    );
    await assert.rejects(
      service.context(userId, conversationId, message.id),
      MessageNotFoundError,
    );
  });

  test("creates and broadcasts a scoped message", async () => {
    const broadcaster = createBroadcaster();
    const activityCalls: string[] = [];
    const service = createService(createRepository(), broadcaster, {
      messageCreated: async (_conversation, actorUserId) => {
        activityCalls.push(actorUserId);
      },
      messageDeleted: async () => undefined,
      messageUpdated: async () => undefined,
    });
    const result = await service.create(userId, conversationId, {
      content: "Hello",
    });
    assert.deepEqual(result, {
      ...message,
      reactions: [],
      currentUserReaction: null,
    });
    assert.deepEqual(broadcaster.created, [message]);
    assert.deepEqual(activityCalls, [userId]);
  });

  test("does not emit activity when message persistence fails", async () => {
    let activityCalls = 0;
    const service = createService(
      createRepository({
        create: async () => {
          throw new Error("forced persistence failure");
        },
      }),
      createBroadcaster(),
      {
        messageCreated: async () => {
          activityCalls += 1;
        },
        messageDeleted: async () => undefined,
        messageUpdated: async () => undefined,
      },
    );
    await assert.rejects(
      service.create(userId, conversationId, { content: "Hello" }),
      /forced persistence failure/,
    );
    assert.equal(activityCalls, 0);
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
