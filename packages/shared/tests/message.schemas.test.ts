import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createMessageSchema,
  messageReadReceiptSummaryResponseSchema,
  messageHistoryQuerySchema,
  messageReactionStateResponseSchema,
  messageReactionUsersQuerySchema,
  reactionEmojiSchema,
  setMessageReactionSchema,
  updateReadReceiptSchema,
} from "../messages/index.js";

describe("shared message schemas", () => {
  test("preserves content formatting and normalizes cursor limits", () => {
    assert.deepEqual(createMessageSchema.parse({ content: "  hello\n" }), {
      content: "  hello\n",
    });
    assert.deepEqual(messageHistoryQuerySchema.parse({ limit: "25" }), {
      limit: 25,
    });
    assert.deepEqual(messageHistoryQuerySchema.parse({}), { limit: 50 });
  });

  test("rejects whitespace, oversized content, and invalid limits", () => {
    assert.equal(
      createMessageSchema.safeParse({ content: " \n\t" }).success,
      false,
    );
    assert.equal(
      createMessageSchema.safeParse({ content: "a".repeat(4_001) }).success,
      false,
    );
    assert.equal(
      messageHistoryQuerySchema.safeParse({ limit: 101 }).success,
      false,
    );
  });

  test("requires a strict message ID for receipt advancement", () => {
    const messageId = "507f1f77bcf86cd799439011";
    assert.deepEqual(updateReadReceiptSchema.parse({ messageId }), {
      messageId,
    });
    assert.equal(
      updateReadReceiptSchema.safeParse({ messageId, extra: true }).success,
      false,
    );
    assert.equal(
      updateReadReceiptSchema.safeParse({ messageId: "invalid" }).success,
      false,
    );
  });

  test("limits channel reader previews while preserving the total", () => {
    const messageId = "507f1f77bcf86cd799439011";
    const readers = [
      {
        id: "507f1f77bcf86cd799439012",
        username: "lina",
        displayName: "Lina Hassan",
        avatarAssetId: null,
      },
    ];
    assert.deepEqual(
      messageReadReceiptSummaryResponseSchema.parse({
        readReceiptSummary: { messageId, readByCount: 4, readers },
      }),
      { readReceiptSummary: { messageId, readByCount: 4, readers } },
    );
    assert.equal(
      messageReadReceiptSummaryResponseSchema.safeParse({
        readReceiptSummary: {
          messageId,
          readByCount: 4,
          readers: Array.from({ length: 4 }, (_, index) => ({
            id: `507f1f77bcf86cd79943901${index + 2}`,
            username: `user-${index}`,
            displayName: `User ${index}`,
          })),
        },
      }).success,
      false,
    );
  });

  test("validates one normalized emoji and strict reaction inputs", () => {
    assert.equal(reactionEmojiSchema.parse("👍🏽"), "👍🏽");
    assert.equal(reactionEmojiSchema.parse("👨‍👩‍👧‍👦"), "👨‍👩‍👧‍👦");
    assert.equal(reactionEmojiSchema.safeParse("hello").success, false);
    assert.equal(reactionEmojiSchema.safeParse("👍🎉").success, false);
    assert.deepEqual(setMessageReactionSchema.parse({ emoji: "❤️" }), {
      emoji: "❤️",
    });
    assert.equal(
      setMessageReactionSchema.safeParse({ emoji: "👍", extra: true }).success,
      false,
    );
  });

  test("normalizes reaction user pagination and reaction state DTOs", () => {
    const messageId = "507f1f77bcf86cd799439011";
    assert.deepEqual(
      messageReactionUsersQuerySchema.parse({ emoji: "🎉", limit: "20" }),
      { emoji: "🎉", limit: 20 },
    );
    assert.deepEqual(
      messageReactionStateResponseSchema.parse({
        reactionState: {
          messageId,
          reactions: [{ emoji: "🎉", count: 3 }],
          currentUserReaction: null,
        },
      }).reactionState.reactions,
      [{ emoji: "🎉", count: 3 }],
    );
  });
});
