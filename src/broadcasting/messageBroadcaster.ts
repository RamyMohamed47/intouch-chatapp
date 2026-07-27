import type { MessageRecord } from "../contracts/message.js";
import type { InTouchSocketServer } from "../contracts/socket.js";

export interface MessageBroadcaster {
  broadcastMessage(message: MessageRecord): void;
}

export interface SocketMessageBroadcaster extends MessageBroadcaster {
  setSocketServer(io: InTouchSocketServer): void;
}

export const createNoopMessageBroadcaster = (): MessageBroadcaster => ({
  broadcastMessage() {},
});

const createSocketMessageBroadcaster = (): SocketMessageBroadcaster => {
  let io: InTouchSocketServer | undefined;

  return {
    setSocketServer(socketServer) {
      io = socketServer;
    },

    broadcastMessage(message) {
      io?.emit("message", message);
    },
  };
};

export default createSocketMessageBroadcaster;
