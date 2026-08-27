import type { CategoryRepository } from "../src/modules/categories/category.repository.js";
import type { ConversationParticipantRepository } from "../src/modules/conversations/conversation-participant.repository.js";
import type { ConversationRepository } from "../src/modules/conversations/conversation.repository.js";
import type { MessageRepository } from "../src/modules/message/message.repository.js";
import type { MessageReactionRepository } from "../src/modules/message-reactions/message-reaction.repository.js";
import type { ConversationReadStateRepository } from "../src/modules/read-receipts/read-receipt.repository.js";
import type { InvitationRepository } from "../src/modules/invitations/invitation.repository.js";
import type { MembershipService } from "../src/modules/memberships/membership.service.js";
import type { OrganizationRepository } from "../src/modules/organizations/organization.repository.js";
import type {
  OrganizationUnitOfWork,
  OrganizationWorkContext,
} from "../src/modules/organizations/organization.unit-of-work.js";

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
  findByIds: async () => [],
  findDirectByParticipantKey: async () => null,
  listDirectForParticipant: async () => [],
  listByOrganization: async () => [],
  listIdsByOrganization: async () => [],
  countByCategory: async () => 0,
  updateById: async () => null,
  touchActivity: async () => true,
  shiftPositions: async () => undefined,
  deleteById: async () => false,
  deleteByOrganizationId: async () => 0,
};

const conversationParticipants: ConversationParticipantRepository = {
  create: async () => unused(),
  find: async () => null,
  listByConversation: async () => [],
  listByConversationIds: async () => [],
  listConversationIdsForUser: async () => [],
  listConversationIdsForUserInOrganization: async () => [],
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

const messageReactions: MessageReactionRepository = {
  findForUser: async () => null,
  upsert: async () => unused(),
  deleteForUser: async () => false,
  summarize: async () => [],
  listUsers: async () => ({ records: [], total: 0 }),
  deleteByMessageId: async () => 0,
  deleteByConversationId: async () => 0,
  deleteByConversationIds: async () => 0,
  deleteByConversationAndUser: async () => 0,
  deleteByConversationExceptUsers: async () => 0,
};

const conversationReadStates: ConversationReadStateRepository = {
  advance: async () => unused(),
  find: async () => null,
  findForUserByConversations: async () => [],
  summarizeMessageReaders: async (input) => ({
    messageId: input.messageId,
    readByCount: 0,
    readers: [],
  }),
  deleteByConversationId: async () => 0,
  deleteByOrganizationId: async () => 0,
};

export const emptyCommunicationContext = {
  categories,
  conversations,
  conversationParticipants,
  conversationReadStates,
  messageReactions,
  messages,
};

const organizations: OrganizationRepository = {
  create: async () => unused(),
  findById: async () => null,
  findByIds: async () => [],
  lockForMutation: async () => true,
  updateById: async () => null,
  deleteById: async () => false,
};

const memberships: MembershipService = {
  createOwner: async () => unused(),
  createMember: async () => unused(),
  findForUser: async () => null,
  listForUser: async () => [],
  listForOrganization: async () => [],
  deleteForOrganization: async () => 0,
};

const invitations: InvitationRepository = {
  create: async () => unused(),
  findById: async () => null,
  findByOrganizationAndUser: async () => null,
  findPendingByUser: async () => [],
  deleteById: async () => false,
  deleteByOrganizationAndUser: async () => 0,
  deleteExpiredByOrganizationAndUser: async () => 0,
  deleteByOrganizationId: async () => 0,
};

export const createTestUnitOfWork = (
  overrides: Partial<OrganizationWorkContext> = {},
): OrganizationUnitOfWork => ({
  run: (work) =>
    work({
      ...emptyCommunicationContext,
      invitations,
      memberships,
      organizations,
      ...overrides,
    }),
});
