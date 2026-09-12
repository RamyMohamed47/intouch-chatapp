import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import {
  shouldLoadConversationParticipants,
  shouldPositionAtLatestMessage,
} from "@/features/conversations/conversation-screen-policy";

describe("conversation screen policy", () => {
  it("loads participant records only for private channels", () => {
    expect(
      shouldLoadConversationParticipants({ type: ConversationType.DIRECT }),
    ).toBe(false);
    expect(
      shouldLoadConversationParticipants({
        type: ConversationType.CHANNEL,
        visibility: ConversationVisibility.PUBLIC,
      }),
    ).toBe(false);
    expect(
      shouldLoadConversationParticipants({
        type: ConversationType.CHANNEL,
        visibility: ConversationVisibility.PRIVATE,
      }),
    ).toBe(true);
  });

  it("positions each newly opened unanchored conversation at its latest message once", () => {
    expect(
      shouldPositionAtLatestMessage({
        anchorMessageId: "",
        conversationId: "conversation-1",
        messageCount: 3,
        positionedConversationId: null,
      }),
    ).toBe(true);
    expect(
      shouldPositionAtLatestMessage({
        anchorMessageId: "",
        conversationId: "conversation-1",
        messageCount: 3,
        positionedConversationId: "conversation-1",
      }),
    ).toBe(false);
    expect(
      shouldPositionAtLatestMessage({
        anchorMessageId: "message-2",
        conversationId: "conversation-1",
        messageCount: 3,
        positionedConversationId: null,
      }),
    ).toBe(false);
  });
});
