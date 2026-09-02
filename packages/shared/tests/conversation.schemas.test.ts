import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ChannelKind,
  ConversationVisibility,
  addConversationParticipantSchema,
  createConversationSchema,
  createDirectMessageSchema,
  listDirectMessagesQuerySchema,
  updateConversationSchema,
} from "../conversations/index.js";

const categoryId = "507f1f77bcf86cd799439011";

describe("shared conversation schemas", () => {
  test("normalizes names and defaults channels to public", () => {
    assert.deepEqual(
      createConversationSchema.parse({ categoryId, name: "  General  " }),
      {
        categoryId,
        kind: ChannelKind.TEXT,
        name: "General",
        visibility: ConversationVisibility.PUBLIC,
      },
    );
  });

  test("accepts private channels, moves, and participant IDs", () => {
    assert.equal(
      createConversationSchema.parse({
        categoryId,
        name: "Leadership",
        visibility: ConversationVisibility.PRIVATE,
      }).visibility,
      ConversationVisibility.PRIVATE,
    );
    assert.deepEqual(updateConversationSchema.parse({ position: 0 }), {
      position: 0,
    });
    assert.deepEqual(
      addConversationParticipantSchema.parse({ userId: categoryId }),
      {
        userId: categoryId,
      },
    );
  });

  test("rejects invalid IDs, empty updates, and unknown fields", () => {
    assert.equal(
      createConversationSchema.safeParse({ categoryId: "bad", name: "General" })
        .success,
      false,
    );
    assert.equal(updateConversationSchema.safeParse({}).success, false);
    assert.equal(
      createConversationSchema.safeParse({
        categoryId,
        name: "General",
        extra: 1,
      }).success,
      false,
    );
  });

  test("validates direct-message creation and pagination", () => {
    assert.deepEqual(
      createDirectMessageSchema.parse({ recipientUserId: categoryId }),
      { recipientUserId: categoryId },
    );
    assert.deepEqual(listDirectMessagesQuerySchema.parse({ limit: "30" }), {
      limit: 30,
    });
    assert.equal(
      createDirectMessageSchema.safeParse({
        recipientUserId: categoryId,
        extra: true,
      }).success,
      false,
    );
    assert.equal(
      listDirectMessagesQuerySchema.safeParse({ limit: 101 }).success,
      false,
    );
  });
});
