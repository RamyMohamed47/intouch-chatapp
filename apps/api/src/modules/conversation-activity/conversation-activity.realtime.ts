import type { ConversationActivityEvent } from "@intouch/shared/realtime";

export interface ConversationActivityRealtime {
  conversationActivity(
    recipientUserIds: readonly string[],
    event: ConversationActivityEvent,
  ): void;
}

export const createNoopConversationActivityRealtime =
  (): ConversationActivityRealtime => ({
    conversationActivity() {},
  });
