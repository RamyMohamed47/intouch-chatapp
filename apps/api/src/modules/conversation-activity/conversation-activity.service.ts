import { randomUUID } from "node:crypto";

import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import {
  ConversationActivityKind,
  type ConversationActivityKindValue,
} from "@intouch/shared/realtime";
import type { Logger } from "pino";

import type { ConversationRecord } from "../conversations/conversation.types.js";
import type { ConversationActivityRealtime } from "./conversation-activity.realtime.js";
import type { ConversationActivityAudienceRepository } from "./conversation-activity.repository.js";

export interface ConversationActivityServiceDependencies {
  audiences: ConversationActivityAudienceRepository;
  logger: Pick<Logger, "error">;
  realtime: ConversationActivityRealtime;
}

const createConversationActivityService = ({
  audiences,
  logger,
  realtime,
}: ConversationActivityServiceDependencies) => {
  const notify = async (
    conversation: ConversationRecord,
    actorUserId: string,
    kind: ConversationActivityKindValue,
  ) => {
    try {
      const recipientUserIds =
        conversation.type === ConversationType.CHANNEL &&
        conversation.visibility === ConversationVisibility.PUBLIC
          ? await audiences.listOrganizationMemberUserIds(
              conversation.organizationId,
              actorUserId,
            )
          : await audiences.listParticipantMemberUserIds(
              conversation.organizationId,
              conversation.id,
              actorUserId,
            );
      if (recipientUserIds.length === 0) return;
      realtime.conversationActivity(recipientUserIds, {
        organizationId: conversation.organizationId,
        conversationId: conversation.id,
        conversationType: conversation.type,
        actorUserId,
        activityId: randomUUID(),
        kind,
      });
    } catch (error) {
      logger.error(
        {
          err: error,
          actorUserId,
          conversationId: conversation.id,
          kind,
        },
        "Conversation activity delivery failed",
      );
    }
  };

  return {
    conversationCreated: (
      conversation: ConversationRecord,
      actorUserId: string,
    ) =>
      notify(
        conversation,
        actorUserId,
        ConversationActivityKind.CONVERSATION_CREATED,
      ),
    messageCreated: (conversation: ConversationRecord, actorUserId: string) =>
      notify(
        conversation,
        actorUserId,
        ConversationActivityKind.MESSAGE_CREATED,
      ),
    messageUpdated: (conversation: ConversationRecord, actorUserId: string) =>
      notify(
        conversation,
        actorUserId,
        ConversationActivityKind.MESSAGE_UPDATED,
      ),
    messageDeleted: (conversation: ConversationRecord, actorUserId: string) =>
      notify(
        conversation,
        actorUserId,
        ConversationActivityKind.MESSAGE_DELETED,
      ),
  };
};

export type ConversationActivityService = ReturnType<
  typeof createConversationActivityService
>;
export default createConversationActivityService;
