import type { MessageListResponse } from "@intouch/shared/messages";
import type { InfiniteData } from "@tanstack/react-query";

import { mergeReactionStateIntoMessagePages } from "./reaction-cache";

const messages: InfiniteData<MessageListResponse> = {
  pageParams: [undefined],
  pages: [
    {
      nextCursor: null,
      messages: [
        {
          id: "507f1f77bcf86cd799439011",
          conversationId: "507f1f77bcf86cd799439012",
          senderId: "507f1f77bcf86cd799439013",
          content: "Hello",
          messageType: "TEXT",
          editedAt: null,
          deletedAt: null,
          createdAt: "2026-09-07T10:00:00.000Z",
          updatedAt: "2026-09-07T10:00:00.000Z",
          attachments: [],
          reactions: [],
          currentUserReaction: null,
          mentions: [],
          replyTo: null,
        },
      ],
    },
  ],
};

test("merges authoritative reaction state without duplicating messages", () => {
  const updated = mergeReactionStateIntoMessagePages(messages, {
    messageId: "507f1f77bcf86cd799439011",
    reactions: [{ emoji: "\u{1F44D}", count: 2 }],
    currentUserReaction: "\u{1F44D}",
  });

  expect(updated?.pages[0]?.messages).toHaveLength(1);
  expect(updated?.pages[0]?.messages[0]?.reactions).toEqual([
    { emoji: "\u{1F44D}", count: 2 },
  ]);
  expect(updated?.pages[0]?.messages[0]?.currentUserReaction).toBe("\u{1F44D}");
});

test("preserves the cache reference for duplicate reaction state", () => {
  const unchanged = mergeReactionStateIntoMessagePages(messages, {
    messageId: "507f1f77bcf86cd799439011",
    reactions: [],
    currentUserReaction: null,
  });

  expect(unchanged).toBe(messages);
});
