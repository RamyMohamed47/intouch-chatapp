import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import type { UpdateReadReceiptInput } from "@intouch/shared/messages";

import type { ConversationService } from "../conversations/conversation.service.js";
import { MessageNotFoundError } from "../message/message.errors.js";
import { MessageForbiddenError } from "../message/message.errors.js";
import type { MessageRepository } from "../message/message.repository.js";
import type { NotificationService } from "../notifications/index.js";
import type {
  OrganizationUnitOfWork,
  OrganizationWorkContext,
} from "../organizations/organization.unit-of-work.js";
import type { ReadReceiptRealtime } from "./read-receipt.realtime.js";
import type { ConversationReadStateRepository } from "./read-receipt.repository.js";

export interface ReadReceiptServiceDependencies {
  conversations: Pick<ConversationService, "getAccessible"> &
    Partial<Pick<ConversationService, "getAccessibleInContext">>;
  messages: Pick<MessageRepository, "findById">;
  realtime: ReadReceiptRealtime;
  readStates: ConversationReadStateRepository;
  unitOfWork?: OrganizationUnitOfWork;
  notificationDelivery?: Pick<NotificationService, "publishUpsert">;
  now?: () => Date;
}

const toView = (
  receipt: Awaited<
    ReturnType<ConversationReadStateRepository["advance"]>
  >["readState"],
) => ({
  id: receipt.id,
  conversationId: receipt.conversationId,
  userId: receipt.userId,
  lastReadMessageId: receipt.lastReadMessageId,
  lastReadAt: receipt.lastReadAt,
});

const createReadReceiptService = ({
  conversations,
  messages,
  realtime,
  readStates,
  unitOfWork,
  notificationDelivery = { publishUpsert: () => Promise.resolve() },
  now = () => new Date(),
}: ReadReceiptServiceDependencies) => ({
  async advance(
    userId: string,
    conversationId: string,
    input: UpdateReadReceiptInput,
  ) {
    const advanceWith = async (context?: OrganizationWorkContext) => {
      const conversation =
        context && conversations.getAccessibleInContext
          ? await conversations.getAccessibleInContext(
              userId,
              conversationId,
              context,
            )
          : await conversations.getAccessible(userId, conversationId);
      const message = await (context?.messages ?? messages).findById(
        input.messageId,
      );
      if (!message || message.conversationId !== conversationId) {
        throw new MessageNotFoundError();
      }
      const readAt = now();
      const { readState, advanced } = await (
        context?.conversationReadStates ?? readStates
      ).advance({
        organizationId: conversation.organizationId,
        conversationId,
        userId,
        lastReadMessageId: message.id,
        lastReadAt: readAt,
      });
      const notification =
        context && advanced && conversation.type === ConversationType.DIRECT
          ? await context.notifications.markDirectMessageReadThrough(
              userId,
              conversationId,
              message.id,
              readAt,
            )
          : null;
      return { conversation, readState, advanced, notification };
    };
    const result = unitOfWork
      ? await unitOfWork.run((context) => advanceWith(context))
      : await advanceWith();
    const view = toView(result.readState);
    if (result.advanced) {
      if (result.conversation.type === ConversationType.DIRECT) {
        realtime.readReceiptUpdated(view);
      } else {
        realtime.channelReadReceiptsChanged(conversationId, userId);
      }
    }
    if (result.notification) {
      await notificationDelivery.publishUpsert(result.notification);
    }
    return view;
  },

  async summarizeMessageReaders(
    userId: string,
    conversationId: string,
    messageId: string,
  ) {
    const conversation = await conversations.getAccessible(
      userId,
      conversationId,
    );
    const message = await messages.findById(messageId);
    if (
      conversation.type !== ConversationType.CHANNEL ||
      !message ||
      message.conversationId !== conversationId
    ) {
      throw new MessageNotFoundError();
    }
    if (message.senderId !== userId) {
      throw new MessageForbiddenError(
        "Only the message sender can view channel readers",
      );
    }
    return readStates.summarizeMessageReaders({
      organizationId: conversation.organizationId,
      conversationId,
      messageId,
      senderId: userId,
      requireParticipant:
        conversation.visibility === ConversationVisibility.PRIVATE,
    });
  },
});

export type ReadReceiptService = ReturnType<typeof createReadReceiptService>;
export default createReadReceiptService;
