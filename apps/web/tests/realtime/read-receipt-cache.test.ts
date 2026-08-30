import type {
  DirectConversationDto,
  DirectMessageListResponse,
} from "@intouch/shared/conversations";
import type { ReadReceiptDto } from "@intouch/shared/messages";
import { describe, expect, it } from "vitest";

import {
  hasReadMessage,
  mergePeerReadReceipt,
  mergePeerReceiptIntoDirectMessagePage,
} from "@/lib/realtime/read-receipt-cache";

const currentUserId = "64b000000000000000000000001";
const peerUserId = "64b000000000000000000000002";
const conversationId = "64d000000000000000000000001";
const olderMessageId = "64f000000000000000000000001";
const newerMessageId = "64f000000000000000000000002";

const conversation: DirectConversationDto = {
  id: conversationId,
  organizationId: "64c000000000000000000000001",
  type: "DIRECT",
  peer: {
    id: peerUserId,
    username: "lina",
    displayName: "Lina Hassan",
    avatarAssetId: null,
  },
  lastMessage: null,
  unreadCount: 0,
  readReceipt: null,
  peerReadReceipt: null,
  createdAt: "2026-08-27T10:00:00.000Z",
  updatedAt: "2026-08-27T10:00:00.000Z",
};

const receipt = (messageId: string): ReadReceiptDto => ({
  id: "650000000000000000000001",
  conversationId,
  userId: peerUserId,
  lastReadMessageId: messageId,
  lastReadAt: "2026-08-27T10:05:00.000Z",
});

describe("read receipt cache", () => {
  it("merges newer peer receipts and ignores stale, duplicate, and self events", () => {
    const updated = mergePeerReadReceipt(
      conversation,
      receipt(newerMessageId),
      currentUserId,
    );
    expect(updated?.type === "DIRECT" && updated.peerReadReceipt).toEqual(
      receipt(newerMessageId),
    );
    expect(
      mergePeerReadReceipt(updated, receipt(olderMessageId), currentUserId),
    ).toBe(updated);
    expect(
      mergePeerReadReceipt(
        updated,
        { ...receipt(newerMessageId), userId: currentUserId },
        currentUserId,
      ),
    ).toBe(updated);
  });

  it("updates direct-message pages without replacing unchanged data", () => {
    const page: DirectMessageListResponse = {
      directMessages: [conversation],
      nextCursor: null,
    };
    const updated = mergePeerReceiptIntoDirectMessagePage(
      page,
      receipt(newerMessageId),
      currentUserId,
    );
    expect(updated?.directMessages[0]?.peerReadReceipt).toEqual(
      receipt(newerMessageId),
    );
    expect(
      mergePeerReceiptIntoDirectMessagePage(
        updated,
        receipt(olderMessageId),
        currentUserId,
      ),
    ).toBe(updated);
  });

  it("compares persisted high-water marks", () => {
    expect(hasReadMessage(receipt(newerMessageId), olderMessageId)).toBe(true);
    expect(hasReadMessage(receipt(olderMessageId), newerMessageId)).toBe(false);
    expect(hasReadMessage(null, olderMessageId)).toBe(false);
  });
});
