export interface TypingUpdate {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface TypingRealtime {
  typingUpdated(update: TypingUpdate): void;
}

export const createNoopTypingRealtime = (): TypingRealtime => ({
  typingUpdated() {},
});
