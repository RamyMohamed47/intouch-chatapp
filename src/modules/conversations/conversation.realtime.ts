export interface ConversationRealtime {
  closeConversation(conversationId: string): Promise<void>;
  evictUser(conversationId: string, userId: string): Promise<void>;
  retainOnlyUser(conversationId: string, userId: string): Promise<void>;
}

export const createNoopConversationRealtime = (): ConversationRealtime => ({
  async closeConversation() {},
  async evictUser() {},
  async retainOnlyUser() {},
});
