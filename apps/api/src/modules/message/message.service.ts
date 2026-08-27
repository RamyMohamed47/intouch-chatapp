import type {
  CreateMessageInput,
  MessageHistoryQuery,
  UpdateMessageInput,
} from "@intouch/shared/messages";

import type { MessageBroadcaster } from "../../broadcasting/messageBroadcaster.js";
import type { ConversationActivityService } from "../conversation-activity/index.js";
import type { ConversationService } from "../conversations/conversation.service.js";
import { ConversationNotFoundError } from "../conversations/conversation.errors.js";
import type { ConversationPolicy } from "../conversations/conversation.policy.js";
import type { MessageReactionService } from "../message-reactions/index.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import { MessageNotFoundError } from "./message.errors.js";
import type { MessageRepository } from "./message.repository.js";
import { MessageType, type MessagePage } from "./message.types.js";

export interface MessageServiceDependencies {
  activity: Pick<
    ConversationActivityService,
    "messageCreated" | "messageDeleted" | "messageUpdated"
  >;
  broadcaster: MessageBroadcaster;
  conversationPolicy: Pick<
    ConversationPolicy,
    "assertMessageDeletable" | "assertMessageEditable"
  >;
  conversations: Pick<
    ConversationService,
    "getAccessible" | "getAccessibleInContext"
  >;
  messages: MessageRepository;
  reactions: Pick<MessageReactionService, "decorate">;
  unitOfWork: OrganizationUnitOfWork;
}

const createMessageService = ({
  activity,
  broadcaster,
  conversationPolicy,
  conversations,
  messages,
  reactions,
  unitOfWork,
}: MessageServiceDependencies) => ({
  async list(
    userId: string,
    conversationId: string,
    query: MessageHistoryQuery,
  ): Promise<MessagePage> {
    const conversation = await conversations.getAccessible(
      userId,
      conversationId,
    );
    const records = await messages.listByConversation(
      conversationId,
      query.before,
      query.limit + 1,
    );
    const hasMore = records.length > query.limit;
    const page = hasMore ? records.slice(0, query.limit) : records;
    return {
      messages: await reactions.decorate(userId, conversation, page),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  },

  async create(
    userId: string,
    conversationId: string,
    input: CreateMessageInput,
  ) {
    const result = await unitOfWork.run(async (context) => {
      const conversation = await conversations.getAccessibleInContext(
        userId,
        conversationId,
        context,
      );
      if (
        !(await context.organizations.lockForMutation(
          conversation.organizationId,
        ))
      ) {
        throw new ConversationNotFoundError();
      }
      const created = await context.messages.create({
        conversationId,
        senderId: userId,
        content: input.content,
        messageType: MessageType.TEXT,
      });
      if (
        !(await context.conversations.touchActivity(
          conversationId,
          created.createdAt,
        ))
      ) {
        throw new ConversationNotFoundError();
      }
      return { conversation, message: created };
    });
    broadcaster.messageCreated(result.message);
    await activity.messageCreated(result.conversation, userId);
    return {
      ...result.message,
      reactions: [],
      currentUserReaction: null,
    };
  },

  async update(userId: string, messageId: string, input: UpdateMessageInput) {
    const existing = await messages.findById(messageId);
    if (!existing) throw new MessageNotFoundError();
    const conversation = await conversations.getAccessible(
      userId,
      existing.conversationId,
    );
    conversationPolicy.assertMessageEditable(existing, userId);
    const message = await messages.updateContent(
      messageId,
      input.content,
      new Date(),
    );
    if (!message) throw new MessageNotFoundError();
    broadcaster.messageUpdated(message);
    await activity.messageUpdated(conversation, userId);
    const [decorated] = await reactions.decorate(userId, conversation, [
      message,
    ]);
    if (!decorated) throw new MessageNotFoundError();
    return decorated;
  },

  async delete(userId: string, messageId: string) {
    const result = await unitOfWork.run(async (context) => {
      const existing = await context.messages.findById(messageId);
      if (!existing) throw new MessageNotFoundError();
      const conversation = await conversations.getAccessibleInContext(
        userId,
        existing.conversationId,
        context,
      );
      const membership = await context.memberships.findForUser(
        userId,
        conversation.organizationId,
      );
      conversationPolicy.assertMessageDeletable(
        existing,
        conversation,
        userId,
        membership,
      );
      if (existing.deletedAt) return null;
      if (
        !(await context.organizations.lockForMutation(
          conversation.organizationId,
        ))
      ) {
        throw new MessageNotFoundError();
      }
      const message = await context.messages.redact(messageId, new Date());
      if (!message) throw new MessageNotFoundError();
      await context.messageReactions.deleteByMessageId(messageId);
      return { conversation, message };
    });
    if (!result) return;
    broadcaster.messageDeleted(result.message);
    await activity.messageDeleted(result.conversation, userId);
  },
});

export type MessageService = ReturnType<typeof createMessageService>;
export default createMessageService;
