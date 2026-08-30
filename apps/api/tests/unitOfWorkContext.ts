import type { CategoryRepository } from "../src/modules/categories/category.repository.js";
import type { ChatWallpaperRepository } from "../src/modules/chat-wallpapers/chat-wallpaper.repository.js";
import type { ConversationParticipantRepository } from "../src/modules/conversations/conversation-participant.repository.js";
import type { ConversationRepository } from "../src/modules/conversations/conversation.repository.js";
import type { MessageRepository } from "../src/modules/message/message.repository.js";
import type { MessageReactionRepository } from "../src/modules/message-reactions/message-reaction.repository.js";
import type { NotificationRepository } from "../src/modules/notifications/notification.repository.js";
import type { NotificationRecord } from "../src/modules/notifications/notification.types.js";
import { NotificationType } from "@intouch/shared/notifications";
import type { ConversationReadStateRepository } from "../src/modules/read-receipts/read-receipt.repository.js";
import type { InvitationRepository } from "../src/modules/invitations/invitation.repository.js";
import type { MembershipService } from "../src/modules/memberships/membership.service.js";
import type { OrganizationRepository } from "../src/modules/organizations/organization.repository.js";
import type {
  OrganizationUnitOfWork,
  OrganizationWorkContext,
} from "../src/modules/organizations/organization.unit-of-work.js";
import type { MailOutboxRepository } from "../src/modules/mail/index.js";
import type { StoredAssetRepository } from "../src/modules/uploads/index.js";
import {
  MailKind,
  type MailOutboxJobFactory,
} from "../src/modules/mail/index.js";

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

const chatWallpapers: ChatWallpaperRepository = {
  findDefault: async () => null,
  findForConversation: async () => null,
  upsert: async () => unused(),
  deleteForConversation: async () => false,
  deleteByConversationId: async () => 0,
  deleteByConversationIds: async () => 0,
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
  listContext: async () => ({
    messages: [],
    hasEarlier: false,
    hasLater: false,
  }),
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

const mailOutbox: MailOutboxRepository = {
  enqueue: async () => undefined,
  cancel: async () => undefined,
  cancelByPrefix: async () => undefined,
  claimNext: async () => null,
  claimById: async () => null,
  listDispatchable: async () => [],
  markDispatched: async () => undefined,
  markSent: async () => undefined,
  scheduleRetry: async () => undefined,
  markFailed: async () => undefined,
};

const notificationBase = (
  input: Pick<
    NotificationRecord,
    | "recipientUserId"
    | "actorUserId"
    | "organizationId"
    | "type"
    | "lastActivityAt"
    | "expiresAt"
  >,
): NotificationRecord => ({
  id: "507f1f77bcf86cd799439099",
  ...input,
  readAt: null,
  createdAt: input.lastActivityAt,
  updatedAt: input.lastActivityAt,
});

const notifications: NotificationRepository = {
  create: async (input) => ({
    ...notificationBase(input),
    ...(input.invitationId ? { invitationId: input.invitationId } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(input.conversationType
      ? { conversationType: input.conversationType }
      : {}),
    ...(input.messageId ? { messageId: input.messageId } : {}),
    ...(input.emoji ? { emoji: input.emoji } : {}),
  }),
  upsertDirectMessage: async (input) => ({
    ...notificationBase({
      ...input,
      type: NotificationType.DIRECT_MESSAGE_RECEIVED,
    }),
    conversationId: input.conversationId,
    latestMessageId: input.latestMessageId,
    messageCount: 1,
  }),
  upsertReaction: async (input) => ({
    ...notificationBase({
      ...input,
      type: NotificationType.MESSAGE_REACTION_RECEIVED,
    }),
    conversationId: input.conversationId,
    conversationType: input.conversationType,
    messageId: input.messageId,
    emoji: input.emoji,
  }),
  listForUser: async () => [],
  countUnread: async () => 0,
  markRead: async () => null,
  markAllRead: async () => 0,
  markDirectMessageReadThrough: async () => null,
  deleteReaction: async () => null,
  deleteByInvitationId: async () => [],
  deleteByMessageId: async () => [],
  deleteByConversationId: async () => [],
  deleteByConversationAndRecipient: async () => [],
  deleteByConversationAndActor: async () => [],
  deleteByOrganizationId: async () => [],
};

const assets: StoredAssetRepository = {
  createMany: async () => [],
  findById: async () => null,
  findReadyById: async () => null,
  listReadyByMessageIds: async () => [],
  countPendingByOwner: async () => 0,
  sumActiveBytesByOrganization: async () => 0,
  claimForPromotion: async () => null,
  markPromoted: async () => null,
  releasePromotion: async () => undefined,
  markDeletePending: async () => false,
  markClaimedForDeletion: async () => false,
  claimForMessage: async () => [],
  claimAvatar: async () => null,
  claimOrganizationLogo: async () => null,
  markMessageAssetsForDeletion: async () => 0,
  markConversationAssetsForDeletion: async () => 0,
  markOrganizationAssetsForDeletion: async () => 0,
  claimNextCleanup: async () => null,
  claimNextStagingCleanup: async () => null,
  listCleanupCandidates: async () => [],
  claimCleanupById: async () => null,
  completeCleanup: async () => undefined,
  completeStagingCleanup: async () => undefined,
  scheduleCleanupRetry: async () => undefined,
};

export const testMailFactory: MailOutboxJobFactory = {
  verification: (input) => ({
    aggregateKey: `auth-verification:${input.userId}`,
    kind: MailKind.EMAIL_VERIFICATION,
    ciphertext: "encrypted",
    iv: "iv",
    authTag: "tag",
    availableAt: new Date(0),
    expiresAt: input.expiresAt,
  }),
  passwordReset: (input) => ({
    aggregateKey: `auth-reset:${input.userId}`,
    kind: MailKind.PASSWORD_RESET,
    ciphertext: "encrypted",
    iv: "iv",
    authTag: "tag",
    availableAt: new Date(0),
    expiresAt: input.expiresAt,
  }),
  organizationInvitation: (input) => ({
    aggregateKey: `organization:${input.organizationId}:invitation:${input.invitationId}`,
    kind: MailKind.ORGANIZATION_INVITATION,
    ciphertext: "encrypted",
    iv: "iv",
    authTag: "tag",
    availableAt: new Date(0),
    expiresAt: input.expiresAt,
  }),
};

export const emptyCommunicationContext = {
  categories,
  chatWallpapers,
  conversations,
  conversationParticipants,
  conversationReadStates,
  messageReactions,
  messages,
  mailOutbox,
  notifications,
  assets,
};

const organizations: OrganizationRepository = {
  create: async () => unused(),
  findById: async () => null,
  findByIds: async () => [],
  lockForMutation: async () => true,
  updateById: async () => null,
  replaceLogoAsset: async () => null,
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
      assets,
      ...overrides,
    }),
});
