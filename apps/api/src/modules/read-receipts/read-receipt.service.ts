import { ConversationType } from "@intouch/shared/conversations";
import type { UpdateReadReceiptInput } from "@intouch/shared/messages";

import type { ConversationService } from "../conversations/conversation.service.js";
import { MessageNotFoundError } from "../message/message.errors.js";
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
  receipt: Awaited<ReturnType<ConversationReadStateRepository["advance"]>>,
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

    const previous = await readStates.find(conversationId, userId);
    const receipt = await readStates.advance({
      organizationId: conversation.organizationId,
      conversationId,
      userId,
      lastReadMessageId: message.id,
      lastReadAt: now(),
    });
    const view = toView(receipt);
    if (
      conversation.type === ConversationType.DIRECT &&
      previous?.lastReadMessageId !== receipt.lastReadMessageId
    ) {
      realtime.readReceiptUpdated(view);
    }
    return view;
  },
});

export type ReadReceiptService = ReturnType<typeof createReadReceiptService>;
export default createReadReceiptService;
