import { randomUUID } from "node:crypto";

import { ConversationVisibility } from "@intouch/shared/conversations";
import type { Logger } from "pino";

import type { ConversationParticipantRepository } from "../conversations/conversation-participant.repository.js";
import type { ConversationService } from "../conversations/conversation.service.js";
import type { ConversationRecord } from "../conversations/conversation.types.js";
import type { MembershipService } from "../memberships/index.js";
import { MessageNotFoundError } from "../message/message.errors.js";
import type { MessageRepository } from "../message/message.repository.js";
import type { MessageRecord } from "../message/message.types.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import type { UserRepository } from "../user/user.repository.js";
import { MessageReactionConflictError } from "./message-reaction.errors.js";
import type { MessageReactionRealtime } from "./message-reaction.realtime.js";
import type { MessageReactionRepository } from "./message-reaction.repository.js";
import type {
  MessageReactionStateRecord,
  MessageReactionUsersQuery,
  SetMessageReactionInput,
} from "./message-reaction.types.js";

export type MessageWithReactionState = MessageRecord & {
  reactions: MessageReactionStateRecord["reactions"];
  currentUserReaction: string | null;
};

export interface MessageReactionServiceDependencies {
  conversations: Pick<
    ConversationService,
    "getAccessible" | "getAccessibleInContext"
  >;
  logger: Pick<Logger, "error">;
  memberships: Pick<MembershipService, "listForOrganization">;
  messages: Pick<MessageRepository, "findById">;
  participants: Pick<ConversationParticipantRepository, "listByConversation">;
  reactions: MessageReactionRepository;
  realtime: MessageReactionRealtime;
  unitOfWork: OrganizationUnitOfWork;
  users: Pick<UserRepository, "findPublicByIds">;
}

