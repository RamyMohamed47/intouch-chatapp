import {
  ConversationType,
  ConversationVisibility,
} from "@intouch/shared/conversations";
import type { UpdateReadReceiptInput } from "@intouch/shared/messages";

import type { ConversationService } from "../conversations/conversation.service.js";
import { MessageNotFoundError } from "../message/message.errors.js";
import { MessageForbiddenError } from "../message/message.errors.js";
import type { MessageRepository } from "../message/message.repository.js";
import type { ReadReceiptRealtime } from "./read-receipt.realtime.js";
import type { ConversationReadStateRepository } from "./read-receipt.repository.js";

export interface ReadReceiptServiceDependencies {
  conversations: Pick<ConversationService, "getAccessible">;
  messages: Pick<MessageRepository, "findById">;
  realtime: ReadReceiptRealtime;
  readStates: ConversationReadStateRepository;
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
  now = () => new Date(),
}: ReadReceiptServiceDependencies) => ({
  async advance(
    userId: string,
    conversationId: string,
    input: UpdateReadReceiptInput,
  ) {
    const conversation = await conversations.getAccessible(
      userId,
      conversationId,
    );
    const message = await messages.findById(input.messageId);
    if (!message || message.conversationId !== conversationId) {
      throw new MessageNotFoundError();
    }

    const { readState, advanced } = await readStates.advance({
      organizationId: conversation.organizationId,
      conversationId,
      userId,
      lastReadMessageId: message.id,
      lastReadAt: now(),
    });
    const view = toView(readState);
    if (advanced) {
      if (conversation.type === ConversationType.DIRECT) {
        realtime.readReceiptUpdated(view);
      } else {
        realtime.channelReadReceiptsChanged(conversationId, userId);
      }
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
