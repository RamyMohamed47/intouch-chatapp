import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";

import type { MembershipService } from "../memberships/index.js";
import type { OrganizationPolicy } from "../organizations/organization.policy.js";
import type { OrganizationRepository } from "../organizations/organization.repository.js";
import type { ConversationParticipantRepository } from "./conversation-participant.repository.js";
import type { ConversationRepository } from "./conversation.repository.js";

export interface ConversationAccessScopeDependencies {
  conversations: ConversationRepository;
  memberships: MembershipService;
  organizationPolicy: OrganizationPolicy;
  organizations: OrganizationRepository;
  participants: ConversationParticipantRepository;
}

const createConversationAccessScopeService = ({
  conversations,
  memberships,
  organizationPolicy,
  organizations,
  participants,
}: ConversationAccessScopeDependencies) => ({
  async getForUser(userId: string, organizationId: string) {
    const [organization, membership] = await Promise.all([
      organizations.findById(organizationId),
      memberships.findForUser(userId, organizationId),
    ]);
    organizationPolicy.assertMember(organization, membership);

    const [channels, participantIds, organizationMemberships] =
      await Promise.all([
        conversations.listByOrganization(organizationId),
        participants.listConversationIdsForUserInOrganization(
          userId,
          organizationId,
        ),
        memberships.listForOrganization(organizationId),
      ]);
    const participantSet = new Set(participantIds);
    const accessibleChannels = channels.filter(
      (conversation) =>
        conversation.visibility === ConversationVisibility.PUBLIC ||
        participantSet.has(conversation.id),
    );
    const channelIds = new Set(accessibleChannels.map(({ id }) => id));
    const directConversations = await conversations.findByIds(
      participantIds.filter(
        (conversationId) => !channelIds.has(conversationId),
      ),
      ConversationType.DIRECT,
    );

    return {
      accessibleChannels,
      directConversations,
      memberships: organizationMemberships,
    };
  },
});

export type ConversationAccessScopeService = ReturnType<
  typeof createConversationAccessScopeService
>;

export default createConversationAccessScopeService;
