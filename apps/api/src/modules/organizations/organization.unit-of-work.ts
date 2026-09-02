import mongoose from "mongoose";

import createMongooseCategoryRepository, {
  type CategoryRepository,
} from "../categories/category.repository.js";
import createMongooseChatWallpaperRepository, {
  type ChatWallpaperRepository,
} from "../chat-wallpapers/chat-wallpaper.repository.js";
import createMongooseConversationParticipantRepository, {
  type ConversationParticipantRepository,
} from "../conversations/conversation-participant.repository.js";
import createMongooseConversationRepository, {
  type ConversationRepository,
} from "../conversations/conversation.repository.js";
import createMongooseInvitationRepository, {
  type InvitationRepository,
} from "../invitations/invitation.repository.js";
import {
  createMembershipService,
  createMongooseMembershipRepository,
  type MembershipService,
} from "../memberships/index.js";
import createMongooseMessageRepository, {
  type MessageRepository,
} from "../message/message.repository.js";
import createMongooseMessageReactionRepository, {
  type MessageReactionRepository,
} from "../message-reactions/message-reaction.repository.js";
import createMongooseNotificationRepository, {
  type NotificationRepository,
} from "../notifications/notification.repository.js";
import createMongooseConversationReadStateRepository, {
  type ConversationReadStateRepository,
} from "../read-receipts/read-receipt.repository.js";
import createMongooseOrganizationRepository, {
  type OrganizationRepository,
} from "./organization.repository.js";
import {
  createMongooseStoredAssetRepository,
  type StoredAssetRepository,
} from "../uploads/index.js";
import { createMongooseMailOutboxRepository } from "../mail/index.js";
import type { MailOutboxRepository } from "../mail/index.js";
import createMongooseCallSessionRepository, {
  type CallSessionRepository,
} from "../voice/call.repository.js";

export interface OrganizationWorkContext {
  categories: CategoryRepository;
  chatWallpapers: ChatWallpaperRepository;
  conversations: ConversationRepository;
  conversationParticipants: ConversationParticipantRepository;
  organizations: OrganizationRepository;
  memberships: MembershipService;
  invitations: InvitationRepository;
  messages: MessageRepository;
  messageReactions: MessageReactionRepository;
  conversationReadStates: ConversationReadStateRepository;
  mailOutbox: MailOutboxRepository;
  notifications: NotificationRepository;
  assets: StoredAssetRepository;
  calls?: CallSessionRepository;
}

export interface OrganizationUnitOfWork {
  run<T>(work: (context: OrganizationWorkContext) => Promise<T>): Promise<T>;
}

const createMongooseOrganizationUnitOfWork = (): OrganizationUnitOfWork => ({
  run(work) {
    return mongoose.connection.transaction((session) => {
      const memberships = createMembershipService(
        createMongooseMembershipRepository(session),
      );
      const organizations = createMongooseOrganizationRepository(session);
      const invitations = createMongooseInvitationRepository(session);
      const categories = createMongooseCategoryRepository(session);
      const chatWallpapers = createMongooseChatWallpaperRepository(session);
      const conversations = createMongooseConversationRepository(session);
      const conversationParticipants =
        createMongooseConversationParticipantRepository(session);
      const messages = createMongooseMessageRepository(session);
      const messageReactions = createMongooseMessageReactionRepository(session);
      const conversationReadStates =
        createMongooseConversationReadStateRepository(session);
      const mailOutbox = createMongooseMailOutboxRepository(session);
      const notifications = createMongooseNotificationRepository(session);
      const assets = createMongooseStoredAssetRepository(session);
      const calls = createMongooseCallSessionRepository(session);

      return work({
        categories,
        chatWallpapers,
        conversations,
        conversationParticipants,
        invitations,
        memberships,
        messages,
        messageReactions,
        mailOutbox,
        notifications,
        conversationReadStates,
        organizations,
        assets,
        calls,
      });
    });
  },
});

export default createMongooseOrganizationUnitOfWork;
