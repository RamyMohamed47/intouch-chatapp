import type { MessageBroadcaster } from "./messageBroadcaster.js";
import type { InTouchSocketServer } from "../contracts/socket.js";
import type { ConversationRealtime } from "../modules/conversations/conversation.realtime.js";

const roomName = (conversationId: string) => `conversation:${conversationId}`;

export interface SocketRealtimeGateway
  extends MessageBroadcaster, ConversationRealtime {
  setSocketServer(io: InTouchSocketServer): void;
}

const createSocketRealtimeGateway = (): SocketRealtimeGateway => {
  let io: InTouchSocketServer | undefined;

  return {
    setSocketServer(server) {
      io = server;
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

    async evictUser(conversationId, userId) {
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
          socket.emit("conversation:access-revoked", { conversationId });
          socket.leave(roomName(conversationId));
        }
      }
    },

    closeConversation(conversationId) {
      if (!io) return Promise.resolve();
      io.to(roomName(conversationId)).emit("conversation:access-revoked", {
        conversationId,
      });
      io.in(roomName(conversationId)).socketsLeave(roomName(conversationId));
      return Promise.resolve();
    },
  };
};

export { roomName };
export default createSocketRealtimeGateway;
