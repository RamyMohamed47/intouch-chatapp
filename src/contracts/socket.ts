import type { Server } from "socket.io";

import type { MessageRecord } from "../modules/message/message.types.js";

export interface ConversationSocketInput {
  conversationId: string;
}

export type SocketAcknowledgement = (
  result:
    | { success: true }
    | { success: false; error: { code: string; message: string } },
) => void;

export interface ClientToServerEvents {
  "conversation:join": (
    input: ConversationSocketInput,
    acknowledge: SocketAcknowledgement,
  ) => void;
  "conversation:leave": (
    input: ConversationSocketInput,
    acknowledge: SocketAcknowledgement,
  ) => void;
}

export interface ServerToClientEvents {
  "conversation:access-revoked": (input: ConversationSocketInput) => void;
  "message:created": (message: MessageRecord) => void;
  "message:deleted": (message: MessageRecord) => void;
  "message:updated": (message: MessageRecord) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  userId: string;
}

export type InTouchSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
