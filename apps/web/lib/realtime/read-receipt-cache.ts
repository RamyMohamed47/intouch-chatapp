import type {
  ConversationDto,
  DirectConversationDto,
  DirectMessageListResponse,
} from "@intouch/shared/conversations";
import type { ReadReceiptDto } from "@intouch/shared/messages";
import type { InfiniteData } from "@tanstack/react-query";

export const hasReadMessage = (
  receipt: ReadReceiptDto | null | undefined,
  messageId: string,
) => Boolean(receipt && receipt.lastReadMessageId >= messageId);

const mergeDirectConversation = (
  conversation: DirectConversationDto,
  receipt: ReadReceiptDto,
  currentUserId: string,
) => {
  if (
    receipt.userId === currentUserId ||
    conversation.peer.id !== receipt.userId ||
    hasReadMessage(conversation.peerReadReceipt, receipt.lastReadMessageId)
  ) {
    return conversation;
  }
  return { ...conversation, peerReadReceipt: receipt };
};

export const mergePeerReadReceipt = (
  conversation: ConversationDto | undefined,
  receipt: ReadReceiptDto,
  currentUserId: string,
) => {
  if (!conversation || conversation.type !== "DIRECT") return conversation;
  return mergeDirectConversation(conversation, receipt, currentUserId);
};

export const mergePeerReceiptIntoDirectMessagePage = (
  page: DirectMessageListResponse | undefined,
  receipt: ReadReceiptDto,
  currentUserId: string,
) => {
  if (!page) return page;
  let changed = false;
  const directMessages = page.directMessages.map((conversation) => {
    if (conversation.id !== receipt.conversationId) return conversation;
    const updated = mergeDirectConversation(
      conversation,
      receipt,
      currentUserId,
    );
    changed ||= updated !== conversation;
    return updated;
  });
  return changed ? { ...page, directMessages } : page;
};

export const mergePeerReceiptIntoInfiniteDirectMessages = (
  data: InfiniteData<DirectMessageListResponse> | undefined,
  receipt: ReadReceiptDto,
  currentUserId: string,
) => {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    const updated = mergePeerReceiptIntoDirectMessagePage(
      page,
      receipt,
      currentUserId,
    );
    changed ||= updated !== page;
    return updated ?? page;
  });
  return changed ? { ...data, pages } : data;
};
