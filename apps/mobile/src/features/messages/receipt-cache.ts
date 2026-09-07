import type {
  ConversationDto,
  DirectMessageListResponse,
} from "@intouch/shared/conversations";
import type { ReadReceiptDto } from "@intouch/shared/messages";
import type { InfiniteData } from "@tanstack/react-query";

import { hasReadMessage } from "@/features/messages/message-presentation";

const mergeDirect = (
  conversation: Extract<ConversationDto, { type: "DIRECT" }>,
  receipt: ReadReceiptDto,
  currentUserId: string,
) => {
  if (
    receipt.userId === currentUserId ||
    receipt.userId !== conversation.peer.id ||
    hasReadMessage(conversation.peerReadReceipt, receipt.lastReadMessageId)
  ) {
    return conversation;
  }
  return { ...conversation, peerReadReceipt: receipt };
};

export const mergePeerReceiptIntoConversation = (
  conversation: ConversationDto | undefined,
  receipt: ReadReceiptDto,
  currentUserId: string,
) =>
  conversation?.type === "DIRECT"
    ? mergeDirect(conversation, receipt, currentUserId)
    : conversation;

export const mergePeerReceiptIntoDirectPages = (
  data: InfiniteData<DirectMessageListResponse> | undefined,
  receipt: ReadReceiptDto,
  currentUserId: string,
) => {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    const directMessages = page.directMessages.map((conversation) => {
      if (conversation.id !== receipt.conversationId) return conversation;
      const next = mergeDirect(conversation, receipt, currentUserId);
      changed ||= next !== conversation;
      return next;
    });
    return changed ? { ...page, directMessages } : page;
  });
  return changed ? { ...data, pages } : data;
};
