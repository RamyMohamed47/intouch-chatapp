import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ConversationType } from "@intouch/shared/conversations";

import type { ConversationRecord } from "../src/modules/conversations/conversation.types.js";
import { MessageNotFoundError } from "../src/modules/message/message.errors.js";
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

const createHarness = () => {
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
        return current;
      }
      current = {
        id: "507f1f77bcf86cd799439020",
        ...input,
      };
      return current;
    },
    find: async () => current,
    findForUserByConversations: async () => (current ? [current] : []),
    deleteByConversationId: async () => 0,
    deleteByOrganizationId: async () => 0,
  };
  const realtime: ReadReceiptRealtime = {
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
      conversations: { getAccessible: async () => conversation },
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
});
