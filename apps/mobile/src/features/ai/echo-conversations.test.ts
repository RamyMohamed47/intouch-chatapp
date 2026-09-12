import {
  ChannelKind,
  ConversationType,
  ConversationVisibility,
  type ConversationDto,
  type DirectConversationDto,
} from "@intouch/shared/conversations";

import {
  buildEchoConversationOptions,
  filterEchoConversationOptions,
} from "@/features/ai/echo-conversations";

const createdAt = "2026-09-10T00:00:00.000Z";
const baseChannel = {
  organizationId: "507f1f77bcf86cd799439011",
  categoryId: "507f1f77bcf86cd799439012",
  type: ConversationType.CHANNEL,
  visibility: ConversationVisibility.PUBLIC,
  position: 0,
  createdAt,
  updatedAt: createdAt,
};

describe("Echo conversation options", () => {
  it("includes text channels and direct chats while excluding voice channels", () => {
    const channels: ConversationDto[] = [
      {
        ...baseChannel,
        id: "507f1f77bcf86cd799439013",
        kind: ChannelKind.TEXT,
        name: "product",
      },
      {
        ...baseChannel,
        id: "507f1f77bcf86cd799439014",
        kind: ChannelKind.VOICE,
        name: "Standup",
        occupancy: {
          conversationId: "507f1f77bcf86cd799439014",
          capacity: 10,
          participantUserIds: [],
          participants: [],
        },
      },
    ];
    const directs: DirectConversationDto[] = [
      {
        id: "507f1f77bcf86cd799439015",
        organizationId: baseChannel.organizationId,
        type: ConversationType.DIRECT,
        peer: {
          id: "507f1f77bcf86cd799439016",
          username: "alex",
          displayName: "Alex Rivera",
          avatarAssetId: null,
        },
        lastMessage: null,
        unreadCount: 0,
        readReceipt: null,
        peerReadReceipt: null,
        createdAt,
        updatedAt: createdAt,
      },
    ];

    const options = buildEchoConversationOptions(channels, directs);
    expect(options).toEqual([
      {
        id: "507f1f77bcf86cd799439013",
        label: "product",
        type: "CHANNEL",
      },
      {
        id: "507f1f77bcf86cd799439015",
        label: "Alex Rivera",
        type: "DIRECT",
      },
    ]);
    expect(filterEchoConversationOptions(options, "alex")).toEqual([
      options[1],
    ]);
  });
});
