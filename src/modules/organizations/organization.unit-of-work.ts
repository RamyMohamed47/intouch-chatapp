import mongoose from "mongoose";

import createMongooseCategoryRepository, {
  type CategoryRepository,
} from "../categories/category.repository.js";
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
import createMongooseOrganizationRepository, {
  type OrganizationRepository,
} from "./organization.repository.js";

export interface OrganizationWorkContext {
  categories: CategoryRepository;
  conversations: ConversationRepository;
  conversationParticipants: ConversationParticipantRepository;
  organizations: OrganizationRepository;
  memberships: MembershipService;
  invitations: InvitationRepository;
  messages: MessageRepository;
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
      const conversations = createMongooseConversationRepository(session);
      const conversationParticipants =
        createMongooseConversationParticipantRepository(session);
      const messages = createMongooseMessageRepository(session);

      return work({
        categories,
        conversations,
        conversationParticipants,
        invitations,
        memberships,
        messages,
        organizations,
      });
    });
  },
});

export default createMongooseOrganizationUnitOfWork;
