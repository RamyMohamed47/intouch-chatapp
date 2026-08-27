import type { MessageBroadcaster } from "./messageBroadcaster.js";
import {
  channelReadReceiptsChangedEventSchema,
  conversationActivityEventSchema,
  conversationAccessRevokedEventSchema,
  membershipJoinedEventSchema,
  messageEventSchema,
  presenceEventSchema,
  readReceiptEventSchema,
  typingEventSchema,
} from "@intouch/shared/realtime";
import type { InTouchSocketServer } from "../contracts/socket.js";
import type { ConversationRealtime } from "../modules/conversations/conversation.realtime.js";
import type { ConversationActivityRealtime } from "../modules/conversation-activity/conversation-activity.realtime.js";
import type { MembershipRealtime } from "../modules/memberships/membership.realtime.js";
import type { PresenceRealtime } from "../modules/presence/presence.realtime.js";
import type { ReadReceiptRealtime } from "../modules/read-receipts/read-receipt.realtime.js";
import type { TypingRealtime } from "../modules/typing/typing.realtime.js";
import type { TypingService } from "../modules/typing/typing.service.js";

const roomName = (conversationId: string) => `conversation:${conversationId}`;
const organizationRoomName = (organizationId: string) =>
  `organization:${organizationId}`;
const userRoomName = (userId: string) => `user:${userId}`;

export interface SocketRealtimeGateway
  extends
    MessageBroadcaster,
    ConversationActivityRealtime,
    ConversationRealtime,
    MembershipRealtime,
    PresenceRealtime,
    ReadReceiptRealtime,
    TypingRealtime {
  setSocketServer(io: InTouchSocketServer): void;
  setTypingService(
    typing: Pick<
      TypingService,
      "clearConversation" | "clearUserInConversation"
    >,
  ): void;
}

const createSocketRealtimeGateway = (): SocketRealtimeGateway => {
  let io: InTouchSocketServer | undefined;
  let typing:
    | Pick<TypingService, "clearConversation" | "clearUserInConversation">
    | undefined;

  return {
    setSocketServer(server) {
      io = server;
    },

    setTypingService(service) {
      typing = service;
    },

    messageCreated(message) {
      io?.to(roomName(message.conversationId)).emit(
        "message:created",
        messageEventSchema.parse(message),
      );
    },

    messageUpdated(message) {
      io?.to(roomName(message.conversationId)).emit(
        "message:updated",
        messageEventSchema.parse(message),
      );
    },

    messageDeleted(message) {
      io?.to(roomName(message.conversationId)).emit(
        "message:deleted",
        messageEventSchema.parse(message),
      );
    },

    conversationActivity(recipientUserIds, event) {
      const rooms = recipientUserIds.map(userRoomName);
      if (rooms.length === 0) return;
      io?.to(rooms).emit(
        "conversation:activity",
        conversationActivityEventSchema.parse(event),
      );
    },

    membershipJoined(event) {
      io?.to(organizationRoomName(event.organizationId)).emit(
        "membership:joined",
        membershipJoinedEventSchema.parse(event),
      );
    },

    presenceUpdated(organizationIds, presence) {
      const rooms = organizationIds.map(organizationRoomName);
      if (rooms.length > 0) {
        io?.to(rooms).emit(
          "presence:updated",
          presenceEventSchema.parse(presence),
        );
      }
    },

    typingUpdated(update) {
      io?.to(roomName(update.conversationId))
        .except(userRoomName(update.userId))
        .emit("typing:updated", typingEventSchema.parse(update));
    },

    readReceiptUpdated(receipt) {
      io?.to(roomName(receipt.conversationId)).emit(
        "read-receipt:updated",
        readReceiptEventSchema.parse(receipt),
      );
    },

    channelReadReceiptsChanged(conversationId, excludedUserId) {
      io?.to(roomName(conversationId))
        .except(userRoomName(excludedUserId))
        .emit(
          "channel-read-receipts:changed",
          channelReadReceiptsChangedEventSchema.parse({ conversationId }),
        );
    },

    async evictUser(conversationId, userId) {
      typing?.clearUserInConversation(conversationId, userId);
      if (!io) return;
      const sockets = await io.in(roomName(conversationId)).fetchSockets();
      for (const socket of sockets) {
        if (socket.data.userId === userId) {
          socket.emit(
            "conversation:access-revoked",
            conversationAccessRevokedEventSchema.parse({ conversationId }),
          );
          socket.leave(roomName(conversationId));
        }
      }
    },

    async retainOnlyUser(conversationId, userId) {
      if (!io) return;
      const sockets = await io.in(roomName(conversationId)).fetchSockets();
      for (const socket of sockets) {
        if (socket.data.userId !== userId) {
          typing?.clearUserInConversation(conversationId, socket.data.userId);
          socket.emit(
            "conversation:access-revoked",
            conversationAccessRevokedEventSchema.parse({ conversationId }),
          );
          socket.leave(roomName(conversationId));
        }
      }
    },

    closeConversation(conversationId) {
      typing?.clearConversation(conversationId);
      if (!io) return Promise.resolve();
      io.to(roomName(conversationId)).emit(
        "conversation:access-revoked",
        conversationAccessRevokedEventSchema.parse({ conversationId }),
      );
      io.in(roomName(conversationId)).socketsLeave(roomName(conversationId));
      return Promise.resolve();
    },
  };
};

export { organizationRoomName, roomName, userRoomName };
export default createSocketRealtimeGateway;
