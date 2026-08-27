export interface MessageReactionRealtime {
  messageReactionsChanged(event: {
    activityId: string;
    conversationId: string;
    messageId: string;
  }): void;
}
