import type { DirectConversationDto } from "@intouch/shared/conversations";
import type { ReadReceiptDto } from "@intouch/shared/messages";

import { mergePeerReceiptIntoConversation } from "@/features/messages/receipt-cache";

const currentUserId = "6a0000000000000000000001";
const peerId = "6a0000000000000000000002";
const conversation: DirectConversationDto = {
  id: "6a0000000000000000000003",
  organizationId: "6a0000000000000000000004",
  type: "DIRECT",
  peer: {
    id: peerId,
    username: "lina",
    displayName: "Lina",
    avatarAssetId: null,
  },
  lastMessage: null,
  unreadCount: 0,
  readReceipt: null,
  peerReadReceipt: null,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};
const receipt = (userId: string, messageId: string): ReadReceiptDto => ({
  id: "6a0000000000000000000005",
  conversationId: conversation.id,
  userId,
  lastReadMessageId: messageId,
  lastReadAt: "2026-09-07T00:00:00.000Z",
});

describe("mobile read-receipt cache", () => {
  it("merges newer peer receipts and ignores self or stale events", () => {
    const first = mergePeerReceiptIntoConversation(
      conversation,
      receipt(peerId, "6a0000000000000000000010"),
      currentUserId,
    );
    expect(first).not.toBe(conversation);
    expect(first?.type === "DIRECT" && first.peerReadReceipt?.userId).toBe(
      peerId,
    );

    expect(
      mergePeerReceiptIntoConversation(
        first,
        receipt(peerId, "6a0000000000000000000009"),
        currentUserId,
      ),
    ).toBe(first);
    expect(
      mergePeerReceiptIntoConversation(
        first,
        receipt(currentUserId, "6a0000000000000000000011"),
        currentUserId,
      ),
    ).toBe(first);
  });
});
