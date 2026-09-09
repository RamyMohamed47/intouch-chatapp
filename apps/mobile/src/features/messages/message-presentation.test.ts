import type { MessageDto, ReadReceiptDto } from "@intouch/shared/messages";

import {
  callMessageLabel,
  hasReadMessage,
} from "@/features/messages/message-presentation";

const message = (call: MessageDto["call"]): MessageDto => ({
  id: "6a0000000000000000000002",
  conversationId: "6a0000000000000000000001",
  senderId: "6a0000000000000000000003",
  content: null,
  messageType: "CALL",
  editedAt: null,
  deletedAt: null,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
  attachments: [],
  reactions: [],
  currentUserReaction: null,
  mentions: [],
  replyTo: null,
  call,
});

describe("mobile message presentation", () => {
  it("compares persisted receipt high-water marks", () => {
    const receipt = {
      id: "6a0000000000000000000004",
      conversationId: "6a0000000000000000000001",
      userId: "6a0000000000000000000005",
      lastReadMessageId: "6a0000000000000000000008",
      lastReadAt: "2026-09-07T00:00:00.000Z",
    } satisfies ReadReceiptDto;

    expect(hasReadMessage(receipt, "6a0000000000000000000007")).toBe(true);
    expect(hasReadMessage(receipt, "6a0000000000000000000009")).toBe(false);
    expect(hasReadMessage(null, "6a0000000000000000000001")).toBe(false);
  });

  it("renders missed and completed video calls", () => {
    const baseCall = {
      id: "6a0000000000000000000010",
      callerUserId: "6a0000000000000000000003",
      recipientUserId: "6a0000000000000000000005",
      mediaMode: "VIDEO" as const,
      status: "ENDED" as const,
      startedAt: "2026-09-07T00:00:00.000Z",
      answeredAt: null,
      endedAt: "2026-09-07T00:00:08.000Z",
    };

    expect(
      callMessageLabel(
        message({ ...baseCall, endReason: "MISSED", durationSeconds: null }),
        baseCall.recipientUserId,
      ),
    ).toBe("Missed video call");
    expect(
      callMessageLabel(
        message({
          ...baseCall,
          endReason: "COMPLETED",
          durationSeconds: 125,
        }),
      ),
    ).toBe("Video call - 2:05");
  });
});
