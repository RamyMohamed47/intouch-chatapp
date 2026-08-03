import { ConversationVisibility } from "@intouch/shared/conversations";

import { MembershipRole, type MembershipRecord } from "../memberships/index.js";
import type { MessageRecord } from "../message/message.types.js";
import {
  MessageConflictError,
  MessageForbiddenError,
  MessageNotFoundError,
} from "../message/message.errors.js";
import {
  ConversationConflictError,
  ConversationForbiddenError,
  ConversationNotFoundError,
} from "./conversation.errors.js";
import type {
  ConversationParticipantRecord,
  ConversationRecord,
} from "./conversation.types.js";

const createConversationPolicy = () => {
  const assertOwner = (
    conversation: ConversationRecord | null,
    membership: MembershipRecord | null,
    participant: ConversationParticipantRecord | null = null,
  ) => {
    if (
      !conversation ||
      !membership ||
      (conversation.visibility === ConversationVisibility.PRIVATE &&
        membership.role !== MembershipRole.OWNER &&
        !participant)
    ) {
      throw new ConversationNotFoundError();
    }
    if (membership?.role !== MembershipRole.OWNER) {
      throw new ConversationForbiddenError();
    }
    return conversation;
  };

  return {
    assertAccessible(
      conversation: ConversationRecord | null,
      membership: MembershipRecord | null,
      participant: ConversationParticipantRecord | null,
    ) {
      if (
        !conversation ||
        !membership ||
        (conversation.visibility === ConversationVisibility.PRIVATE &&
          !participant)
      ) {
        throw new ConversationNotFoundError();
      }

      return conversation;
    },

    assertOwner,

    assertPrivateOwner(
      conversation: ConversationRecord | null,
      membership: MembershipRecord | null,
      participant: ConversationParticipantRecord | null = null,
    ) {
      const ownedConversation = assertOwner(
        conversation,
        membership,
        participant,
      );
      if (ownedConversation.visibility !== ConversationVisibility.PRIVATE) {
        throw new ConversationConflictError(
          "Participants are only managed for private conversations",
        );
      }
      return ownedConversation;
    },

    assertMessageEditable(message: MessageRecord | null, userId: string) {
      if (!message) throw new MessageNotFoundError();
      if (message.senderId !== userId) throw new MessageForbiddenError();
      if (message.deletedAt) throw new MessageConflictError();
      return message;
    },

    assertMessageDeletable(
      message: MessageRecord | null,
      userId: string,
      membership: MembershipRecord | null,
    ) {
      if (!message) throw new MessageNotFoundError();
      if (
        message.senderId !== userId &&
        membership?.role !== MembershipRole.OWNER
      ) {
        throw new MessageForbiddenError();
      }
      return message;
    },
  };
};

export type ConversationPolicy = ReturnType<typeof createConversationPolicy>;
export default createConversationPolicy;
