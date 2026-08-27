import type {
  MessageListResponse,
  MessageReactionStateDto,
} from "@intouch/shared/messages";
import type { InfiniteData } from "@tanstack/react-query";

export const mergeReactionState = (
  data: InfiniteData<MessageListResponse> | undefined,
  state: MessageReactionStateDto,
) => {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((message) =>
        message.id === state.messageId
          ? {
              ...message,
              reactions: state.reactions,
              currentUserReaction: state.currentUserReaction,
            }
          : message,
      ),
    })),
  };
};
