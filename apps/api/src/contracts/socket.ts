import type { Server } from "socket.io";

import type { MessageRecord } from "../modules/message/message.types.js";
import type {
  ConversationSocketInput,
  OrganizationSocketInput,
} from "@intouch/shared/realtime";
import type { PresenceView } from "../modules/presence/presence.types.js";
import type { ReadReceiptEvent } from "../modules/read-receipts/read-receipt.realtime.js";
import type { TypingUpdate } from "../modules/typing/typing.realtime.js";

export type { ConversationSocketInput, OrganizationSocketInput };

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
  "organization:subscribe": (
    input: OrganizationSocketInput,
    acknowledge: SocketAcknowledgement,
  ) => void;
  "organization:unsubscribe": (
    input: OrganizationSocketInput,
    acknowledge: SocketAcknowledgement,
  ) => void;
  "typing:start": (
    input: ConversationSocketInput,
    acknowledge: SocketAcknowledgement,
  ) => void;
  "typing:stop": (
    input: ConversationSocketInput,
    acknowledge: SocketAcknowledgement,
  ) => void;
}

export interface ServerToClientEvents {
  "conversation:access-revoked": (input: ConversationSocketInput) => void;
  "message:created": (message: MessageRecord) => void;
  "message:deleted": (message: MessageRecord) => void;
  "message:updated": (message: MessageRecord) => void;
  "presence:updated": (presence: PresenceView) => void;
  "typing:updated": (update: TypingUpdate) => void;
  "read-receipt:updated": (receipt: ReadReceiptEvent) => void;
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
