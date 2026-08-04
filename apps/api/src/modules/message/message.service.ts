import type {
  CreateMessageInput,
  MessageHistoryQuery,
  UpdateMessageInput,
} from "@intouch/shared/messages";

import type { MessageBroadcaster } from "../../broadcasting/messageBroadcaster.js";
import type { ConversationService } from "../conversations/conversation.service.js";
import { ConversationNotFoundError } from "../conversations/conversation.errors.js";
import type { ConversationPolicy } from "../conversations/conversation.policy.js";
import type { MembershipService } from "../memberships/index.js";
import type { OrganizationUnitOfWork } from "../organizations/organization.unit-of-work.js";
import { MessageNotFoundError } from "./message.errors.js";
import type { MessageRepository } from "./message.repository.js";
import { MessageType, type MessagePage } from "./message.types.js";

export interface MessageServiceDependencies {
  broadcaster: MessageBroadcaster;
  conversationPolicy: Pick<
    ConversationPolicy,
    "assertMessageDeletable" | "assertMessageEditable"
  >;
  conversations: Pick<
    ConversationService,
    "getAccessible" | "getAccessibleInContext"
  >;
  memberships: Pick<MembershipService, "findForUser">;
  messages: MessageRepository;
  unitOfWork: OrganizationUnitOfWork;
}

const createMessageService = ({
  broadcaster,
  conversationPolicy,
  conversations,
  memberships,
  messages,
  unitOfWork,
}: MessageServiceDependencies) => ({
  async list(
    userId: string,
    conversationId: string,
    query: MessageHistoryQuery,
  ): Promise<MessagePage> {
    await conversations.getAccessible(userId, conversationId);
    const records = await messages.listByConversation(
      conversationId,
      query.before,
      query.limit + 1,
    );
    const hasMore = records.length > query.limit;
    const page = hasMore ? records.slice(0, query.limit) : records;
    return {
      messages: page,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  },

  async create(
    userId: string,
    conversationId: string,
    input: CreateMessageInput,
  ) {
    const message = await unitOfWork.run(async (context) => {
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
      return created;
    });
    broadcaster.messageCreated(message);
    return message;
  },

  async update(userId: string, messageId: string, input: UpdateMessageInput) {
    const existing = await messages.findById(messageId);
    if (!existing) throw new MessageNotFoundError();
    await conversations.getAccessible(userId, existing.conversationId);
    conversationPolicy.assertMessageEditable(existing, userId);
    const message = await messages.updateContent(
      messageId,
      input.content,
      new Date(),
    );
    if (!message) throw new MessageNotFoundError();
    broadcaster.messageUpdated(message);
    return message;
  },

  async delete(userId: string, messageId: string) {
    const existing = await messages.findById(messageId);
    if (!existing) throw new MessageNotFoundError();
    const conversation = await conversations.getAccessible(
      userId,
      existing.conversationId,
    );
    const membership = await memberships.findForUser(
      userId,
      conversation.organizationId,
    );
    conversationPolicy.assertMessageDeletable(
      existing,
      conversation,
      userId,
      membership,
    );
    if (existing.deletedAt) return;
    const message = await messages.redact(messageId, new Date());
    if (!message) throw new MessageNotFoundError();
    broadcaster.messageDeleted(message);
  },
});

export type MessageService = ReturnType<typeof createMessageService>;
export default createMessageService;
