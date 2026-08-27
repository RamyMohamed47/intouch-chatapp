import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import type { ConversationRecord } from "../src/modules/conversations/conversation.types.js";
import {
  MessageForbiddenError,
  MessageNotFoundError,
} from "../src/modules/message/message.errors.js";
import {
  MessageType,
  type MessageRecord,
} from "../src/modules/message/message.types.js";
import type { ReadReceiptRealtime } from "../src/modules/read-receipts/read-receipt.realtime.js";
import type { ConversationReadStateRepository } from "../src/modules/read-receipts/read-receipt.repository.js";
import createReadReceiptService from "../src/modules/read-receipts/read-receipt.service.js";
import type { ConversationReadStateRecord } from "../src/modules/read-receipts/read-receipt.types.js";

const userId = "507f1f77bcf86cd799439011";
const conversationId = "507f1f77bcf86cd799439012";
const organizationId = "507f1f77bcf86cd799439013";
const olderMessageId = "507f1f77bcf86cd799439014";
const newerMessageId = "507f1f77bcf86cd799439015";
const now = new Date("2026-08-03T12:00:00.000Z");
const conversation: ConversationRecord = {
  id: conversationId,
  organizationId,
  type: ConversationType.DIRECT,
  directParticipantKey: `${userId}:507f1f77bcf86cd799439099`,
  createdAt: now,
  updatedAt: now,
};

const message = (
  id: string,
  targetConversationId = conversationId,
): MessageRecord => ({
  id,
  conversationId: targetConversationId,
  senderId: "507f1f77bcf86cd799439099",
  content: "hello",
  messageType: MessageType.TEXT,
  editedAt: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
});

const createHarness = (
  accessibleConversation: ConversationRecord = conversation,
) => {
  let current: ConversationReadStateRecord | null = null;
  const broadcasts: Array<{
    id: string;
    conversationId: string;
    userId: string;
    lastReadMessageId: string;
    lastReadAt: Date;
  }> = [];
  const repository: ConversationReadStateRepository = {
    async advance(input) {
      if (current && current.lastReadMessageId >= input.lastReadMessageId) {
        return { readState: current, advanced: false };
      }
      current = {
        id: "507f1f77bcf86cd799439020",
        ...input,
      };
      return { readState: current, advanced: true };
    },
    find: async () => current,
    findForUserByConversations: async () => (current ? [current] : []),
    summarizeMessageReaders: async (input) => ({
      messageId: input.messageId,
      readByCount: 0,
      readers: [],
    }),
    deleteByConversationId: async () => 0,
    deleteByOrganizationId: async () => 0,
  };
  const realtime: ReadReceiptRealtime = {
    channelReadReceiptsChanged() {},
    readReceiptUpdated(receipt) {
      broadcasts.push(receipt);
    },
  };
  const messages = new Map([
    [olderMessageId, message(olderMessageId)],
    [newerMessageId, message(newerMessageId)],
  ]);
  return {
    broadcasts,
    service: createReadReceiptService({
      conversations: { getAccessible: async () => accessibleConversation },
      messages: { findById: async (id) => messages.get(id) ?? null },
      now: () => now,
      readStates: repository,
      realtime,
    }),
  };
};

describe("readReceiptService", () => {
  test("advances monotonically and broadcasts direct-message receipts", async () => {
    const harness = createHarness();
    const newer = await harness.service.advance(userId, conversationId, {
      messageId: newerMessageId,
    });
    const stale = await harness.service.advance(userId, conversationId, {
      messageId: olderMessageId,
    });
    assert.equal(newer.lastReadMessageId, newerMessageId);
    assert.equal(stale.lastReadMessageId, newerMessageId);
    assert.equal(harness.broadcasts.length, 1);
  });

  test("rejects messages from another conversation", async () => {
    const harness = createHarness();
    await assert.rejects(
      harness.service.advance(userId, conversationId, {
        messageId: "507f1f77bcf86cd799439099",
      }),
      MessageNotFoundError,
    );
  });

  test("emits an anonymous channel receipt invalidation", async () => {
    let invalidations = 0;
    const harness = createHarness({
      id: conversationId,
      organizationId,
      type: ConversationType.CHANNEL,
      categoryId: "507f1f77bcf86cd799439021",
      name: "general",
      visibility: "PUBLIC",
      position: 0,
      createdAt: now,
      updatedAt: now,
    });
    harness.service = createReadReceiptService({
      conversations: {
        getAccessible: async () => ({
          id: conversationId,
          organizationId,
          type: ConversationType.CHANNEL,
          categoryId: "507f1f77bcf86cd799439021",
          name: "general",
          visibility: "PUBLIC",
          position: 0,
          createdAt: now,
          updatedAt: now,
        }),
      },
      messages: { findById: async (id) => message(id) },
      now: () => now,
      readStates: {
        advance: async (input) => ({
          readState: {
            id: "507f1f77bcf86cd799439020",
            ...input,
          },
          advanced: true,
        }),
        find: async () => null,
        findForUserByConversations: async () => [],
        summarizeMessageReaders: async (input) => ({
          messageId: input.messageId,
          readByCount: 0,
          readers: [],
        }),
        deleteByConversationId: async () => 0,
        deleteByOrganizationId: async () => 0,
      },
      realtime: {
        readReceiptUpdated() {},
        channelReadReceiptsChanged() {
          invalidations += 1;
        },
      },
    });
    await harness.service.advance(userId, conversationId, {
      messageId: newerMessageId,
    });
    assert.equal(harness.broadcasts.length, 0);
    assert.equal(invalidations, 1);
  });

  test("returns channel readers only to the message sender", async () => {
    const channel: ConversationRecord = {
      id: conversationId,
      organizationId,
      type: ConversationType.CHANNEL,
      categoryId: "507f1f77bcf86cd799439021",
      name: "general",
      visibility: ConversationVisibility.PRIVATE,
      position: 0,
      createdAt: now,
      updatedAt: now,
    };
    const senderMessage = { ...message(newerMessageId), senderId: userId };
    let requireParticipant = false;
    const readStates: ConversationReadStateRepository = {
      advance: async () => {
        throw new Error("unused");
      },
      find: async () => null,
      findForUserByConversations: async () => [],
      summarizeMessageReaders: async (input) => {
        requireParticipant = input.requireParticipant;
        return {
          messageId: input.messageId,
          readByCount: 1,
          readers: [
            {
              id: "507f1f77bcf86cd799439099",
              username: "peer",
              displayName: "Peer User",
            },
          ],
        };
      },
      deleteByConversationId: async () => 0,
      deleteByOrganizationId: async () => 0,
    };
    const service = createReadReceiptService({
      conversations: { getAccessible: async () => channel },
      messages: { findById: async () => senderMessage },
      readStates,
      realtime: {
        channelReadReceiptsChanged() {},
        readReceiptUpdated() {},
      },
    });
    const summary = await service.summarizeMessageReaders(
      userId,
      conversationId,
      newerMessageId,
    );
    assert.equal(summary.readByCount, 1);
    assert.equal(requireParticipant, true);

    const forbidden = createReadReceiptService({
      conversations: { getAccessible: async () => channel },
      messages: { findById: async () => message(newerMessageId) },
      readStates,
      realtime: {
        channelReadReceiptsChanged() {},
        readReceiptUpdated() {},
      },
    });
    await assert.rejects(
      forbidden.summarizeMessageReaders(userId, conversationId, newerMessageId),
      MessageForbiddenError,
    );
  });
});
