export const SEARCH_INDEX_NAMES = {
  messages: "intouch_messages_v1",
  conversations: "intouch_conversations_v1",
  users: "intouch_users_v1",
} as const;

export const SEARCH_INDEX_DEFINITIONS = {
  messages: {
    name: SEARCH_INDEX_NAMES.messages,
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          _id: { type: "objectId" },
          content: { type: "string" },
          conversationId: { type: "objectId" },
          createdAt: { type: "date" },
          deletedAt: { type: "date" },
        },
      },
    },
  },
  conversations: {
    name: SEARCH_INDEX_NAMES.conversations,
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          _id: { type: "objectId" },
          name: { type: "autocomplete" },
          organizationId: { type: "objectId" },
          type: { type: "token" },
        },
      },
    },
  },
  users: {
    name: SEARCH_INDEX_NAMES.users,
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          _id: { type: "objectId" },
          displayName: { type: "autocomplete" },
          username: { type: "autocomplete" },
        },
      },
    },
  },
} as const;