const createMessageReactionService = ({
  conversations,
  logger,
  memberships,
  messages,
  participants,
  reactions,
  realtime,
  unitOfWork,
  users,
}: MessageReactionServiceDependencies) => {
  const eligibleUserIds = async (
    conversation: ConversationRecord,
    membershipSource: Pick<MembershipService, "listForOrganization">,
    participantSource: Pick<
      ConversationParticipantRepository,
      "listByConversation"
    >,
  ) => {
    const organizationMemberships = await membershipSource.listForOrganization(
      conversation.organizationId,
    );
    const memberIds = new Set(
      organizationMemberships.map((membership) => membership.userId),
    );
    if (
      conversation.type === "CHANNEL" &&
      conversation.visibility === ConversationVisibility.PUBLIC
    ) {
      return [...memberIds];
    }
    const conversationParticipants = await participantSource.listByConversation(
      conversation.id,
    );
    return conversationParticipants
      .map((participant) => participant.userId)
      .filter((userId) => memberIds.has(userId));
  };

  const summarize = async (
    userId: string,
    conversation: ConversationRecord,
    messageIds: readonly string[],
    repository = reactions,
    membershipSource = memberships,
    participantSource = participants,
  ) => {
    const eligible = await eligibleUserIds(
      conversation,
      membershipSource,
      participantSource,
    );
    return repository.summarize(messageIds, userId, eligible);
  };

  const decorate = async (
    userId: string,
    conversation: ConversationRecord,
    records: readonly MessageRecord[],
  ): Promise<MessageWithReactionState[]> => {
    const states = await summarize(
      userId,
      conversation,
      records.map((message) => message.id),
    );
    const statesByMessageId = new Map(
      states.map((state) => [state.messageId, state]),
    );
    return records.map((message) => {
      const state = statesByMessageId.get(message.id);
      return {
        ...message,
        reactions: state?.reactions ?? [],
        currentUserReaction: state?.currentUserReaction ?? null,
      };
    });
  };

  const findAccessibleMessage = async (userId: string, messageId: string) => {
    const message = await messages.findById(messageId);
    if (!message) throw new MessageNotFoundError();
    const conversation = await conversations.getAccessible(
      userId,
      message.conversationId,
    );
    return { conversation, message };
  };

  const notify = (conversationId: string, messageId: string) => {
    try {
      realtime.messageReactionsChanged({
        activityId: randomUUID(),
        conversationId,
        messageId,
      });
    } catch (error) {
      logger.error(
        { err: error, conversationId, messageId },
        "Message reaction delivery failed",
      );
    }
  };

  return {
    decorate,

    async getState(userId: string, messageId: string) {
      const { conversation } = await findAccessibleMessage(userId, messageId);
      const [state] = await summarize(userId, conversation, [messageId]);
      return (
        state ?? {
          messageId,
          reactions: [],
          currentUserReaction: null,
        }
      );
    },

    async set(
      userId: string,
      messageId: string,
      input: SetMessageReactionInput,
    ) {
      const result = await unitOfWork.run(async (context) => {
        const message = await context.messages.findById(messageId);
        if (!message) throw new MessageNotFoundError();
        if (message.deletedAt) throw new MessageReactionConflictError();
        const conversation = await conversations.getAccessibleInContext(
          userId,
          message.conversationId,
          context,
        );
        if (
          !(await context.organizations.lockForMutation(
            conversation.organizationId,
          ))
        ) {
          throw new MessageNotFoundError();
        }
        const existing = await context.messageReactions.findForUser(
          messageId,
          userId,
        );
        const changed = existing?.emoji !== input.emoji;
        if (changed) {
          await context.messageReactions.upsert({
            conversationId: conversation.id,
            messageId,
            userId,
            emoji: input.emoji,
          });
        }
        const [state] = await summarize(
          userId,
          conversation,
          [messageId],
          context.messageReactions,
          context.memberships,
          context.conversationParticipants,
        );
        return {
          changed,
          conversationId: conversation.id,
          state: state ?? {
            messageId,
            reactions: [],
            currentUserReaction: null,
          },
        };
      });
      if (result.changed) notify(result.conversationId, messageId);
      return result.state;
    },

    async remove(userId: string, messageId: string) {
      const result = await unitOfWork.run(async (context) => {
        const message = await context.messages.findById(messageId);
        if (!message) throw new MessageNotFoundError();
        const conversation = await conversations.getAccessibleInContext(
          userId,
          message.conversationId,
          context,
        );
        if (
          !(await context.organizations.lockForMutation(
            conversation.organizationId,
          ))
        ) {
          throw new MessageNotFoundError();
        }
        const changed = await context.messageReactions.deleteForUser(
          messageId,
          userId,
        );
        const [state] = await summarize(
          userId,
          conversation,
          [messageId],
          context.messageReactions,
          context.memberships,
          context.conversationParticipants,
        );
        return {
          changed,
          conversationId: conversation.id,
          state: state ?? {
            messageId,
            reactions: [],
            currentUserReaction: null,
          },
        };
      });
      if (result.changed) notify(result.conversationId, messageId);
      return result.state;
    },

    async listUsers(
      userId: string,
      messageId: string,
      query: MessageReactionUsersQuery,
    ) {
      const { conversation } = await findAccessibleMessage(userId, messageId);
      const eligible = await eligibleUserIds(
        conversation,
        memberships,
        participants,
      );
      const page = await reactions.listUsers(
        messageId,
        query.emoji,
        eligible,
        query.before,
        query.limit + 1,
      );
      const hasMore = page.records.length > query.limit;
      const records = hasMore
        ? page.records.slice(0, query.limit)
        : page.records;
      const publicUsers = await users.findPublicByIds(
        records.map((record) => record.userId),
      );
      const usersById = new Map(publicUsers.map((user) => [user.id, user]));
      return {
        messageId,
        emoji: query.emoji,
        total: page.total,
        users: records.flatMap((record) => {
          const user = usersById.get(record.userId);
          if (!user) return [];
          return [
            {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
            },
          ];
        }),
        nextCursor: hasMore ? (records.at(-1)?.id ?? null) : null,
      };
    },
  };
};

export type MessageReactionService = ReturnType<
  typeof createMessageReactionService
>;
export default createMessageReactionService;
