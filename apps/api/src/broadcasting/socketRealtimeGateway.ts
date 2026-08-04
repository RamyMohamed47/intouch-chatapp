import type { MessageBroadcaster } from "./messageBroadcaster.js";
import type { InTouchSocketServer } from "../contracts/socket.js";
import type { ConversationRealtime } from "../modules/conversations/conversation.realtime.js";
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
    ConversationRealtime,
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
      io?.to(roomName(message.conversationId)).emit("message:created", message);
    },

    messageUpdated(message) {
      io?.to(roomName(message.conversationId)).emit("message:updated", message);
    },

    messageDeleted(message) {
      io?.to(roomName(message.conversationId)).emit("message:deleted", message);
    },

    presenceUpdated(organizationIds, presence) {
      const rooms = organizationIds.map(organizationRoomName);
      if (rooms.length > 0) io?.to(rooms).emit("presence:updated", presence);
    },

    typingUpdated(update) {
      io?.to(roomName(update.conversationId))
        .except(userRoomName(update.userId))
        .emit("typing:updated", update);
    },

    readReceiptUpdated(receipt) {
      io?.to(roomName(receipt.conversationId)).emit(
        "read-receipt:updated",
        receipt,
      );
    },

    async evictUser(conversationId, userId) {
      typing?.clearUserInConversation(conversationId, userId);
      if (!io) return;
      const sockets = await io.in(roomName(conversationId)).fetchSockets();
      for (const socket of sockets) {
        if (socket.data.userId === userId) {
          socket.emit("conversation:access-revoked", { conversationId });
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
          socket.emit("conversation:access-revoked", { conversationId });
          socket.leave(roomName(conversationId));
        }
      }
    },

    closeConversation(conversationId) {
      typing?.clearConversation(conversationId);
      if (!io) return Promise.resolve();
      io.to(roomName(conversationId)).emit("conversation:access-revoked", {
        conversationId,
      });
      io.in(roomName(conversationId)).socketsLeave(roomName(conversationId));
      return Promise.resolve();
    },
  };
};

export { organizationRoomName, roomName, userRoomName };
export default createSocketRealtimeGateway;
