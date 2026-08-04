import type {
  ConversationSocketInput,
  OrganizationSocketInput,
} from "@intouch/shared/realtime";

export interface SocketError {
  code: string;
  message: string;
}

export type SocketAcknowledgement = (
  result: { success: true } | { success: false; error: SocketError },
) => void;

export interface MessageEvent {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  messageType: "TEXT";
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface PresenceEvent {
  userId: string;
  status: "ONLINE" | "OFFLINE";
  lastSeenAt: string | null;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface ReadReceiptEvent {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}

export interface ServerToClientEvents {
  "conversation:access-revoked": (input: ConversationSocketInput) => void;
  "message:created": (message: MessageEvent) => void;
  "message:deleted": (message: MessageEvent) => void;
  "message:updated": (message: MessageEvent) => void;
  "presence:updated": (presence: PresenceEvent) => void;
  "typing:updated": (update: TypingEvent) => void;
  "read-receipt:updated": (receipt: ReadReceiptEvent) => void;
}

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
