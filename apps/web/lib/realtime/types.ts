import type {
  ConversationAccessRevokedEvent,
  ChannelReadReceiptsChangedEvent,
  ConversationActivityEvent,
  ConversationSocketInput,
  MembershipJoinedEvent,
  MessageEvent,
  MessageReactionsChangedEvent,
  NotificationChangedEvent,
  OrganizationSocketInput,
  PresenceEvent,
  ReadReceiptEvent,
  SocketAcknowledgementResult,
  TypingEvent,
} from "@intouch/shared/realtime";

export type SocketAcknowledgement = (
  result: SocketAcknowledgementResult,
) => void;

export interface ServerToClientEvents {
  "channel-read-receipts:changed": (
    event: ChannelReadReceiptsChangedEvent,
  ) => void;
  "conversation:activity": (event: ConversationActivityEvent) => void;
  "conversation:access-revoked": (
    input: ConversationAccessRevokedEvent,
  ) => void;
  "message:created": (message: MessageEvent) => void;
  "message:deleted": (message: MessageEvent) => void;
  "message:updated": (message: MessageEvent) => void;
  "message-reactions:changed": (event: MessageReactionsChangedEvent) => void;
  "notification:changed": (event: NotificationChangedEvent) => void;
  "membership:joined": (event: MembershipJoinedEvent) => void;
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
