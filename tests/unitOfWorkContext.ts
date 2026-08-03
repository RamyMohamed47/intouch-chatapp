import type { CategoryRepository } from "../src/modules/categories/category.repository.js";
import type { ConversationParticipantRepository } from "../src/modules/conversations/conversation-participant.repository.js";
import type { ConversationRepository } from "../src/modules/conversations/conversation.repository.js";
import type { MessageRepository } from "../src/modules/message/message.repository.js";

const unused = (): never => {
  throw new Error("Unused test repository method");
};

const categories: CategoryRepository = {
  create: async () => unused(),
  findById: async () => null,
  listByOrganization: async () => [],
  countByOrganization: async () => 0,
  updateById: async () => null,
  shiftPositions: async () => undefined,
  deleteById: async () => false,
  deleteByOrganizationId: async () => 0,
};

const conversations: ConversationRepository = {
  create: async () => unused(),
  findById: async () => null,
  listByOrganization: async () => [],
  listIdsByOrganization: async () => [],
  countByCategory: async () => 0,
  updateById: async () => null,
  shiftPositions: async () => undefined,
  deleteById: async () => false,
  deleteByOrganizationId: async () => 0,
};

const conversationParticipants: ConversationParticipantRepository = {
  create: async () => unused(),
  find: async () => null,
  listByConversation: async () => [],
  listConversationIdsForUser: async () => [],
  delete: async () => false,
  deleteByConversationId: async () => 0,
  deleteByOrganizationId: async () => 0,
};

const messages: MessageRepository = {
  create: async () => unused(),
  findById: async () => null,
  listByConversation: async () => [],
  updateContent: async () => null,
  redact: async () => null,
  deleteByConversationId: async () => 0,
  deleteByConversationIds: async () => 0,
};

export const emptyCommunicationContext = {
  categories,
  conversations,
  conversationParticipants,
  messages,
};
