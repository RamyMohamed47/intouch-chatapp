import type { MessageRecord } from "../modules/message/message.types.js";

export interface MessageBroadcaster {
  messageCreated(message: MessageRecord): void;
  messageDeleted(message: MessageRecord): void;
  messageUpdated(message: MessageRecord): void;
}

export const createNoopMessageBroadcaster = (): MessageBroadcaster => ({
  messageCreated() {},
  messageDeleted() {},
  messageUpdated() {},
});
