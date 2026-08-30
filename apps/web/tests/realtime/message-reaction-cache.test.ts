import { describe, expect, it } from "vitest";

import { mergeReactionState } from "@/lib/reactions/message-reaction-cache";

describe("message reaction cache", () => {
  it("merges authoritative state without changing unrelated messages", () => {
    const first = {
      id: "64f000000000000000000001",
      conversationId: "64d000000000000000000001",
      senderId: "64b000000000000000000001",
      content: "Hello",
      messageType: "TEXT" as const,
      editedAt: null,
      deletedAt: null,
      createdAt: "2026-08-28T10:00:00.000Z",
      updatedAt: "2026-08-28T10:00:00.000Z",
      attachments: [],
      reactions: [],
      currentUserReaction: null,
    };
    const second = { ...first, id: "64f000000000000000000002" };
    const data = {
      pages: [{ messages: [first, second], nextCursor: null }],
      pageParams: [undefined],
    };
    const merged = mergeReactionState(data, {
      messageId: first.id,
      reactions: [{ emoji: "🎉", count: 2 }],
      currentUserReaction: "🎉",
    });
    expect(merged?.pages[0]?.messages[0]).toMatchObject({
      reactions: [{ emoji: "🎉", count: 2 }],
      currentUserReaction: "🎉",
    });
    expect(merged?.pages[0]?.messages[1]).toEqual(second);
  });
});
