export const queryKeys = {
  organizations: {
    all: ["organizations"] as const,
    detail: (organizationId: string) =>
      ["organizations", organizationId] as const,
  },
  invitations: {
    all: ["invitations"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (status: string) => ["notifications", status] as const,
  },
  categories: {
    list: (organizationId: string) =>
      ["organizations", organizationId, "categories"] as const,
  },
  members: {
    list: (organizationId: string) =>
      ["organizations", organizationId, "members"] as const,
  },
  conversations: {
    channels: (organizationId: string, categoryId?: string) =>
      [
        "organizations",
        organizationId,
        "channels",
        categoryId ?? "all",
      ] as const,
    directMessages: (organizationId: string) =>
      ["organizations", organizationId, "direct-messages"] as const,
    directMessagePreview: (organizationId: string) =>
      ["organizations", organizationId, "direct-message-preview"] as const,
    detail: (conversationId: string) =>
      ["conversations", conversationId] as const,
    participants: (conversationId: string) =>
      ["conversations", conversationId, "participants"] as const,
    messages: (conversationId: string) =>
      ["conversations", conversationId, "messages"] as const,
    messageContext: (conversationId: string, messageId: string) =>
      [
        "conversations",
        conversationId,
        "messages",
        "context",
        messageId,
      ] as const,
    messageReaders: (conversationId: string, messageId: string) =>
      ["conversations", conversationId, "message-readers", messageId] as const,
    reactionUsers: (messageId: string, emoji: string) =>
      ["messages", messageId, "reaction-users", emoji] as const,
  },
  search: {
    organization: (
      organizationId: string,
      query: string,
      type: string,
      conversationId?: string,
    ) =>
      [
        "organizations",
        organizationId,
        "search",
        query,
        type,
        conversationId ?? "all-conversations",
      ] as const,
  },
};
